export declare const createUpload: import("convex/server").RegisteredMutation<"internal", {
    blobId: string;
    contentType?: string | undefined;
    expiresAt: number;
    size?: number | undefined;
}, Promise<import("convex/values").GenericId<"uploads">>>;
/**
 * Register a pending upload after the blob has been uploaded to storage.
 * Called by the client after uploading directly to the blob store.
 * This records the upload for GC tracking - uncommitted uploads will be
 * cleaned up after the grace period expires.
 */
export declare const registerPendingUpload: import("convex/server").RegisteredMutation<"public", {
    blobId: string;
    config: {
        blobGracePeriod?: number | undefined;
        downloadUrlTtl?: number | undefined;
        storage: {
            apiKey: string;
            cdnHostname: string;
            edgeUpload?: {
                accessKey?: string | undefined;
                headers?: Record<string, string> | undefined;
                signUrl: string;
            } | undefined;
            region?: string | undefined;
            storageZoneName: string;
            tokenKey?: string | undefined;
            type: "bunny";
            uploadMode?: "bunny-edge-presigned" | "convex-proxy" | undefined;
        } | {
            type: "test";
        };
    };
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
    blobId: string;
    config: {
        blobGracePeriod?: number | undefined;
        downloadUrlTtl?: number | undefined;
        storage: {
            apiKey: string;
            cdnHostname: string;
            edgeUpload?: {
                accessKey?: string | undefined;
                headers?: Record<string, string> | undefined;
                signUrl: string;
            } | undefined;
            region?: string | undefined;
            storageZoneName: string;
            tokenKey?: string | undefined;
            type: "bunny";
            uploadMode?: "bunny-edge-presigned" | "convex-proxy" | undefined;
        } | {
            type: "test";
        };
    };
    extraParams?: Record<string, string> | undefined;
}, Promise<string>>;
//# sourceMappingURL=transfer.d.ts.map