import type { BlobStore } from "./types.js";
/**
 * In-memory BlobStore for testing.
 *
 * NOT for production use - blobs are stored in-memory and don't persist
 * across Convex function invocations. This is only useful in convex-test
 * where everything runs in a single process.
 */
export declare function createTestBlobStore(): BlobStore & {
    /** Access stored blobs for test assertions */
    _blobs: Map<string, {
        data: Uint8Array;
        contentType: string;
    }>;
};
//# sourceMappingURL=test.d.ts.map