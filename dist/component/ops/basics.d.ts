export declare const stat: import("convex/server").RegisteredQuery<"public", {
    config: {
        downloadUrlTtl?: number | undefined;
        blobGracePeriod?: number | undefined;
        storage: {
            region?: string | undefined;
            tokenKey?: string | undefined;
            apiKey: string;
            storageZoneName: string;
            cdnHostname: string;
            type: "bunny";
        } | {
            type: "test";
        };
    };
    path: string;
}, Promise<{
    path: string;
    blobId: string;
    contentType: string;
    size: number;
    attributes: {
        expiresAt?: number | undefined;
    } | undefined;
} | null>>;
/**
 * List files in the filesystem with pagination.
 *
 * Returns files sorted alphabetically by path, with optional prefix filtering
 * and cursor-based pagination.
 *
 * This query is compatible with `usePaginatedQuery` from `convex-fs/react`.
 *
 * @example
 * ```typescript
 * // Server-side iteration
 * const result = await ctx.runQuery(api.lib.list, {
 *   config,
 *   prefix: "/uploads/",
 *   paginationOpts: { numItems: 50, cursor: null },
 * });
 *
 * // React with usePaginatedQuery
 * import { usePaginatedQuery } from "convex-fs/react";
 *
 * const { results, status, loadMore } = usePaginatedQuery(
 *   api.files.list,
 *   { prefix: "/uploads/" },
 *   { initialNumItems: 20 },
 * );
 * ```
 */
export declare const list: import("convex/server").RegisteredQuery<"public", {
    prefix?: string | undefined;
    config: {
        downloadUrlTtl?: number | undefined;
        blobGracePeriod?: number | undefined;
        storage: {
            region?: string | undefined;
            tokenKey?: string | undefined;
            apiKey: string;
            storageZoneName: string;
            cdnHostname: string;
            type: "bunny";
        } | {
            type: "test";
        };
    };
    paginationOpts: {
        id?: number;
        endCursor?: string | null;
        maximumRowsRead?: number;
        maximumBytesRead?: number;
        numItems: number;
        cursor: string | null;
    };
}, Promise<{
    page: {
        path: string;
        blobId: string;
        contentType: string;
        size: number;
        attributes: {
            expiresAt?: number | undefined;
        } | undefined;
    }[];
    continueCursor: string;
    isDone: boolean;
}>>;
/**
 * Copy a file to a new path.
 *
 * This is a convenience wrapper around `transact` for the common case of
 * copying a file to a path that doesn't exist.
 *
 * @throws If source file doesn't exist
 * @throws If destination already exists
 */
export declare const copyByPath: import("convex/server").RegisteredMutation<"public", {
    config: {
        downloadUrlTtl?: number | undefined;
        blobGracePeriod?: number | undefined;
        storage: {
            region?: string | undefined;
            tokenKey?: string | undefined;
            apiKey: string;
            storageZoneName: string;
            cdnHostname: string;
            type: "bunny";
        } | {
            type: "test";
        };
    };
    destPath: string;
    sourcePath: string;
}, Promise<null>>;
/**
 * Move a file to a new path.
 *
 * This is a convenience wrapper around `transact` for the common case of
 * moving a file to a path that doesn't exist.
 *
 * @throws If source file doesn't exist
 * @throws If destination already exists
 */
export declare const moveByPath: import("convex/server").RegisteredMutation<"public", {
    config: {
        downloadUrlTtl?: number | undefined;
        blobGracePeriod?: number | undefined;
        storage: {
            region?: string | undefined;
            tokenKey?: string | undefined;
            apiKey: string;
            storageZoneName: string;
            cdnHostname: string;
            type: "bunny";
        } | {
            type: "test";
        };
    };
    destPath: string;
    sourcePath: string;
}, Promise<null>>;
/**
 * Delete a file by path.
 *
 * This is a convenience wrapper around `transact` for the common case of
 * deleting a file. This operation is idempotent - if the file doesn't exist,
 * it's a no-op.
 */
export declare const deleteByPath: import("convex/server").RegisteredMutation<"public", {
    config: {
        downloadUrlTtl?: number | undefined;
        blobGracePeriod?: number | undefined;
        storage: {
            region?: string | undefined;
            tokenKey?: string | undefined;
            apiKey: string;
            storageZoneName: string;
            cdnHostname: string;
            type: "bunny";
        } | {
            type: "test";
        };
    };
    path: string;
}, Promise<null>>;
/**
 * Restore a file by re-linking an existing blob to a path.
 *
 * This is an admin utility for recovering accidentally deleted files.
 * It increments the blob's refCount and creates a new file record.
 *
 * NOTE: There's a small race condition if the blob is being GC'd at the
 * exact moment of restore. In practice this is unlikely since GC runs
 * periodically and has a grace period.
 *
 * @throws If blob doesn't exist (may have been garbage collected)
 */
export declare const restore: import("convex/server").RegisteredMutation<"internal", {
    path: string;
    blobId: string;
}, Promise<{
    path: string;
    blobId: string;
    contentType: string;
    size: number;
}>>;
/**
 * Delete all files from the filesystem.
 *
 * This is an internal dev utility that deletes files in batches of 100,
 * rescheduling itself until all files are gone. Orphaned blobs will be
 * cleaned up by the background garbage collector.
 *
 * Reads config from the config table (key: "storage").
 */
export declare const clearAllFiles: import("convex/server").RegisteredAction<"internal", {}, Promise<null>>;
//# sourceMappingURL=basics.d.ts.map