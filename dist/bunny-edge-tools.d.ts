type FetchLike = typeof fetch;
export type BunnyEdgeUploadProvisionFailureKind = "missing_config" | "invalid_config" | "auth_failed" | "route_conflict" | "deployment_failed" | "bunny_api_error";
export type ProvisionBunnyEdgeUploadSignerOptions = {
    bunnyAccountApiKey: string;
    storageZoneName: string;
    storageAccessKey: string;
    region?: string;
    signerHostname: string;
    signerPath?: string;
    uploadPath?: string;
    signerName?: string;
    linkedPullZoneName?: string;
    signerAccessKey?: string;
    uploadTtlSeconds?: number;
    maxUploadBytes?: number;
    fetch?: FetchLike;
};
export type ProvisionBunnyEdgeUploadSignerSuccess = {
    ok: true;
    scriptId: number;
    pullZoneId: number | null;
    signUrl: string;
    accessKey: string;
    env: {
        BUNNY_EDGE_UPLOAD_SIGN_URL: string;
        BUNNY_EDGE_UPLOAD_ACCESS_KEY: string;
    };
};
export type ProvisionBunnyEdgeUploadSignerFailure = {
    ok: false;
    error: {
        kind: BunnyEdgeUploadProvisionFailureKind;
        message: string;
        status?: number;
        details?: unknown;
    };
};
export type ProvisionBunnyEdgeUploadSignerResult = ProvisionBunnyEdgeUploadSignerSuccess | ProvisionBunnyEdgeUploadSignerFailure;
/**
 * Provision or update the standalone Bunny Edge Script used by
 * uploadMode: "bunny-edge-presigned".
 *
 * This helper is for setup scripts, CI, and admin tooling only. Do not call it
 * from Convex functions or application runtime code because it requires the
 * account-level Bunny API key.
 */
export declare function provisionBunnyEdgeUploadSigner(options: ProvisionBunnyEdgeUploadSignerOptions): Promise<ProvisionBunnyEdgeUploadSignerResult>;
export {};
//# sourceMappingURL=bunny-edge-tools.d.ts.map