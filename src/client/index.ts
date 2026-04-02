/**
 * Client API for the ConvexFS file storage component.
 *
 * @example
 * ```typescript
 * // convex/fs.ts
 * import { ConvexFS } from "convex-fs";
 * import { components } from "./_generated/api";
 *
 * export const fs = new ConvexFS(components.fs, {
 *   storage: {
 *     type: "bunny",
 *     apiKey: process.env.BUNNY_API_KEY!,
 *     storageZoneName: process.env.BUNNY_STORAGE_ZONE!,
 *     cdnHostname: process.env.BUNNY_CDN_HOSTNAME!,
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // convex/files.ts
 * import { action, query } from "./_generated/server";
 * import { fs } from "./fs";
 *
 * export const getFile = query({
 *   args: { path: v.string() },
 *   handler: async (ctx, args) => {
 *     return await fs.stat(ctx, args.path);
 *   },
 * });
 * ```
 */

import { httpActionGeneric } from "convex/server";
import type { PaginationOptions, PaginationResult } from "convex/server";
import { corsRouter } from "convex-helpers/server/cors";
import type { ComponentApi } from "../component/_generated/component.js";
import type {
  QueryCtx,
  MutationCtx,
  ActionCtx,
  RegisterRoutesConfig,
  ConvexFSOptions,
  HttpRouter,
} from "./types.js";
import type { FileMetadata } from "../component/types.js";
import type { BlobStore } from "../blobstore/index.js";
import { createBlobStore } from "../blobstore/index.js";

// Re-export types for consumers
export type { Config, FileMetadata, Op, Dest } from "../component/types.js";

// Re-export error types and type guards
export type { ConflictErrorData, ConflictCode } from "../component/types.js";
export { isConflictError } from "../component/types.js";

export type {
  QueryCtx,
  MutationCtx,
  ActionCtx,
  RegisterRoutesConfig,
  ConvexFSOptions,
};

export type FSComponent = ComponentApi;

function createClosedByteStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
}

function prepareUploadStream(
  stream: ReadableStream<Uint8Array>,
  contentLength?: number,
): {
  stream: ReadableStream<Uint8Array>;
  sizePromise: Promise<number>;
} {
  if (contentLength !== undefined) {
    return {
      stream,
      sizePromise: Promise.resolve(contentLength),
    };
  }

  let resolveSize!: (size: number) => void;
  let rejectSize!: (error?: unknown) => void;
  const sizePromise = new Promise<number>((resolve, reject) => {
    resolveSize = resolve;
    rejectSize = reject;
  });

  let size = 0;
  const reader = stream.getReader();
  const wrappedStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          resolveSize(size);
          reader.releaseLock();
          controller.close();
          return;
        }
        size += value.byteLength;
        controller.enqueue(value);
      } catch (error) {
        rejectSize(error);
        reader.releaseLock();
        controller.error(error);
      }
    },
    async cancel(reason) {
      rejectSize(reason);
      await reader.cancel(reason);
      reader.releaseLock();
    },
  });

  return {
    stream: wrappedStream,
    sizePromise,
  };
}

async function cleanupBlobAfterControlPlaneFailure(
  store: BlobStore,
  blobId: string,
): Promise<void> {
  try {
    await store.delete(blobId);
  } catch (error) {
    // Cleanup is best-effort because the original control-plane failure matters more.
    console.error(
      `Failed to clean up blob "${blobId}" after control-plane failure:`,
      error,
    );
  }
}

/**
 * ConvexFS client for interacting with the file storage component.
 *
 * Configuration requires a `storage` option specifying the Bunny.net backend:
 *
 * @example
 * ```typescript
 * const fs = new ConvexFS(components.fs, {
 *   storage: {
 *     type: "bunny",
 *     apiKey: process.env.BUNNY_API_KEY!,
 *     storageZoneName: process.env.BUNNY_STORAGE_ZONE!,
 *     cdnHostname: process.env.BUNNY_CDN_HOSTNAME!,
 *     tokenKey: process.env.BUNNY_TOKEN_KEY, // Optional, for signed URLs
 *   },
 * });
 * ```
 */
