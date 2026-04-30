export type { BlobStore, BunnyBlobStoreConfig, TestBlobStoreConfig, UploadUrlOptions, DownloadUrlOptions, PutOptions, DeleteResult, BunnyEdgeUploadConfig, BunnyStorageConfig, TestStorageConfig, StorageConfig, } from "./types.js";
export { createBunnyBlobStore } from "./bunny.js";
export { createTestBlobStore } from "./test.js";
import type { BlobStore, StorageConfig } from "./types.js";
/**
 * Factory function that creates the appropriate BlobStore based on config type.
 */
export declare function createBlobStore(config: StorageConfig): BlobStore;
//# sourceMappingURL=index.d.ts.map