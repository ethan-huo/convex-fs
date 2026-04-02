/**
 * Internal validator for a single file in the commit.
 * basis: undefined = overwrite, null = must not exist, string = must match
 * attributes: optional file attributes to set on the path
 */
export declare const fileCommitValidator: import("convex/values").VObject<{
    attributes?: {
        expiresAt?: number | undefined;
    } | undefined;
    basis?: string | null | undefined;
    path: string;
    blobId: string;
}, {
    path: import("convex/values").VString<string, "required">;
    blobId: import("convex/values").VString<string, "required">;
    basis: import("convex/values").VUnion<string | null | undefined, [import("convex/values").VNull<null, "required">, import("convex/values").VString<string, "required">], "optional", never>;
    attributes: import("convex/values").VObject<{
        expiresAt?: number | undefined;
    } | undefined, {
        expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "optional", "expiresAt">;
}, "required", "path" | "blobId" | "attributes" | "attributes.expiresAt" | "basis">;
//# sourceMappingURL=types.d.ts.map