export declare const createUpload: import("convex/server").RegisteredMutation<"internal", {
    contentType?: string | undefined;
    size?: number | undefined;
    blobId: string;
    expiresAt: number;
}, Promise<import("convex/values").GenericId<"uploads">>>;
/**
 * Register a pending upload after the blob has been uploaded to storage.
 * Called by the client after uploading directly to the blob store.
 * This records the upload for GC tracking - uncommitted uploads will be
 * cleaned up after the grace period expires.
 */
export declare const registerPendingUpload: import("convex/server").RegisteredMutation<"public", {
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
    blobId: string;
    contentType: string;
    size: number;
}, Promise<null>>;
export declare const getUploadsByBlobIds: import("convex/server").RegisteredQuery<"internal", {
    blobIds: string[];
}, Promise<({
    blobId: string;
    contentType: string | undefined;
    size: number | undefined;
} | null)[]>>;
/**
 * Get a download URL for a blob.
 * For Bunny storage, this generates a signed CDN URL.
 *
 * Extra params will be included in the URL and, if token auth is enabled,
 * in the token signature. This allows passing params through to CDN edge rules.
 */
export declare const getDownloadUrl: import("convex/server").RegisteredAction<"public", {
    extraParams?: Record<string, string> | undefined;
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
    blobId: string;
}, Promise<string>>;
//# sourceMappingURL=transfer.d.ts.map