export declare const commitFiles: import("convex/server").RegisteredMutation<"public", {
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
    files: {
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        basis?: string | null | undefined;
        path: string;
        blobId: string;
    }[];
}, Promise<null>>;
export declare const transact: import("convex/server").RegisteredMutation<"public", {
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
    ops: ({
        op: "move";
        source: {
            attributes?: {
                expiresAt?: number | undefined;
            } | undefined;
            path: string;
            blobId: string;
            contentType: string;
            size: number;
        };
        dest: {
            basis?: string | null | undefined;
            path: string;
        };
    } | {
        op: "copy";
        source: {
            attributes?: {
                expiresAt?: number | undefined;
            } | undefined;
            path: string;
            blobId: string;
            contentType: string;
            size: number;
        };
        dest: {
            basis?: string | null | undefined;
            path: string;
        };
    } | {
        op: "delete";
        source: {
            attributes?: {
                expiresAt?: number | undefined;
            } | undefined;
            path: string;
            blobId: string;
            contentType: string;
            size: number;
        };
    } | {
        attributes: {
            expiresAt?: number | null | undefined;
        };
        op: "setAttributes";
        source: {
            attributes?: {
                expiresAt?: number | undefined;
            } | undefined;
            path: string;
            blobId: string;
            contentType: string;
            size: number;
        };
    })[];
}, Promise<null>>;
//# sourceMappingURL=transact.d.ts.map