/**
 * Config storage for background jobs.
 *
 * Components can't access env vars, so we store config in the database
 * when it's first provided via client operations.
 */
export declare function checksum(obj: unknown): Promise<string>;
/**
 * Get stored config by key.
 */
export declare const getConfig: import("convex/server").RegisteredQuery<"internal", {
    key: string;
}, Promise<{
    key: string;
    value: {
        downloadUrlTtl?: number | undefined;
        blobGracePeriod?: number | undefined;
        freezeGc?: boolean | undefined;
        allowClearAllFiles?: boolean | undefined;
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
} | null>>;
/**
 * Store or update config.
 * Called by prepareUpload to ensure config is available for GC.
 *
 * Updates all client-provided config values, but preserves the dashboard-only
 * `freezeGc` field (which can only be set manually via the Convex dashboard).
 */
export declare const ensureConfigStored: import("convex/server").RegisteredMutation<"internal", {
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
}, Promise<null>>;
//# sourceMappingURL=config.d.ts.map