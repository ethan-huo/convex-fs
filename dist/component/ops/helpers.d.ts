/**
 * Shared helper functions for filesystem operations.
 * These are used by both transact operations and background GC jobs.
 */
import type { MutationCtx } from "../_generated/server.js";
import type { Id } from "../_generated/dataModel.js";
/**
 * Delete a file record and decrement the blob's refCount.
 *
 * This is the core "remove file" operation used by:
 * - transact delete operation
 * - FGC (file garbage collection) for expired files
 *
 * @param ctx - Mutation context
 * @param fileId - The file record ID to delete
 * @param blobId - The blob ID to decrement refCount on
 * @param now - Current timestamp for blob updatedAt
 */
export declare function deleteFileAndDecrefBlob(ctx: MutationCtx, fileId: Id<"files">, blobId: string, now: number): Promise<void>;
//# sourceMappingURL=helpers.d.ts.map