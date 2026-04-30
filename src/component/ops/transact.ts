/**
 * Transaction and commit operations for ConvexFS.
 *
 * This module contains the core transactional filesystem operations:
 * - commitFiles: Commit uploaded blobs to file paths
 * - transact: Execute atomic filesystem operations (move, copy, delete)
 */
import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server.js";

import { configValidator, opValidator } from "../types.js";
import type { Op, ConflictErrorData } from "../types.js";
import type { MutationCtx } from "../_generated/server.js";

import { fileCommitValidator } from "./types.js";
import { deleteFileAndDecrefBlob } from "./helpers.js";

export const commitFiles = mutation({
  args: {
    config: configValidator,
    files: v.array(fileCommitValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { config: _config, files } = args;

    if (files.length === 0) {
      return null;
    }

    // Get metadata from uploads table (populated during proxy upload)
    const metadataMap = new Map<
      string,
      { contentType: string; size: number }
    >();
    for (const file of files) {
      const upload = await ctx.db
        .query("uploads")
        .withIndex("blobId", (q) => q.eq("blobId", file.blobId))
        .unique();
      if (
        upload &&
        upload.contentType !== undefined &&
        upload.size !== undefined
      ) {
        metadataMap.set(file.blobId, {
          contentType: upload.contentType,
          size: upload.size,
        });
      }
    }

    // Verify all blobs have metadata (should always be true with proxy upload)
    const missingMetadata = files.filter((f) => !metadataMap.has(f.blobId));
    if (missingMetadata.length > 0) {
      const missingIds = missingMetadata.map((f) => f.blobId).join(", ");
      throw new Error(
        `Upload records not found for blobs: ${missingIds}. ` +
          `Blobs must be uploaded via the /fs/upload endpoint before committing.`,
      );
    }

    // Verify CAS conditions
    for (const file of files) {
      if (file.basis !== undefined) {
        const currentFile = await ctx.db
          .query("files")
          .withIndex("path", (q) => q.eq("path", file.path))
          .unique();
        const currentBlobId = currentFile?.blobId ?? null;

        if (currentBlobId !== file.basis) {
          throw new ConvexError<ConflictErrorData>({
            type: "conflict",
            code: "CAS_CONFLICT",
            message: `CAS conflict for path "${file.path}": expected basis "${file.basis}", found "${currentBlobId}"`,
            path: file.path,
            expected: file.basis,
            found: currentBlobId,
          });
        }
      }
    }

    // All checks passed, commit the files
    const now = Date.now();

    for (const file of files) {
      const metadata = metadataMap.get(file.blobId)!;

      // 1. Insert into blobs table with refCount=1
      await ctx.db.insert("blobs", {
        blobId: file.blobId,
        metadata: {
          contentType: metadata.contentType,
          size: metadata.size,
        },
        refCount: 1,
        updatedAt: now,
      });

      // 2. Update or insert into files table
      const existingFile = await ctx.db
        .query("files")
        .withIndex("path", (q) => q.eq("path", file.path))
        .unique();

      if (existingFile) {
        // Update existing file to point to new blob
        // Attributes are replaced (cleared if not specified, as if the old file was deleted first)
        await ctx.db.patch(existingFile._id, {
          blobId: file.blobId,
          attributes: file.attributes,
        });

        // Decrement refCount on old blob (GC will clean up if it hits 0)
        const oldBlob = await ctx.db
          .query("blobs")
          .withIndex("blobId", (q) => q.eq("blobId", existingFile.blobId))
          .unique();
        if (oldBlob) {
          await ctx.db.patch(oldBlob._id, {
            refCount: oldBlob.refCount - 1,
            updatedAt: now,
          });
        }
      } else {
        // Insert new file with optional attributes
        await ctx.db.insert("files", {
          path: file.path,
          blobId: file.blobId,
          attributes: file.attributes,
        });
      }

      // 3. Delete from uploads table
      const upload = await ctx.db
        .query("uploads")
        .withIndex("blobId", (q) => q.eq("blobId", file.blobId))
        .unique();
      if (upload) {
        await ctx.db.delete(upload._id);
      }
    }

    return null;
  },
});

/**
 * Apply a single filesystem operation (journal semantics).
 *
 * Validates predicates against current state, then applies the operation.
 * If validation fails, throws an error which will roll back the entire
 * Convex mutation (including any previous operations in the journal).
 *
 * @param ctx - Mutation context
 * @param op - The operation to apply
 * @param opIndex - 0-based index of operation in journal (for error messages)
 * @param now - Timestamp for blob updates
 */
async function applyOperation(
  ctx: MutationCtx,
  op: Op,
  opIndex: number,
  now: number,
): Promise<void> {
  const opNum = opIndex + 1; // 1-indexed for human-readable errors

  // Validate source predicate (file must exist and blobId must match)
  const sourceFile = await ctx.db
    .query("files")
    .withIndex("path", (q) => q.eq("path", op.source.path))
    .unique();

  if (!sourceFile) {
    throw new ConvexError<ConflictErrorData>({
      type: "conflict",
      code: "SOURCE_NOT_FOUND",
      message: `Operation ${opNum}: Source file not found: "${op.source.path}"`,
      path: op.source.path,
      expected: op.source.blobId,
      found: null,
      operationIndex: opNum,
    });
  }

  if (sourceFile.blobId !== op.source.blobId) {
    throw new ConvexError<ConflictErrorData>({
      type: "conflict",
      code: "SOURCE_CHANGED",
      message: `Operation ${opNum}: Source file changed: "${op.source.path}" expected blobId "${op.source.blobId}", found "${sourceFile.blobId}"`,
      path: op.source.path,
      expected: op.source.blobId,
      found: sourceFile.blobId,
      operationIndex: opNum,
    });
  }

  // Validate dest predicate for move/copy operations
  if (op.op === "move" || op.op === "copy") {
    const destFile = await ctx.db
      .query("files")
      .withIndex("path", (q) => q.eq("path", op.dest.path))
      .unique();

    if (op.dest.basis === undefined) {
      // No basis: no check, allow overwrite
    } else if (op.dest.basis === null) {
      // Null basis: dest must not exist
      if (destFile) {
        throw new ConvexError<ConflictErrorData>({
          type: "conflict",
          code: "DEST_EXISTS",
          message: `Operation ${opNum}: Dest conflict at "${op.dest.path}": expected no file, found blobId "${destFile.blobId}"`,
          path: op.dest.path,
          expected: null,
          found: destFile.blobId,
          operationIndex: opNum,
        });
      }
    } else {
      // String basis: dest blobId must match
      if (!destFile) {
        throw new ConvexError<ConflictErrorData>({
          type: "conflict",
          code: "DEST_NOT_FOUND",
          message: `Operation ${opNum}: Dest conflict at "${op.dest.path}": expected blobId "${op.dest.basis}", found null`,
          path: op.dest.path,
          expected: op.dest.basis,
          found: null,
          operationIndex: opNum,
        });
      }
      if (destFile.blobId !== op.dest.basis) {
        throw new ConvexError<ConflictErrorData>({
          type: "conflict",
          code: "DEST_CHANGED",
          message: `Operation ${opNum}: Dest conflict at "${op.dest.path}": expected blobId "${op.dest.basis}", found "${destFile.blobId}"`,
          path: op.dest.path,
          expected: op.dest.basis,
          found: destFile.blobId,
          operationIndex: opNum,
        });
      }
    }
  }

  // Apply the operation
  if (op.op === "delete") {
    await deleteFileAndDecrefBlob(ctx, sourceFile._id, sourceFile.blobId, now);
  } else if (op.op === "move") {
    // Check for existing file at dest (including expired files) for cleanup.
    // Note: We query the raw DB here, not getFileByPath, because we need to
    // clean up any existing record (even expired) to avoid path collision.
    const destFile = await ctx.db
      .query("files")
      .withIndex("path", (q) => q.eq("path", op.dest.path))
      .unique();

    if (destFile) {
      // Delete dest file record
      await ctx.db.delete(destFile._id);

      // Decrement refCount on dest blob
      const destBlob = await ctx.db
        .query("blobs")
        .withIndex("blobId", (q) => q.eq("blobId", destFile.blobId))
        .unique();

      if (destBlob) {
        await ctx.db.patch(destBlob._id, {
          refCount: destBlob.refCount - 1,
          updatedAt: now,
        });
      }
    }

    // Update source file's path to dest and clear attributes
    // (attributes are path-specific, not preserved on move)
    await ctx.db.patch(sourceFile._id, {
      path: op.dest.path,
      attributes: undefined,
    });
  } else if (op.op === "copy") {
    // Increment refCount on source blob
    const sourceBlob = await ctx.db
      .query("blobs")
      .withIndex("blobId", (q) => q.eq("blobId", sourceFile.blobId))
      .unique();

    if (sourceBlob) {
      await ctx.db.patch(sourceBlob._id, {
        refCount: sourceBlob.refCount + 1,
        updatedAt: now,
      });
    }

    // Check for existing file at dest (including expired files) for cleanup.
    // Note: We query the raw DB here, not getFileByPath, because we need to
    // clean up any existing record (even expired) to avoid path collision.
    const destFile = await ctx.db
      .query("files")
      .withIndex("path", (q) => q.eq("path", op.dest.path))
      .unique();

    if (destFile) {
      // Dest exists - overwrite (validated above, or expired file being replaced)
      // Update dest file to point to source blob and clear attributes
      await ctx.db.patch(destFile._id, {
        blobId: sourceFile.blobId,
        attributes: undefined,
      });

      // Decrement refCount on old dest blob
      const destBlob = await ctx.db
        .query("blobs")
        .withIndex("blobId", (q) => q.eq("blobId", destFile.blobId))
        .unique();

      if (destBlob) {
        await ctx.db.patch(destBlob._id, {
          refCount: destBlob.refCount - 1,
          updatedAt: now,
        });
      }
    } else {
      // Dest doesn't exist - create new file record (no attributes)
      await ctx.db.insert("files", {
        path: op.dest.path,
        blobId: sourceFile.blobId,
      });
    }
  } else if (op.op === "setAttributes") {
    // Merge attributes: null = clear, value = set, undefined = keep existing
    const currentAttrs = sourceFile.attributes ?? {};
    const newAttrs: { expiresAt?: number } = {};

    // Handle expiresAt
    if (op.attributes.expiresAt === null) {
      // Clear - don't include in newAttrs
    } else if (op.attributes.expiresAt !== undefined) {
      // Set to new value
      newAttrs.expiresAt = op.attributes.expiresAt;
    } else {
      // Keep existing
      if (currentAttrs.expiresAt !== undefined) {
        newAttrs.expiresAt = currentAttrs.expiresAt;
      }
    }

    // Only set attributes if there's something to set, otherwise clear
    const finalAttrs = Object.keys(newAttrs).length > 0 ? newAttrs : undefined;

    await ctx.db.patch(sourceFile._id, {
      attributes: finalAttrs,
    });
  }
}

export const transact = mutation({
  args: {
    config: configValidator,
    ops: v.array(opValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Process operations sequentially as a journal.
    // Each operation is validated and applied before moving to the next.
    // If any operation fails, Convex mutation semantics ensure all
    // previous operations are rolled back automatically.
    for (let i = 0; i < args.ops.length; i++) {
      await applyOperation(ctx, args.ops[i], i, now);
    }

    return null;
  },
});
