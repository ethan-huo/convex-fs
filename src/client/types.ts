import type {
  HttpRouter,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDataModel,
} from "convex/server";

/**
 * Minimal query context type for running component queries.
 */
export type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;

/**
 * Minimal mutation context type for running component queries and mutations.
 */
export type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;

/**
 * Minimal action context type for running component queries, mutations, and actions.
 */
export type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

/**
 * HTTP action context with auth support.
 */
export type HttpActionCtx = GenericActionCtx<GenericDataModel>;

/**
 * Request context handed to {@link UploadAuthCallback}.
 *
 * Everything here is client-supplied. Treat it as untrusted input: use it as a
 * lookup key and derive authority from `ctx.auth`, never from the values
 * themselves.
 *
 * The request body is deliberately absent. Uploads stream straight through to
 * storage in constant memory, so reading the body in an auth callback would
 * both consume the stream and risk exhausting the action's memory budget.
 */
export interface UploadRequestInfo {
  /** Full request URL, including the query string. */
  url: string;
  /** Request headers. */
  headers: Headers;
  /** Query parameters parsed from the URL. */
  params: Record<string, string>;
  /** Content-Type header, defaulting to "application/octet-stream". */
  contentType: string;
  /**
   * The client's declared Content-Length, when it sent one.
   *
   * This is a claim, not a fact -- a client may understate it or omit it
   * entirely by using chunked encoding. Useful for cheaply rejecting an
   * upload before any bytes move, but it is not enforcement. To actually cap
   * an upload, return {@link UploadAuthDecision.maxBytes}, which is enforced
   * by counting the bytes as they stream.
   */
  contentLength?: number;
}

/**
 * A richer {@link UploadAuthCallback} result, allowing per-request limits.
 *
 * Because the callback runs inline in the same request that carries the body,
 * these constraints never round-trip through the client and need no signing.
 */
export interface UploadAuthDecision {
  /** Whether to accept the upload. */
  allowed: boolean;
  /**
   * Hard cap, in bytes, for this upload.
   *
   * Enforced while streaming: once exceeded, the upload is aborted, any
   * partial object is deleted from storage, and the caller receives a 413.
   * Omit for no limit.
   */
  maxBytes?: number;
}

/**
 * Auth callback for uploads.
 * Called before an upload is accepted, in the same request that carries the
 * body and before any of it is read.
 *
 * Return `true`/`false` to allow or deny, or a {@link UploadAuthDecision} to
 * allow with a per-request byte cap.
 *
 * @param ctx - The HTTP action context
 * @param info - Client-supplied request context; see {@link UploadRequestInfo}
 *
 * @example
 * ```typescript
 * uploadAuth: async (ctx, info) => {
 *   const identity = await ctx.auth.getUserIdentity();
 *   if (!identity) return false;
 *
 *   // params.projectId is untrusted -- it is only a lookup key here
 *   const project = await ctx.runQuery(api.projects.forUser, {
 *     projectId: info.params.projectId,
 *     user: identity.subject,
 *   });
 *   if (!project) return false;
 *
 *   return { allowed: true, maxBytes: project.remainingQuota };
 * }
 * ```
 */
export type UploadAuthCallback = (
  ctx: HttpActionCtx,
  info: UploadRequestInfo,
) => Promise<boolean | UploadAuthDecision>;

/**
 * Auth callback for downloads.
 * Called before redirecting to the download URL.
 * Return true to allow access, false to deny.
 *
 * @param ctx - The HTTP action context
 * @param blobId - The blob ID being downloaded
 * @param path - The path of the file being downloaded (if provided in request)
 * @param extraParams - Any extra query params from the request that will be passed to the CDN
 */
export type DownloadAuthCallback = (
  ctx: HttpActionCtx,
  blobId: string,
  path?: string,
  extraParams?: Record<string, string>,
) => Promise<boolean>;

// =============================================================================
// Storage Configuration Types (re-exported from blobstore)
// =============================================================================

export type {
  BunnyStorageConfig,
  TestStorageConfig,
  StorageConfig,
} from "../blobstore/index.js";

// =============================================================================
// ConvexFS Options
// =============================================================================

// Import for use in ConvexFSOptions
import type { StorageConfig } from "../blobstore/index.js";

/**
 * Options for ConvexFS constructor.
 */
export interface ConvexFSOptions {
  /** Storage backend configuration */
  storage: StorageConfig;

  /** Download URL TTL in seconds. Defaults to 3600 (1 hour) */
  downloadUrlTtl?: number;

  /** Grace period (in seconds) before orphaned blobs are deleted. Defaults to 86400 (24 hours) */
  blobGracePeriod?: number;
}

/**
 * Configuration for registerRoutes().
 */
export interface RegisterRoutesConfig {
  /** Path prefix for routes. Defaults to "/fs" */
  pathPrefix?: string;

  /** Auth callback for uploads - called before upload is accepted */
  uploadAuth: UploadAuthCallback;

  /** Auth callback for downloads - called before redirecting to download URL */
  downloadAuth: DownloadAuthCallback;

  /**
   * Extra request headers to permit on cross-origin requests.
   *
   * Merged with the built-in set ("Content-Type", "Content-Length",
   * "Authorization"). Add any custom header your client sends -- for example
   * "X-Project-Id" -- or the browser's preflight will reject the upload.
   * Headers are preferable to query parameters for anything sensitive, since
   * query strings end up in CDN logs, Convex logs and Referer headers.
   */
  allowedHeaders?: string[];
}

export type { HttpRouter };
