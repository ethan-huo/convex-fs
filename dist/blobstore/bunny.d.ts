import type { BlobStore, BunnyBlobStoreConfig } from "./types.js";
/**
 * Creates a BlobStore implementation backed by Bunny.net Edge Storage
 * with CDN delivery via Pull Zone.
 *
 * Note: Bunny.net does not support presigned upload URLs natively.
 * Use the HTTP upload proxy endpoint for client uploads instead.
 */
export declare function createBunnyBlobStore(config: BunnyBlobStoreConfig): BlobStore;
//# sourceMappingURL=bunny.d.ts.map