export class ConvexFS {
  constructor(
    public component: ComponentApi,
    private options: ConvexFSOptions,
  ) {}

  /**
   * Build config from options.
   * Used internally and by registerRoutes for the upload proxy.
   */
  get config() {
    return {
      storage: this.options.storage,
      downloadUrlTtl: this.options.downloadUrlTtl,
      blobGracePeriod: this.options.blobGracePeriod,
    };
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Commit uploaded blobs to file paths.
   *
   * This atomically creates/updates file records for previously uploaded blobs.
   *
   * @param files - Array of file commits with path, blobId, and optional basis for CAS
   *
   * The `basis` field controls overwrite behavior:
   * - `undefined`: No check - silently overwrite if file exists
   * - `null`: File must not exist (fails if file exists)
   * - `string`: File's current blobId must match (CAS update)
   *
   * @example
   * ```typescript
   * // Simple commit - overwrites if exists (after uploading via /fs/upload endpoint)
   * await fs.commitFiles(ctx, [
   *   { path: "/uploads/file.txt", blobId },
   * ]);
   *
   * // Create only - fails if file already exists
   * await fs.commitFiles(ctx, [
   *   { path: "/uploads/file.txt", blobId, basis: null },
   * ]);
   *
   * // CAS update - only succeeds if current blobId matches basis
   * await fs.commitFiles(ctx, [
   *   { path: "/uploads/file.txt", blobId: newBlobId, basis: oldBlobId },
   * ]);
   * ```
   */
  async commitFiles(
    ctx: MutationCtx,
    files: Array<{ path: string; blobId: string; basis?: string | null }>,
  ): Promise<void> {
    await ctx.runMutation(this.component.lib.commitFiles, {
      config: this.config,
      files,
    });
  }

  /**
   * Get a download URL for a blob.
   *
   * For Bunny storage with token authentication, this generates a signed CDN URL.
   * Without token authentication, returns an unsigned CDN URL.
   *
   * @param blobId - The blob identifier
   * @returns Download URL
   *
   * @example
   * ```typescript
   * const file = await fs.stat(ctx, "/uploads/file.txt");
   * if (file) {
   *   const url = await fs.getDownloadUrl(ctx, file.blobId);
   *   // Return URL to client for download
   * }
   * ```
   */
  async getDownloadUrl(
    ctx: ActionCtx,
    blobId: string,
    opts?: { extraParams?: Record<string, string> },
  ): Promise<string> {
    return await ctx.runAction(this.component.lib.getDownloadUrl, {
      config: this.config,
      blobId,
      extraParams: opts?.extraParams,
    });
  }

  /**
   * Get a blob as a stream by blobId.
   *
   * This fetches the download URL from the component, then streams
   * the blob directly from storage in the caller's execution context.
   * Returns null if the blob doesn't exist.
   */
  async getBlobStream(
    ctx: ActionCtx,
    blobId: string,
  ): Promise<ReadableStream<Uint8Array> | null> {
    const url = await this.getDownloadUrl(ctx, blobId);
    const response = await fetch(url);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(
        `Failed to fetch blob: ${response.status} ${response.statusText}`,
      );
    }
    return response.body ?? createClosedByteStream();
  }

  /**
   * Get a file's contents and metadata by path as a stream.
   *
   * This looks up file metadata in the control plane, then streams
   * the blob directly from storage in the caller's execution context.
   */
  async getFileStream(
    ctx: ActionCtx,
    path: string,
  ): Promise<{
    stream: ReadableStream<Uint8Array>;
    contentType: string;
    size: number;
  } | null> {
    const file = await this.stat(ctx, path);
    if (!file) {
      return null;
    }

    const stream = await this.getBlobStream(ctx, file.blobId);
    if (!stream) {
      return null;
    }

    return {
      stream,
      contentType: file.contentType,
      size: file.size,
    };
  }

