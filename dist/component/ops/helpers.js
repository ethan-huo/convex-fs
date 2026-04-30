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
export async function deleteFileAndDecrefBlob(ctx, fileId, blobId, now) {
    // Delete file record
    await ctx.db.delete(fileId);
    // Decrement refCount on blob
    const blob = await ctx.db
        .query("blobs")
        .withIndex("blobId", (q) => q.eq("blobId", blobId))
        .unique();
    if (blob) {
        await ctx.db.patch(blob._id, {
            refCount: blob.refCount - 1,
            updatedAt: now,
        });
    }
}
//# sourceMappingURL=helpers.js.map