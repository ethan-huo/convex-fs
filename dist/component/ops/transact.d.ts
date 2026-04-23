export declare const commitFiles: import("convex/server").RegisteredMutation<"public", {
    config: {
        blobGracePeriod?: number | undefined;
        downloadUrlTtl?: number | undefined;
        storage: {
            apiKey: string;
            cdnHostname: string;
            region?: string | undefined;
            storageZoneName: string;
            tokenKey?: string | undefined;
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
        blobId: string;
        path: string;
    }[];
}, Promise<null>>;
export declare const transact: import("convex/server").RegisteredMutation<"public", {
    config: {
        blobGracePeriod?: number | undefined;
        downloadUrlTtl?: number | undefined;
        storage: {
            apiKey: string;
            cdnHostname: string;
            region?: string | undefined;
            storageZoneName: string;
            tokenKey?: string | undefined;
            type: "bunny";
        } | {
            type: "test";
        };
    };
    ops: ({
        dest: {
            basis?: string | null | undefined;
            path: string;
        };
        op: "move";
        source: {
            attributes?: {
                expiresAt?: number | undefined;
            } | undefined;
            blobId: string;
            contentType: string;
            path: string;
            size: number;
        };
    } | {
        dest: {
            basis?: string | null | undefined;
            path: string;
        };
        op: "copy";
        source: {
            attributes?: {
                expiresAt?: number | undefined;
            } | undefined;
            blobId: string;
            contentType: string;
            path: string;
            size: number;
        };
    } | {
        op: "delete";
        source: {
            attributes?: {
                expiresAt?: number | undefined;
            } | undefined;
            blobId: string;
            contentType: string;
            path: string;
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
            blobId: string;
            contentType: string;
            path: string;
            size: number;
        };
    })[];
}, Promise<null>>;
//# sourceMappingURL=transact.d.ts.map