  /**
   * Write a stream to blob storage.
   *
   * Uploads the stream directly to blob storage in the caller's execution
   * context, then registers the pending upload with the component.
   * If contentLength is omitted, bytes are counted while streaming so the
   * control plane still records the final size.
   */
  async writeBlobStream(
    ctx: ActionCtx,
    stream: ReadableStream<Uint8Array>,
    contentType: string,
    opts?: { contentLength?: number },
  ): Promise<{ blobId: string; size: number }> {
    const storage = this.options.storage;
    const blobId = crypto.randomUUID();
    const store = createBlobStore(storage);
    const upload = prepareUploadStream(stream, opts?.contentLength);

    await store.put(blobId, upload.stream, {
      contentType,
      contentLength: opts?.contentLength,
    });

    const size = await upload.sizePromise;

    try {
      await ctx.runMutation(this.component.lib.registerPendingUpload, {
        config: this.config,
        blobId,
        contentType,
        size,
      });
    } catch (error) {
      await cleanupBlobAfterControlPlaneFailure(store, blobId);
      throw error;
    }

    return { blobId, size };
  }

  /**
   * Write a stream directly to a file path.
   *
   * This composes upload, pending-upload registration, and commit.
   * If the commit fails after upload registration, the pending upload is left
   * in place for existing upload GC to clean up.
   */
  async writeFileStream(
    ctx: ActionCtx,
    path: string,
    stream: ReadableStream<Uint8Array>,
    contentType: string,
    opts?: { contentLength?: number },
  ): Promise<{ blobId: string; size: number }> {
    const result = await this.writeBlobStream(ctx, stream, contentType, opts);
    await this.commitFiles(ctx, [{ path, blobId: result.blobId }]);
    return result;
  }

  // ============================================================================
  // Queries
  // ============================================================================

  /**
   * Get file metadata by path.
   *
   * @param path - The file path
   * @returns File metadata or null if not found
   *
   * @example
   * ```typescript
   * const file = await fs.stat(ctx, "/uploads/file.txt");
   * if (file) {
   *   console.log(file.contentType, file.size);
   * }
   * ```
   */
  async stat(
    ctx: QueryCtx,
    path: string,
  ): Promise<{
    path: string;
    blobId: string;
    contentType: string;
    size: number;
  } | null> {
    return await ctx.runQuery(this.component.lib.stat, {
      config: this.config,
      path,
    });
  }

  /**
   * List files in the filesystem with pagination.
   *
   * Returns files sorted alphabetically by path, with optional prefix filtering
   * and cursor-based pagination.
   *
   * This method is compatible with `usePaginatedQuery` from `convex-fs/react`.
   *
   * @param options.prefix - Optional path prefix filter (e.g., "/uploads/")
   * @param options.paginationOpts - Pagination options (numItems, cursor, endCursor)
   * @returns Page of files with continuation cursor
   *
   * @example
   * ```typescript
   * // Server-side: List first page
   * const page1 = await fs.list(ctx, {
   *   prefix: "/uploads/",
   *   paginationOpts: { numItems: 50, cursor: null },
   * });
   *
   * // Server-side: Get next page
   * const page2 = await fs.list(ctx, {
   *   prefix: "/uploads/",
   *   paginationOpts: { numItems: 50, cursor: page1.continueCursor },
   * });
   *
   * // React: Use with usePaginatedQuery (in your wrapper query)
   * // See convex-fs/react for the usePaginatedQuery hook
   * ```
   */
  async list(
    ctx: QueryCtx,
    options: {
      prefix?: string;
      paginationOpts: PaginationOptions;
    },
  ): Promise<PaginationResult<FileMetadata>> {
    return await ctx.runQuery(this.component.lib.list, {
      config: this.config,
      prefix: options.prefix,
      paginationOpts: options.paginationOpts,
    });
  }

  // ============================================================================
  // Mutations
  // ============================================================================

