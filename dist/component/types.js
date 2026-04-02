import { v } from "convex/values";
/**
 * Validator for Bunny.net Edge Storage configuration.
 */
export const bunnyStorageConfigValidator = v.object({
    type: v.literal("bunny"),
    apiKey: v.string(),
    storageZoneName: v.string(),
    region: v.optional(v.string()),
    cdnHostname: v.string(), // Full hostname, e.g., "myzone.b-cdn.net" or custom domain
    tokenKey: v.optional(v.string()), // For token-authenticated Pull Zones
});
/**
 * Validator for in-memory test storage configuration.
 *
 * NOT for production use - blobs are stored in-memory and don't persist
 * across Convex function invocations. This is only useful in convex-test.
 */
export const testStorageConfigValidator = v.object({
    type: v.literal("test"),
});
/**
 * Storage backend configuration validator.
 * Supports Bunny.net Edge Storage and in-memory test storage.
 */
export const storageConfigValidator = v.union(bunnyStorageConfigValidator, testStorageConfigValidator);
/**
 * Validator for full storage configuration.
 * Pass this as an argument to component queries/mutations/actions.
 */
export const configValidator = v.object({
    // Storage backend configuration
    storage: storageConfigValidator,
    // Download URL TTL in seconds (defaults to 3600 / 1 hour)
    downloadUrlTtl: v.optional(v.number()),
    // GC configuration
    blobGracePeriod: v.optional(v.number()), // seconds before orphaned blobs are deleted, defaults to 86400 (24 hours)
    // NOTE: freezeGc is a dashboard-only field (not in client config) - set it manually
    // in the config table to freeze all GC jobs for emergency investigation/recovery
});
/**
 * Validator for file attributes stored on the path.
 * Attributes are cleared on move/copy operations.
 */
export const fileAttributesValidator = v.object({
    expiresAt: v.optional(v.number()), // Unix timestamp (ms) when file expires
});
/**
 * Validator for file metadata returned by stat and other queries.
 */
export const fileMetadataValidator = v.object({
    path: v.string(),
    blobId: v.string(),
    contentType: v.string(),
    size: v.number(),
    attributes: v.optional(fileAttributesValidator),
});
/**
 * Validator for setAttributes input.
 * - undefined: don't change this attribute
 * - null: clear this attribute
 * - value: set this attribute
 */
export const setAttributesInputValidator = v.object({
    expiresAt: v.optional(v.union(v.null(), v.number())),
});
/**
 * Validator for destination in move/copy operations.
 *
 * The `basis` field controls overwrite behavior:
 * - `undefined`: No check - silently overwrite if dest exists
 * - `null`: Dest must not exist (fails if file exists)
 * - `string`: Dest blobId must match this value (CAS update)
 */
export const destValidator = v.object({
    path: v.string(),
    basis: v.optional(v.union(v.null(), v.string())),
});
/**
 * Validators for transact operations.
 */
export const moveOpValidator = v.object({
    op: v.literal("move"),
    source: fileMetadataValidator,
    dest: destValidator,
});
export const copyOpValidator = v.object({
    op: v.literal("copy"),
    source: fileMetadataValidator,
    dest: destValidator,
});
export const deleteOpValidator = v.object({
    op: v.literal("delete"),
    source: fileMetadataValidator,
});
export const setAttributesOpValidator = v.object({
    op: v.literal("setAttributes"),
    source: fileMetadataValidator,
    attributes: setAttributesInputValidator,
});
export const opValidator = v.union(moveOpValidator, copyOpValidator, deleteOpValidator, setAttributesOpValidator);
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
export function isConflictError(data) {
    return (typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "conflict");
}
//# sourceMappingURL=types.js.map