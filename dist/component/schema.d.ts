declare const _default: import("convex/server").SchemaDefinition<{
    uploads: import("convex/server").TableDefinition<import("convex/values").VObject<{
        blobId: string;
        contentType?: string | undefined;
        expiresAt: number;
        size?: number | undefined;
    }, {
        blobId: import("convex/values").VString<string, "required">;
        expiresAt: import("convex/values").VFloat64<number, "required">;
        contentType: import("convex/values").VString<string | undefined, "optional">;
        size: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "blobId" | "contentType" | "expiresAt" | "size">, {
        blobId: ["blobId", "_creationTime"];
        expiresAt: ["expiresAt", "_creationTime"];
    }, {}, {}>;
    blobs: import("convex/server").TableDefinition<import("convex/values").VObject<{
        blobId: string;
        metadata: {
            contentType: string;
            size: number;
        };
        refCount: number;
        updatedAt: number;
    }, {
        blobId: import("convex/values").VString<string, "required">;
        metadata: import("convex/values").VObject<{
            contentType: string;
            size: number;
        }, {
            contentType: import("convex/values").VString<string, "required">;
            size: import("convex/values").VFloat64<number, "required">;
        }, "required", "contentType" | "size">;
        refCount: import("convex/values").VFloat64<number, "required">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "blobId" | "metadata" | "metadata.contentType" | "metadata.size" | "refCount" | "updatedAt">, {
        blobId: ["blobId", "_creationTime"];
        refCountUpdatedAt: ["refCount", "updatedAt", "_creationTime"];
    }, {}, {}>;
    files: import("convex/server").TableDefinition<import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        blobId: string;
        path: string;
    }, {
        blobId: import("convex/values").VString<string, "required">;
        path: import("convex/values").VString<string, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "attributes" | "attributes.expiresAt" | "blobId" | "path">, {
        expiresAt: ["attributes.expiresAt", "_creationTime"];
        path: ["path", "_creationTime"];
    }, {}, {}>;
    config: import("convex/server").TableDefinition<import("convex/values").VObject<{
        checksum?: string | undefined;
        key: string;
        value: {
            allowClearAllFiles?: boolean | undefined;
            blobGracePeriod?: number | undefined;
            downloadUrlTtl?: number | undefined;
            freezeGc?: boolean | undefined;
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
    }, {
        key: import("convex/values").VString<string, "required">;
        value: import("convex/values").VObject<{
            allowClearAllFiles?: boolean | undefined;
            blobGracePeriod?: number | undefined;
            downloadUrlTtl?: number | undefined;
            freezeGc?: boolean | undefined;
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
        }, {
            storage: import("convex/values").VUnion<{
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
            }, [import("convex/values").VObject<{
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
            }, {
                type: import("convex/values").VLiteral<"bunny", "required">;
                apiKey: import("convex/values").VString<string, "required">;
                storageZoneName: import("convex/values").VString<string, "required">;
                region: import("convex/values").VString<string | undefined, "optional">;
                cdnHostname: import("convex/values").VString<string, "required">;
                tokenKey: import("convex/values").VString<string | undefined, "optional">;
                uploadMode: import("convex/values").VUnion<"bunny-edge-presigned" | "convex-proxy" | undefined, [import("convex/values").VLiteral<"convex-proxy", "required">, import("convex/values").VLiteral<"bunny-edge-presigned", "required">], "optional", never>;
                edgeUpload: import("convex/values").VObject<{
                    accessKey?: string | undefined;
                    headers?: Record<string, string> | undefined;
                    signUrl: string;
                } | undefined, {
                    signUrl: import("convex/values").VString<string, "required">;
                    accessKey: import("convex/values").VString<string | undefined, "optional">;
                    headers: import("convex/values").VRecord<Record<string, string> | undefined, import("convex/values").VString<string, "required">, import("convex/values").VString<string, "required">, "optional", string>;
                }, "optional", "accessKey" | "headers" | "signUrl" | `headers.${string}`>;
            }, "required", "apiKey" | "cdnHostname" | "edgeUpload" | "edgeUpload.accessKey" | "edgeUpload.headers" | "edgeUpload.signUrl" | "region" | "storageZoneName" | "tokenKey" | "type" | "uploadMode" | `edgeUpload.headers.${string}`>, import("convex/values").VObject<{
                type: "test";
            }, {
                type: import("convex/values").VLiteral<"test", "required">;
            }, "required", "type">], "required", "apiKey" | "cdnHostname" | "edgeUpload" | "edgeUpload.accessKey" | "edgeUpload.headers" | "edgeUpload.signUrl" | "region" | "storageZoneName" | "tokenKey" | "type" | "uploadMode" | `edgeUpload.headers.${string}`>;
            downloadUrlTtl: import("convex/values").VFloat64<number | undefined, "optional">;
            blobGracePeriod: import("convex/values").VFloat64<number | undefined, "optional">;
            freezeGc: import("convex/values").VBoolean<boolean | undefined, "optional">;
            allowClearAllFiles: import("convex/values").VBoolean<boolean | undefined, "optional">;
        }, "required", "allowClearAllFiles" | "blobGracePeriod" | "downloadUrlTtl" | "freezeGc" | "storage" | "storage.apiKey" | "storage.cdnHostname" | "storage.edgeUpload" | "storage.edgeUpload.accessKey" | "storage.edgeUpload.headers" | "storage.edgeUpload.signUrl" | "storage.region" | "storage.storageZoneName" | "storage.tokenKey" | "storage.type" | "storage.uploadMode" | `storage.edgeUpload.headers.${string}`>;
        checksum: import("convex/values").VString<string | undefined, "optional">;
    }, "required", "checksum" | "key" | "value" | "value.allowClearAllFiles" | "value.blobGracePeriod" | "value.downloadUrlTtl" | "value.freezeGc" | "value.storage" | "value.storage.apiKey" | "value.storage.cdnHostname" | "value.storage.edgeUpload" | "value.storage.edgeUpload.accessKey" | "value.storage.edgeUpload.headers" | "value.storage.edgeUpload.signUrl" | "value.storage.region" | "value.storage.storageZoneName" | "value.storage.tokenKey" | "value.storage.type" | "value.storage.uploadMode" | `value.storage.edgeUpload.headers.${string}`>, {
        key: ["key", "_creationTime"];
    }, {}, {}>;
}, true>;
export default _default;
//# sourceMappingURL=schema.d.ts.map