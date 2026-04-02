import { type Infer } from "convex/values";
/**
 * Validator for Bunny.net Edge Storage configuration.
 */
export declare const bunnyStorageConfigValidator: import("convex/values").VObject<{
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
}, "required", "apiKey" | "storageZoneName" | "region" | "cdnHostname" | "tokenKey" | "type">;
/** TypeScript type for Bunny storage config. */
export type BunnyStorageConfig = Infer<typeof bunnyStorageConfigValidator>;
/**
 * Validator for in-memory test storage configuration.
 *
 * NOT for production use - blobs are stored in-memory and don't persist
 * across Convex function invocations. This is only useful in convex-test.
 */
export declare const testStorageConfigValidator: import("convex/values").VObject<{
    type: "test";
}, {
    type: import("convex/values").VLiteral<"test", "required">;
}, "required", "type">;
/** TypeScript type for test storage config. */
export type TestStorageConfig = Infer<typeof testStorageConfigValidator>;
/**
 * Storage backend configuration validator.
 * Supports Bunny.net Edge Storage and in-memory test storage.
 */
export declare const storageConfigValidator: import("convex/values").VUnion<{
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
/** TypeScript type for storage config. */
export type StorageConfig = Infer<typeof storageConfigValidator>;
/**
 * Validator for full storage configuration.
 * Pass this as an argument to component queries/mutations/actions.
 */
export declare const configValidator: import("convex/values").VObject<{
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
}, "required", "storage" | "downloadUrlTtl" | "blobGracePeriod" | "storage.apiKey" | "storage.storageZoneName" | "storage.region" | "storage.cdnHostname" | "storage.tokenKey" | "storage.type">;
/** TypeScript type derived from the config validator. */
export type Config = Infer<typeof configValidator>;
/**
 * Validator for file attributes stored on the path.
 * Attributes are cleared on move/copy operations.
 */
export declare const fileAttributesValidator: import("convex/values").VObject<{
    expiresAt?: number | undefined;
}, {
    expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
}, "required", "expiresAt">;
/** TypeScript type for file attributes. */
export type FileAttributes = Infer<typeof fileAttributesValidator>;
/**
 * Validator for file metadata returned by stat and other queries.
 */
export declare const fileMetadataValidator: import("convex/values").VObject<{
    attributes?: {
        expiresAt?: number | undefined;
    } | undefined;
    path: string;
    blobId: string;
    contentType: string;
    size: number;
}, {
    path: import("convex/values").VString<string, "required">;
    blobId: import("convex/values").VString<string, "required">;
    contentType: import("convex/values").VString<string, "required">;
    size: import("convex/values").VFloat64<number, "required">;
    attributes: import("convex/values").VObject<{
        expiresAt?: number | undefined;
    } | undefined, {
        expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "optional", "expiresAt">;
}, "required", "path" | "blobId" | "contentType" | "size" | "attributes" | "attributes.expiresAt">;
/** TypeScript type for file metadata. */
export type FileMetadata = Infer<typeof fileMetadataValidator>;
/**
 * Validator for setAttributes input.
 * - undefined: don't change this attribute
 * - null: clear this attribute
 * - value: set this attribute
 */
export declare const setAttributesInputValidator: import("convex/values").VObject<{
    expiresAt?: number | null | undefined;
}, {
    expiresAt: import("convex/values").VUnion<number | null | undefined, [import("convex/values").VNull<null, "required">, import("convex/values").VFloat64<number, "required">], "optional", never>;
}, "required", "expiresAt">;
/** TypeScript type for setAttributes input. */
export type SetAttributesInput = Infer<typeof setAttributesInputValidator>;
/**
 * Validator for destination in move/copy operations.
 *
 * The `basis` field controls overwrite behavior:
 * - `undefined`: No check - silently overwrite if dest exists
 * - `null`: Dest must not exist (fails if file exists)
 * - `string`: Dest blobId must match this value (CAS update)
 */
export declare const destValidator: import("convex/values").VObject<{
    basis?: string | null | undefined;
    path: string;
}, {
    path: import("convex/values").VString<string, "required">;
    basis: import("convex/values").VUnion<string | null | undefined, [import("convex/values").VNull<null, "required">, import("convex/values").VString<string, "required">], "optional", never>;
}, "required", "path" | "basis">;
/** TypeScript type for destination. */
export type Dest = Infer<typeof destValidator>;
/**
 * Validators for transact operations.
 */
export declare const moveOpValidator: import("convex/values").VObject<{
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
}, {
    op: import("convex/values").VLiteral<"move", "required">;
    source: import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        path: string;
        blobId: string;
        contentType: string;
        size: number;
    }, {
        path: import("convex/values").VString<string, "required">;
        blobId: import("convex/values").VString<string, "required">;
        contentType: import("convex/values").VString<string, "required">;
        size: import("convex/values").VFloat64<number, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "path" | "blobId" | "contentType" | "size" | "attributes" | "attributes.expiresAt">;
    dest: import("convex/values").VObject<{
        basis?: string | null | undefined;
        path: string;
    }, {
        path: import("convex/values").VString<string, "required">;
        basis: import("convex/values").VUnion<string | null | undefined, [import("convex/values").VNull<null, "required">, import("convex/values").VString<string, "required">], "optional", never>;
    }, "required", "path" | "basis">;
}, "required", "op" | "source" | "dest" | "source.path" | "source.blobId" | "source.contentType" | "source.size" | "source.attributes" | "source.attributes.expiresAt" | "dest.path" | "dest.basis">;
export declare const copyOpValidator: import("convex/values").VObject<{
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
}, {
    op: import("convex/values").VLiteral<"copy", "required">;
    source: import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        path: string;
        blobId: string;
        contentType: string;
        size: number;
    }, {
        path: import("convex/values").VString<string, "required">;
        blobId: import("convex/values").VString<string, "required">;
        contentType: import("convex/values").VString<string, "required">;
        size: import("convex/values").VFloat64<number, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "path" | "blobId" | "contentType" | "size" | "attributes" | "attributes.expiresAt">;
    dest: import("convex/values").VObject<{
        basis?: string | null | undefined;
        path: string;
    }, {
        path: import("convex/values").VString<string, "required">;
        basis: import("convex/values").VUnion<string | null | undefined, [import("convex/values").VNull<null, "required">, import("convex/values").VString<string, "required">], "optional", never>;
    }, "required", "path" | "basis">;
}, "required", "op" | "source" | "dest" | "source.path" | "source.blobId" | "source.contentType" | "source.size" | "source.attributes" | "source.attributes.expiresAt" | "dest.path" | "dest.basis">;
export declare const deleteOpValidator: import("convex/values").VObject<{
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
}, {
    op: import("convex/values").VLiteral<"delete", "required">;
    source: import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        path: string;
        blobId: string;
        contentType: string;
        size: number;
    }, {
        path: import("convex/values").VString<string, "required">;
        blobId: import("convex/values").VString<string, "required">;
        contentType: import("convex/values").VString<string, "required">;
        size: import("convex/values").VFloat64<number, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "path" | "blobId" | "contentType" | "size" | "attributes" | "attributes.expiresAt">;
}, "required", "op" | "source" | "source.path" | "source.blobId" | "source.contentType" | "source.size" | "source.attributes" | "source.attributes.expiresAt">;
export declare const setAttributesOpValidator: import("convex/values").VObject<{
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
}, {
    op: import("convex/values").VLiteral<"setAttributes", "required">;
    source: import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        path: string;
        blobId: string;
        contentType: string;
        size: number;
    }, {
        path: import("convex/values").VString<string, "required">;
        blobId: import("convex/values").VString<string, "required">;
        contentType: import("convex/values").VString<string, "required">;
        size: import("convex/values").VFloat64<number, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "path" | "blobId" | "contentType" | "size" | "attributes" | "attributes.expiresAt">;
    attributes: import("convex/values").VObject<{
        expiresAt?: number | null | undefined;
    }, {
        expiresAt: import("convex/values").VUnion<number | null | undefined, [import("convex/values").VNull<null, "required">, import("convex/values").VFloat64<number, "required">], "optional", never>;
    }, "required", "expiresAt">;
}, "required", "attributes" | "attributes.expiresAt" | "op" | "source" | "source.path" | "source.blobId" | "source.contentType" | "source.size" | "source.attributes" | "source.attributes.expiresAt">;
export declare const opValidator: import("convex/values").VUnion<{
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
}, [import("convex/values").VObject<{
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
}, {
    op: import("convex/values").VLiteral<"move", "required">;
    source: import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        path: string;
        blobId: string;
        contentType: string;
        size: number;
    }, {
        path: import("convex/values").VString<string, "required">;
        blobId: import("convex/values").VString<string, "required">;
        contentType: import("convex/values").VString<string, "required">;
        size: import("convex/values").VFloat64<number, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "path" | "blobId" | "contentType" | "size" | "attributes" | "attributes.expiresAt">;
    dest: import("convex/values").VObject<{
        basis?: string | null | undefined;
        path: string;
    }, {
        path: import("convex/values").VString<string, "required">;
        basis: import("convex/values").VUnion<string | null | undefined, [import("convex/values").VNull<null, "required">, import("convex/values").VString<string, "required">], "optional", never>;
    }, "required", "path" | "basis">;
}, "required", "op" | "source" | "dest" | "source.path" | "source.blobId" | "source.contentType" | "source.size" | "source.attributes" | "source.attributes.expiresAt" | "dest.path" | "dest.basis">, import("convex/values").VObject<{
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
}, {
    op: import("convex/values").VLiteral<"copy", "required">;
    source: import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        path: string;
        blobId: string;
        contentType: string;
        size: number;
    }, {
        path: import("convex/values").VString<string, "required">;
        blobId: import("convex/values").VString<string, "required">;
        contentType: import("convex/values").VString<string, "required">;
        size: import("convex/values").VFloat64<number, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "path" | "blobId" | "contentType" | "size" | "attributes" | "attributes.expiresAt">;
    dest: import("convex/values").VObject<{
        basis?: string | null | undefined;
        path: string;
    }, {
        path: import("convex/values").VString<string, "required">;
        basis: import("convex/values").VUnion<string | null | undefined, [import("convex/values").VNull<null, "required">, import("convex/values").VString<string, "required">], "optional", never>;
    }, "required", "path" | "basis">;
}, "required", "op" | "source" | "dest" | "source.path" | "source.blobId" | "source.contentType" | "source.size" | "source.attributes" | "source.attributes.expiresAt" | "dest.path" | "dest.basis">, import("convex/values").VObject<{
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
}, {
    op: import("convex/values").VLiteral<"delete", "required">;
    source: import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        path: string;
        blobId: string;
        contentType: string;
        size: number;
    }, {
        path: import("convex/values").VString<string, "required">;
        blobId: import("convex/values").VString<string, "required">;
        contentType: import("convex/values").VString<string, "required">;
        size: import("convex/values").VFloat64<number, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "path" | "blobId" | "contentType" | "size" | "attributes" | "attributes.expiresAt">;
}, "required", "op" | "source" | "source.path" | "source.blobId" | "source.contentType" | "source.size" | "source.attributes" | "source.attributes.expiresAt">, import("convex/values").VObject<{
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
}, {
    op: import("convex/values").VLiteral<"setAttributes", "required">;
    source: import("convex/values").VObject<{
        attributes?: {
            expiresAt?: number | undefined;
        } | undefined;
        path: string;
        blobId: string;
        contentType: string;
        size: number;
    }, {
        path: import("convex/values").VString<string, "required">;
        blobId: import("convex/values").VString<string, "required">;
        contentType: import("convex/values").VString<string, "required">;
        size: import("convex/values").VFloat64<number, "required">;
        attributes: import("convex/values").VObject<{
            expiresAt?: number | undefined;
        } | undefined, {
            expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "optional", "expiresAt">;
    }, "required", "path" | "blobId" | "contentType" | "size" | "attributes" | "attributes.expiresAt">;
    attributes: import("convex/values").VObject<{
        expiresAt?: number | null | undefined;
    }, {
        expiresAt: import("convex/values").VUnion<number | null | undefined, [import("convex/values").VNull<null, "required">, import("convex/values").VFloat64<number, "required">], "optional", never>;
    }, "required", "expiresAt">;
}, "required", "attributes" | "attributes.expiresAt" | "op" | "source" | "source.path" | "source.blobId" | "source.contentType" | "source.size" | "source.attributes" | "source.attributes.expiresAt">], "required", "attributes" | "attributes.expiresAt" | "op" | "source" | "dest" | "source.path" | "source.blobId" | "source.contentType" | "source.size" | "source.attributes" | "source.attributes.expiresAt" | "dest.path" | "dest.basis">;
/** TypeScript type for a transact operation. */
export type Op = Infer<typeof opValidator>;
/** TypeScript type for setAttributes operation. */
export type SetAttributesOp = Infer<typeof setAttributesOpValidator>;
/**
 * Conflict error codes for ConvexFS operations.
 *
 * These indicate OCC-style conflicts where the caller's assumed state
 * doesn't match reality. The appropriate response is to re-read current
 * state and retry.
 */
export type ConflictCode = "SOURCE_NOT_FOUND" | "SOURCE_CHANGED" | "DEST_EXISTS" | "DEST_NOT_FOUND" | "DEST_CHANGED" | "CAS_CONFLICT";
/**
 * Conflict error data - thrown via ConvexError when an OCC-style
 * conflict occurs. Callers should re-read current state and retry.
 *
 * @example
 * ```typescript
 * import { ConvexError } from "convex/values";
 * import { isConflictError } from "convex-fs";
 *
 * try {
 *   await fs.commitFiles(ctx, [{ path, blobId, basis: expectedBlobId }]);
 * } catch (e) {
 *   if (e instanceof ConvexError && isConflictError(e.data)) {
 *     // Re-read current state and retry
 *     const current = await fs.stat(ctx, path);
 *     // ... retry logic
 *   }
 *   throw e;
 * }
 * ```
 */
export type ConflictErrorData = {
    type: "conflict";
    code: ConflictCode;
    message: string;
    path: string;
    expected?: string | null;
    found?: string | null;
    operationIndex?: number;
};
/**
 * Type guard to check if ConvexError data is a conflict error.
 *
 * @example
 * ```typescript
 * if (e instanceof ConvexError && isConflictError(e.data)) {
 *   console.log(`Conflict at ${e.data.path}: ${e.data.code}`);
 * }
 * ```
 */
export declare function isConflictError(data: unknown): data is ConflictErrorData;
//# sourceMappingURL=types.d.ts.map