  /**
   * Execute atomic file operations (move/copy/delete/setAttributes).
   *
   * All operations are validated and applied atomically. If any operation
   * fails its preconditions (source doesn't match, dest conflict), the
   * entire transaction is rejected.
   *
   * The `dest.basis` field controls overwrite behavior:
   * - `undefined`: No check - silently overwrite if dest exists
   * - `null`: Dest must not exist (fails if file exists)
   * - `string`: Dest's current blobId must match (CAS update)
   *
   * For `setAttributes`, the attributes field uses:
   * - `undefined`: Keep existing value
   * - `null`: Clear the attribute
   * - `value`: Set to new value
   *
   * @param ops - Array of operations to execute
   *
   * @example
   * ```typescript
   * const file = await fs.stat(ctx, "/old/path.txt");
   * if (file) {
   *   // Move file, overwriting dest if it exists
   *   await fs.transact(ctx, [
   *     { op: "move", source: file, dest: { path: "/new/path.txt" } },
   *   ]);
   *
   *   // Copy file, fail if dest exists (Unix semantics)
   *   await fs.transact(ctx, [
   *     { op: "copy", source: file, dest: { path: "/copy.txt", basis: null } },
   *   ]);
   *
   *   // Delete file
   *   await fs.transact(ctx, [
   *     { op: "delete", source: file },
   *   ]);
   *
   *   // Set expiration on a file
   *   await fs.transact(ctx, [
   *     { op: "setAttributes", source: file, attributes: { expiresAt: Date.now() + 3600000 } },
   *   ]);
   *
   *   // Clear expiration from a file
   *   await fs.transact(ctx, [
   *     { op: "setAttributes", source: file, attributes: { expiresAt: null } },
   *   ]);
   * }
   * ```
   */
  async transact(
    ctx: MutationCtx,
    ops: Array<
      | {
          op: "move";
          source: {
            path: string;
            blobId: string;
            contentType: string;
            size: number;
            attributes?: { expiresAt?: number };
          };
          dest: { path: string; basis?: string | null };
        }
      | {
          op: "copy";
          source: {
            path: string;
            blobId: string;
            contentType: string;
            size: number;
            attributes?: { expiresAt?: number };
          };
          dest: { path: string; basis?: string | null };
        }
      | {
          op: "delete";
          source: {
            path: string;
            blobId: string;
            contentType: string;
            size: number;
            attributes?: { expiresAt?: number };
          };
        }
      | {
          op: "setAttributes";
          source: {
            path: string;
            blobId: string;
            contentType: string;
            size: number;
            attributes?: { expiresAt?: number };
          };
          attributes: { expiresAt?: number | null };
        }
    >,
  ): Promise<void> {
    await ctx.runMutation(this.component.lib.transact, {
      config: this.config,
      ops,
    });
  }

  // ============================================================================
  // Convenience Mutations (path-based)
  // ============================================================================

  /**
   * Copy a file to a new path.
   *
   * This is a convenience wrapper around `transact` for the common case of
   * copying a file to a path that doesn't exist.
   *
   * **Note:** This method is not safe against races because it doesn't allow
   * specifying the expected version of the source file. If you need to ensure
   * the source hasn't changed, use `transact` directly with the `source` from
   * a prior `stat` call.
   *
   * @param sourcePath - Path of the file to copy
   * @param destPath - Destination path (must not exist)
   * @throws If source file doesn't exist
   * @throws If destination already exists
   *
   * @example
   * ```typescript
   * await fs.copy(ctx, "/uploads/photo.jpg", "/backups/photo.jpg");
   * ```
   */
  async copy(
    ctx: MutationCtx,
    sourcePath: string,
    destPath: string,
  ): Promise<void> {
    await ctx.runMutation(this.component.lib.copyByPath, {
      config: this.config,
      sourcePath,
      destPath,
    });
  }

  /**
   * Move a file to a new path.
   *
   * This is a convenience wrapper around `transact` for the common case of
   * moving a file to a path that doesn't exist.
   *
   * **Note:** This method is not safe against races because it doesn't allow
   * specifying the expected version of the source file. If you need to ensure
   * the source hasn't changed, use `transact` directly with the `source` from
   * a prior `stat` call.
   *
   * @param sourcePath - Path of the file to move
   * @param destPath - Destination path (must not exist)
   * @throws If source file doesn't exist
   * @throws If destination already exists
   *
   * @example
   * ```typescript
   * await fs.move(ctx, "/uploads/temp.txt", "/documents/final.txt");
   * ```
   */
  async move(
    ctx: MutationCtx,
    sourcePath: string,
    destPath: string,
  ): Promise<void> {
    await ctx.runMutation(this.component.lib.moveByPath, {
      config: this.config,
      sourcePath,
      destPath,
    });
  }

