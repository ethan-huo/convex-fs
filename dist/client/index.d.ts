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
import type { PaginationOptions, PaginationResult } from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";
import type { QueryCtx, MutationCtx, ActionCtx, RegisterRoutesConfig, ConvexFSOptions, HttpRouter } from "./types.js";
import type { FileMetadata } from "../component/types.js";
export type { Config, FileMetadata, Op, Dest } from "../component/types.js";
export type { ConflictErrorData, ConflictCode } from "../component/types.js";
export { isConflictError } from "../component/types.js";
export type { QueryCtx, MutationCtx, ActionCtx, RegisterRoutesConfig, ConvexFSOptions, };
export type FSComponent = ComponentApi;
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
export declare class ConvexFS {
    component: ComponentApi;
    private options;
    constructor(component: ComponentApi, options: ConvexFSOptions);
    /**
     * Build config from options.
     * Used internally and by registerRoutes for the upload proxy.
     */
    get config(): {
        storage: import("./types.js").StorageConfig;
        downloadUrlTtl: number | undefined;
        blobGracePeriod: number | undefined;
    };
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
    commitFiles(ctx: MutationCtx, files: Array<{
        path: string;
        blobId: string;
        basis?: string | null;
    }>): Promise<void>;
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
    getDownloadUrl(ctx: ActionCtx, blobId: string, opts?: {
        extraParams?: Record<string, string>;
    }): Promise<string>;
    /**
     * Create a direct-upload URL for a new blob.
     *
     * For Bunny, this requires `uploadMode: "bunny-edge-presigned"` and a
     * configured standalone Edge Script signer. The returned URL is for the data
     * plane only: after the client receives a successful upload response, call
     * `registerUploadedBlob()` and then `commitFiles()`.
     */
    createUploadUrl(opts: {
        size: number;
        checksum: string;
        expiresIn?: number;
    }): Promise<{
        blobId: string;
        uploadUrl: string;
    }>;
    /**
     * Register a blob after a direct upload has succeeded.
     *
     * This records metadata for commit validation and orphan cleanup. Keep this
     * behind your app's auth boundary; it trusts the caller's successful upload
     * result and does not stream or re-fetch blob bytes through Convex.
     */
    registerUploadedBlob(ctx: MutationCtx, upload: {
        blobId: string;
        contentType: string;
        size: number;
    }): Promise<void>;
    /**
     * Get a blob as a stream by blobId.
     *
     * This fetches the download URL from the component, then streams
     * the blob directly from storage in the caller's execution context.
     * Returns null if the blob doesn't exist.
     */
    getBlobStream(ctx: ActionCtx, blobId: string): Promise<ReadableStream<Uint8Array> | null>;
    /**
     * Get a file's contents and metadata by path as a stream.
     *
     * This looks up file metadata in the control plane, then streams
     * the blob directly from storage in the caller's execution context.
     */
    getFileStream(ctx: ActionCtx, path: string): Promise<{
        stream: ReadableStream<Uint8Array>;
        contentType: string;
        size: number;
    } | null>;
    /**
     * Write a stream to blob storage.
     *
     * Uploads the stream directly to blob storage in the caller's execution
     * context, then registers the pending upload with the component.
     * If contentLength is omitted, bytes are counted while streaming so the
     * control plane still records the final size.
     */
    writeBlobStream(ctx: ActionCtx, stream: ReadableStream<Uint8Array>, contentType: string, opts?: {
        contentLength?: number;
    }): Promise<{
        blobId: string;
        size: number;
    }>;
    /**
     * Write a stream directly to a file path.
     *
     * This composes upload, pending-upload registration, and commit.
     * If the commit fails after upload registration, the pending upload is left
     * in place for existing upload GC to clean up.
     */
    writeFileStream(ctx: ActionCtx, path: string, stream: ReadableStream<Uint8Array>, contentType: string, opts?: {
        contentLength?: number;
    }): Promise<{
        blobId: string;
        size: number;
    }>;
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
    stat(ctx: QueryCtx, path: string): Promise<{
        path: string;
        blobId: string;
        contentType: string;
        size: number;
    } | null>;
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
    list(ctx: QueryCtx, options: {
        prefix?: string;
        paginationOpts: PaginationOptions;
    }): Promise<PaginationResult<FileMetadata>>;
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
    transact(ctx: MutationCtx, ops: Array<{
        op: "move";
        source: {
            path: string;
            blobId: string;
            contentType: string;
            size: number;
            attributes?: {
                expiresAt?: number;
            };
        };
        dest: {
            path: string;
            basis?: string | null;
        };
    } | {
        op: "copy";
        source: {
            path: string;
            blobId: string;
            contentType: string;
            size: number;
            attributes?: {
                expiresAt?: number;
            };
        };
        dest: {
            path: string;
            basis?: string | null;
        };
    } | {
        op: "delete";
        source: {
            path: string;
            blobId: string;
            contentType: string;
            size: number;
            attributes?: {
                expiresAt?: number;
            };
        };
    } | {
        op: "setAttributes";
        source: {
            path: string;
            blobId: string;
            contentType: string;
            size: number;
            attributes?: {
                expiresAt?: number;
            };
        };
        attributes: {
            expiresAt?: number | null;
        };
    }>): Promise<void>;
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
    copy(ctx: MutationCtx, sourcePath: string, destPath: string): Promise<void>;
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
    move(ctx: MutationCtx, sourcePath: string, destPath: string): Promise<void>;
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
    delete(ctx: MutationCtx, path: string): Promise<void>;
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
export declare function registerRoutes(http: HttpRouter, component: ComponentApi, fs: ConvexFS, config: RegisterRoutesConfig): void;
/**
 * Build a download URL for the given blob.
 * @param siteUrl - The site URL
 * @param prefix - The path prefix
 * @param blobId - The ID of the blob
 * @param path - The path of the file being downloaded
 * @param params - Additional query parameters to pass through to the CDN (JSON-encoded in cdn-params)
 * @returns The download URL
 */
export declare function buildDownloadUrl(siteUrl: string, prefix: string, blobId: string, path?: string, params?: Record<string, string>): string;
/**
 * Parse a download URL into a blob ID and path.
 * @param url - The download URL
 * @returns The blob ID and path
 */
export declare function parseDownloadUrl(url: string): {
    blobId: string;
    path?: string;
};
export default ConvexFS;
//# sourceMappingURL=index.d.ts.map