declare const _default: import("convex/server").SchemaDefinition<{
    uploads: import("convex/server").TableDefinition<import("convex/values").VObject<{
        contentType?: string | undefined;
        size?: number | undefined;
        blobId: string;
        expiresAt: number;
    }, {
        blobId: import("convex/values").VString<string, "required">;
        expiresAt: import("convex/values").VFloat64<number, "required">;
        contentType: import("convex/values").VString<string | undefined, "optional">;
        size: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "blobId" | "contentType" | "size" | "expiresAt">, {
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
    }, "required", "blobId" | "metadata" | "refCount" | "updatedAt" | "metadata.contentType" | "metadata.size">, {
        blobId: ["blobId", "_creationTime"];
        refCountUpdatedAt: ["refCount", "updatedAt", "_creationTime"];
    }, {}, {}>;
    files: import("convex/server").TableDefinition<import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        path: string;
        blobId: string;
    }, {
        blobId: import("convex/values").VString<string, "required">;
        path: import("convex/values").VString<string, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "path" | "blobId" | "attributes" | "attributes.expiresAt">, {
        path: ["path", "_creationTime"];
        expiresAt: ["attributes.expiresAt", "_creationTime"];
    }, {}, {}>;
    config: import("convex/server").TableDefinition<import("convex/values").VObject<{
        checksum?: string | undefined;
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
        key: string;
    }, {
        key: import("convex/values").VString<string, "required">;
        value: import("convex/values").VObject<{
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
        }, {
            storage: import("convex/values").VUnion<{
                region?: string | undefined;
                tokenKey?: string | undefined;
                apiKey: string;
                storageZoneName: string;
                cdnHostname: string;
                type: "bunny";
            } | {
                type: "test";
            }, [import("convex/values").VObject<{
                region?: string | undefined;
                tokenKey?: string | undefined;
                apiKey: string;
                storageZoneName: string;
                cdnHostname: string;
                type: "bunny";
            }, {
                type: import("convex/values").VLiteral<"bunny", "required">;
                apiKey: import("convex/values").VString<string, "required">;
                storageZoneName: import("convex/values").VString<string, "required">;
                region: import("convex/values").VString<string | undefined, "optional">;
                cdnHostname: import("convex/values").VString<string, "required">;
                tokenKey: import("convex/values").VString<string | undefined, "optional">;
            }, "required", "apiKey" | "storageZoneName" | "region" | "cdnHostname" | "tokenKey" | "type">, import("convex/values").VObject<{
                type: "test";
            }, {
                type: import("convex/values").VLiteral<"test", "required">;
            }, "required", "type">], "required", "apiKey" | "storageZoneName" | "region" | "cdnHostname" | "tokenKey" | "type">;
            downloadUrlTtl: import("convex/values").VFloat64<number | undefined, "optional">;
            blobGracePeriod: import("convex/values").VFloat64<number | undefined, "optional">;
            freezeGc: import("convex/values").VBoolean<boolean | undefined, "optional">;
            allowClearAllFiles: import("convex/values").VBoolean<boolean | undefined, "optional">;
        }, "required", "storage" | "downloadUrlTtl" | "blobGracePeriod" | "storage.apiKey" | "storage.storageZoneName" | "storage.region" | "storage.cdnHostname" | "storage.tokenKey" | "storage.type" | "freezeGc" | "allowClearAllFiles">;
        checksum: import("convex/values").VString<string | undefined, "optional">;
    }, "required", "value" | "key" | "checksum" | "value.storage" | "value.downloadUrlTtl" | "value.blobGracePeriod" | "value.storage.apiKey" | "value.storage.storageZoneName" | "value.storage.region" | "value.storage.cdnHostname" | "value.storage.tokenKey" | "value.storage.type" | "value.freezeGc" | "value.allowClearAllFiles">, {
        key: ["key", "_creationTime"];
    }, {}, {}>;
}, true>;
export default _default;
//# sourceMappingURL=schema.d.ts.map