  /**
   * Delete a file by path.
   *
   * This is a convenience wrapper around `transact` for the common case of
   * deleting a file. This operation is idempotent - if the file doesn't exist,
   * it's a no-op.
   *
   * **Note:** This method is not safe against races because it doesn't allow
   * specifying the expected version of the file. If you need to ensure the
   * file hasn't changed, use `transact` directly with the `source` from a
   * prior `stat` call.
   *
   * @param path - Path of the file to delete
   *
   * @example
   * ```typescript
   * await fs.delete(ctx, "/uploads/old-file.txt");
   * ```
   */
  async delete(ctx: MutationCtx, path: string): Promise<void> {
    await ctx.runMutation(this.component.lib.deleteByPath, {
      config: this.config,
      path,
    });
  }
}

/**
 * Register HTTP routes for blob downloads and uploads.
 *
 * Creates routes under the given pathPrefix:
 * - POST `{pathPrefix}/upload` - Upload proxy endpoint
 * - GET `{pathPrefix}/blobs/{blobId}` - Returns 302 redirect to download URL
 *
 * @param http - The HTTP router instance
 * @param component - The FS component reference
 * @param fs - A ConvexFS instance with storage configuration
 * @param config - Configuration with required auth callbacks
 *
 * @example
 * ```typescript
 * // convex/http.ts
 * import { httpRouter } from "convex/server";
 * import { ConvexFS, registerRoutes } from "convex-fs";
 * import { components } from "./_generated/api";
 *
 * const http = httpRouter();
 *
 * const fs = new ConvexFS(components.fs, {
 *   storage: {
 *     type: "bunny",
 *     apiKey: process.env.BUNNY_API_KEY!,
 *     storageZoneName: process.env.BUNNY_STORAGE_ZONE!,
 *     cdnHostname: process.env.BUNNY_CDN_HOSTNAME!,
 *   },
 * });
 *
 * registerRoutes(http, components.fs, fs, {
 *   pathPrefix: "/fs",
 *   uploadAuth: async (ctx) => {
 *     const identity = await ctx.auth.getUserIdentity();
 *     return identity !== null;
 *   },
 *   downloadAuth: async (ctx, blobId) => {
 *     const identity = await ctx.auth.getUserIdentity();
 *     return identity !== null;
 *   },
 * });
 *
 * // Routes created:
 * // POST /fs/upload - Upload proxy (requires uploadAuth)
 * // GET /fs/blobs/{blobId} - Download redirect (requires downloadAuth)
 *
 * export default http;
 * ```
 */
