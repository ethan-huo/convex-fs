export { createBunnyBlobStore } from "./bunny.js";
export { createTestBlobStore } from "./test.js";
import { createBunnyBlobStore } from "./bunny.js";
import { createTestBlobStore } from "./test.js";
/**
 * Factory function that creates the appropriate BlobStore based on config type.
 */
export function createBlobStore(config) {
    switch (config.type) {
        case "bunny":
            return createBunnyBlobStore({
                apiKey: config.apiKey,
                storageZoneName: config.storageZoneName,
                region: config.region,
                cdnHostname: config.cdnHostname,
                tokenKey: config.tokenKey,
                uploadMode: config.uploadMode,
                edgeUpload: config.edgeUpload,
            });
        case "test":
            return createTestBlobStore();
        default:
            throw new Error(`Unknown storage type: ${config.type}`);
    }
}
//# sourceMappingURL=index.js.map