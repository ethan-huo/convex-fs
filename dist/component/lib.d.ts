/**
 * Main entry point for the file storage component.
 * Re-exports all public API.
 *
 * Architecture: The component is CONTROL PLANE ONLY.
 * - All metadata operations (stat, list, commit, transact) run here
 * - URL generation (getDownloadUrl) runs here
 * - Pending upload registration runs here
 * - Actual blob I/O (uploads, downloads) happens in the caller's context
 */
export { stat, list, copyByPath, moveByPath, deleteByPath, } from "./ops/basics.js";
export { commitFiles, transact } from "./ops/transact.js";
export { getDownloadUrl, registerPendingUpload } from "./transfer.js";
export { configValidator, fileMetadataValidator, destValidator, opValidator, } from "./types.js";
export type { Config, FileMetadata, Dest, Op } from "./types.js";
//# sourceMappingURL=lib.d.ts.map