export function registerRoutes(
  http: HttpRouter,
  component: ComponentApi,
  fs: ConvexFS,
  config: RegisterRoutesConfig,
): void {
  const pathPrefix = config.pathPrefix ?? "/fs";

  // Create CORS-enabled router for cross-origin requests
  const cors = corsRouter(http, {
    allowedOrigins: ["*"],
    allowedHeaders: ["Content-Type", "Content-Length", "Authorization"],
  });

  // Route: POST /fs/upload -> Stream directly to Bunny storage
  cors.route({
    path: pathPrefix + "/upload",
    method: "POST",
    handler: httpActionGeneric(async (ctx, req) => {
      // Auth check for upload
      try {
        const allowed = await config.uploadAuth(ctx);
        if (!allowed) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const storage = fs.config.storage;

      const contentType =
        req.headers.get("Content-Type") ?? "application/octet-stream";
      const contentLengthHeader = req.headers.get("Content-Length");
      const contentLength = contentLengthHeader
        ? parseInt(contentLengthHeader, 10)
        : undefined;

      if (!req.body) {
        return new Response(JSON.stringify({ error: "Missing request body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Generate blobId locally
      const blobId = crypto.randomUUID();

      try {
        // Stream the request body directly to storage (data plane)
        const store = createBlobStore(storage);
        const upload = prepareUploadStream(req.body, contentLength);
        await store.put(blobId, upload.stream, {
          contentType,
          contentLength,
        });
        const size = await upload.sizePromise;

        // Register pending upload with component (control plane)
        try {
          await ctx.runMutation(component.lib.registerPendingUpload, {
            config: fs.config,
            blobId,
            contentType,
            size,
          });
        } catch (error) {
          await cleanupBlobAfterControlPlaneFailure(store, blobId);
          throw error;
        }

        return new Response(JSON.stringify({ blobId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Upload error:", error);
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Upload failed",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }),
  });

  // Route: GET /fs/blobs/{blobId} -> 302 redirect to CDN URL
  cors.route({
    pathPrefix: pathPrefix + "/blobs/",
    method: "GET",
    handler: httpActionGeneric(async (ctx, req) => {
      // Extract blobId from URL
      const { blobId, path } = parseDownloadUrl(req.url);

      if (!blobId) {
        return new Response(JSON.stringify({ error: "Missing blobId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (path) {
        const file = await fs.stat(ctx, path);
        if (!file) {
          return new Response(JSON.stringify({ error: "File not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (file.blobId !== blobId) {
          return new Response(JSON.stringify({ error: "Blob ID mismatch" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Extract CDN params from the cdn-params query parameter (JSON-encoded)
      const requestUrl = new URL(req.url);
      const cdnParamsJson = requestUrl.searchParams.get("cdn-params");
      let extraParams: Record<string, string> | undefined;

      if (cdnParamsJson) {
        try {
          extraParams = JSON.parse(cdnParamsJson);
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid cdn-params JSON" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      // Auth check for download
      try {
        const allowed = await config.downloadAuth(
          ctx,
          blobId,
          path,
          extraParams,
        );
        if (!allowed) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get download URL using the fs instance's config
      try {
        // Get download URL with extra params included (and signed if token auth)
        const downloadUrl = await fs.getDownloadUrl(ctx, blobId, {
          extraParams,
        });

        // Cache for token TTL minus buffer
        const tokenTtl = fs.config.downloadUrlTtl ?? 3600; // Default 1 hour
        const cacheBuffer = 300; // 5 minute buffer
        const cacheTtl = Math.max(0, tokenTtl - cacheBuffer);
        const cacheControl = `private, max-age=${cacheTtl}`;

        return new Response(null, {
          status: 302,
          headers: {
            Location: downloadUrl,
            "Cache-Control": cacheControl,
          },
        });
      } catch (error) {
        // Blob not found or other error
        console.error("Error getting download URL:", error);
        return new Response(JSON.stringify({ error: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    }),
  });
}

/**
 * Build a download URL for the given blob.
 * @param siteUrl - The site URL
 * @param prefix - The path prefix
 * @param blobId - The ID of the blob
 * @param path - The path of the file being downloaded
 * @param params - Additional query parameters to pass through to the CDN (JSON-encoded in cdn-params)
 * @returns The download URL
 */
export function buildDownloadUrl(
  siteUrl: string,
  prefix: string,
  blobId: string,
  path?: string,
  params?: Record<string, string>,
): string {
  const url = new URL(`${prefix}/blobs/${blobId}`, siteUrl);
  if (path !== undefined) {
    url.searchParams.set("path", path);
  }
  if (params && Object.keys(params).length > 0) {
    url.searchParams.set("cdn-params", JSON.stringify(params));
  }
  return url.toString();
}

/**
 * Parse a download URL into a blob ID and path.
 * @param url - The download URL
 * @returns The blob ID and path
 */
export function parseDownloadUrl(url: string): {
  blobId: string;
  path?: string;
} {
  const urlObj = new URL(url);
  const blobId = urlObj.pathname.split("/").pop() ?? "";
  const path = urlObj.searchParams.get("path");
  return { blobId, path: path ? decodeURIComponent(path) : undefined };
}

export default ConvexFS;
