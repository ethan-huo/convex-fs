/**
 * Background jobs for the file storage component.
 *
 * - UGC: GC for expired/abandoned uploads (runs at :00)
 * - BGC: GC for orphaned blobs with refCount=0 (runs at :20)
 */
/**
 * Find expired upload records.
 *
 * Returns uploads where expiresAt < threshold, up to the specified limit.
 */
export declare const findExpiredUploads: import("convex/server").RegisteredQuery<"internal", {
    limit: number;
    threshold: number;
}, Promise<{
    _id: import("convex/values").GenericId<"uploads">;
    blobId: string;
    expiresAt: number;
}[]>>;
/**
 * Delete upload records by ID.
 */
export declare const deleteUploadRecords: import("convex/server").RegisteredMutation<"internal", {
    ids: import("convex/values").GenericId<"uploads">[];
}, Promise<null>>;
/**
 * GC expired uploads.
 *
 * Finds uploads where the upload has expired (plus grace period),
 * deletes the blobs from storage, and removes the upload records.
 *
 * Only self-schedules if batch was full AND no storage errors occurred
 * (to avoid hammering storage during outages).
 */
export declare const gcExpiredUploads: import("convex/server").RegisteredAction<"internal", {}, Promise<null>>;
/**
 * Find orphaned blobs (refCount=0, updatedAt older than threshold).
 */
export declare const findOrphanedBlobs: import("convex/server").RegisteredQuery<"internal", {
    limit: number;
    threshold: number;
}, Promise<{
    _id: import("convex/values").GenericId<"blobs">;
    blobId: string;
}[]>>;
/**
 * Delete blob records by ID.
 */
export declare const deleteBlobRecords: import("convex/server").RegisteredMutation<"internal", {
    ids: import("convex/values").GenericId<"blobs">[];
}, Promise<null>>;
/**
 * GC orphaned blobs.
 *
 * Finds blobs with refCount=0 that have been orphaned for longer than
 * the grace period, deletes them from storage, and removes the blob records.
 *
 * Only self-schedules if batch was full AND no storage errors occurred
 * (to avoid hammering storage during outages).
 */
export declare const gcOrphanedBlobs: import("convex/server").RegisteredAction<"internal", {}, Promise<null>>;
/**
 * Find expired files (attributes.expiresAt < threshold).
 *
 * Uses gt(0) to exclude files without expiresAt (undefined values come
 * before all numbers in Convex index ordering).
 */
export declare const findExpiredFiles: import("convex/server").RegisteredQuery<"internal", {
    limit: number;
    threshold: number;
}, Promise<{
    _id: import("convex/values").GenericId<"files">;
    path: string;
    blobId: string;
}[]>>;
/**
 * Delete expired file records and decrement blob refCounts.
 */
export declare const deleteExpiredFileRecords: import("convex/server").RegisteredMutation<"internal", {
    files: {
        blobId: string;
        _id: import("convex/values").GenericId<"files">;
    }[];
}, Promise<null>>;
/**
 * GC expired files.
 *
 * Finds files where attributes.expiresAt is in the past, deletes the file
 * records, and decrements blob refCounts. BGC will later clean up any
 * orphaned blobs from storage.
 *
 * NOTE: This does NOT check freezeGc because it doesn't delete storage data.
 * Blob data is preserved until BGC runs.
 */
export declare const gcExpiredFiles: import("convex/server").RegisteredAction<"internal", {}, Promise<null>>;
//# sourceMappingURL=background.d.ts.map