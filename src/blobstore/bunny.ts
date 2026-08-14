import type {
  BlobStore,
  DeleteResult,
  BunnyBlobStoreConfig,
  UploadUrlOptions,
  DownloadUrlOptions,
  PutOptions,
} from "./types.js";

const DEFAULT_TOKEN_TTL = 3600; // 1 hour

function assertBunnyEdgeUploadOptions(
  opts: UploadUrlOptions | undefined,
): asserts opts is UploadUrlOptions & {
  contentLength: number;
  checksum: string;
} {
  if (opts?.contentLength === undefined) {
    throw new Error(
      "Bunny edge presigned uploads require contentLength so the edge script can enforce maxSize.",
    );
  }
  if (!Number.isSafeInteger(opts.contentLength) || opts.contentLength < 0) {
    throw new Error("contentLength must be a non-negative safe integer.");
  }
  if (!opts.checksum) {
    throw new Error("Bunny edge presigned uploads require a SHA-256 checksum.");
  }
  if (!/^[a-fA-F0-9]{64}$/.test(opts.checksum)) {
    throw new Error("checksum must be a 64-character SHA-256 hex string.");
  }
}

async function parseUploadUrlResponse(response: Response): Promise<string> {
  const text = await response.text();
  const value = text.trim();

  if (!response.ok) {
    throw new Error(
      `Failed to sign Bunny upload URL: ${response.status} ${response.statusText}${value ? ` - ${value}` : ""}`,
    );
  }

  try {
    return new URL(value).toString();
  } catch {
    throw new Error("Bunny upload signer did not return a valid URL.");
  }
}

/**
 * Token scheme migration (0.3.0)
 * ------------------------------
 * Signed CDN URLs moved from Bunny's legacy `SHA256(security_key + message)`
 * digest to Advanced Token Authentication's `HMAC-SHA256` with an `HS256-`
 * prefix. Bunny switched all of their reference implementations over in
 * BunnyWay/BunnyCDN.TokenAuthentication@0f9af72 (2026-04-01) and their docs now
 * describe only the HMAC form.
 *
 * Why: the legacy construction hashes the secret as a prefix of the message,
 * which is the textbook length-extension-prone pattern that HMAC exists to
 * replace. Whether it is practically exploitable against Bunny depends on
 * internal byte handling we cannot audit (the glue padding is non-UTF-8, so it
 * likely cannot survive query-string decoding) -- but "probably fine given
 * assumptions we can't verify" is not a good place to leave URL signing. The
 * HMAC scheme is also the only one that can express directory tokens
 * (`token_path`, required for HLS/DASH segment auth), IP locking,
 * geo-restrictions and speed limits, should we want them.
 *
 * Risks considered, and why they were judged acceptable:
 *
 *   - "Existing signed URLs break." They do not. Bunny validates each request
 *     independently and currently accepts both schemes, so URLs minted before a
 *     deploy keep working until they expire (default TTL 1h). Verified against
 *     a live Pull Zone: legacy and HMAC tokens were both accepted on the same
 *     zone, with the same key, with no configuration change.
 *   - "Users must reconfigure their Pull Zone." They do not -- same
 *     `Token Authentication` toggle, same key. Also verified.
 *   - "Some Pull Zones might not support HMAC." This is the residual risk: we
 *     could only test the zones we have. It is judged small because Bunny
 *     ships HMAC-only reference clients and documents only HMAC, so any newly
 *     onboarded user would fail otherwise. If it ever bites, the failure is
 *     loud and immediate (every signed download 403s) rather than silent.
 *   - "This is a breaking API change." It is not: `signBunnyUrl` is private and
 *     `BunnyBlobStoreConfig` is unchanged. Users on public (unsigned) Pull
 *     Zones never reach this code at all.
 */

/** Prefix Bunny uses to identify an HMAC-SHA256 token. */
const HMAC_TOKEN_PREFIX = "HS256-";

/** Base64url-encode (RFC 4648 §5) without padding, as Bunny expects. */
function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Sign a Bunny CDN URL using Advanced Token Authentication.
 *
 * Token format:
 *
 *     HS256-<base64url(HMAC-SHA256(security_key, path + expires + signing_data))>
 *
 * where `signing_data` is the query parameters sorted alphabetically by key and
 * joined as `key=value` pairs with `&`. Bunny's reference implementation also
 * folds an optional client IP between `expires` and `signing_data`; we do not
 * use IP locking, so that contributes nothing here. Requires "Token
 * Authentication" to be enabled on the Pull Zone.
 * See https://github.com/BunnyWay/BunnyCDN.TokenAuthentication
 *
 * Two things are easy to get wrong:
 *
 * 1. The key is the HMAC *key*, not a prefix of the message. The previous
 *    scheme was a bare SHA256(key + message) digest, which is the classic
 *    length-extension-prone construction HMAC exists to replace.
 * 2. Parameters are folded into the signature using their *raw* (decoded)
 *    values, while the URL must carry them percent-encoded. Bunny validates by
 *    parsing the incoming query string -- which decodes values -- and
 *    re-signing, so signing the encoded form 403s for any value containing
 *    characters that encode (see issue #13). Hence the separate
 *    `hashQueryString` and `extraQueryString` below.
 */
async function signBunnyUrl(
  baseUrl: string,
  path: string,
  tokenKey: string,
  expiresIn: number,
  extraParams?: Record<string, string>,
): Promise<string> {
  const expirationTimestamp = Math.floor(Date.now() / 1000) + expiresIn;

  // Build sorted query strings for extra params. Two variants are required:
  // the raw one goes into the signature, the encoded one goes into the URL.
  let extraQueryString = "";
  let hashQueryString = "";
  if (extraParams && Object.keys(extraParams).length > 0) {
    const sorted = Object.entries(extraParams).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    extraQueryString = sorted
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    hashQueryString = sorted.map(([k, v]) => `${k}=${v}`).join("&");
  }

  const message = `${path}${expirationTimestamp}${hashQueryString}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(tokenKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  const token = HMAC_TOKEN_PREFIX + base64UrlEncode(new Uint8Array(signature));

  // Build final URL: token and expires first, then extra params. Bunny sorts
  // parameters itself when validating, so ordering on the wire is irrelevant.
  let url = `${baseUrl}${path}?token=${token}&expires=${expirationTimestamp}`;
  if (extraQueryString) {
    url += `&${extraQueryString}`;
  }
  return url;
}

/**
 * Creates a BlobStore implementation backed by Bunny.net Edge Storage
 * with CDN delivery via Pull Zone.
 *
 * Note: Bunny.net does not support presigned upload URLs natively.
 * Use the HTTP upload proxy endpoint for client uploads instead.
 */
export function createBunnyBlobStore(config: BunnyBlobStoreConfig): BlobStore {
  const {
    apiKey,
    storageZoneName,
    region = "",
    cdnHostname,
    tokenKey,
    uploadMode = "convex-proxy",
    edgeUpload,
  } = config;

  // Build storage endpoint based on region
  // Frankfurt (default) uses storage.bunnycdn.com
  // Other regions use {region}.storage.bunnycdn.com
  const storageHost = region
    ? `${region}.storage.bunnycdn.com`
    : "storage.bunnycdn.com";

  const cdnBaseUrl = `https://${cdnHostname}`;

  function buildStorageUrl(key: string): string {
    return `https://${storageHost}/${storageZoneName}/${key}`;
  }

  return {
    async generateUploadUrl(
      key: string,
      opts?: UploadUrlOptions,
    ): Promise<string> {
      if (uploadMode !== "bunny-edge-presigned") {
        // Bunny Storage itself still has no native presigned PUT support.
        // Edge presigning is a separate opt-in data-plane strategy.
        throw new Error(
          "Bunny.net storage does not support native presigned upload URLs. " +
            'Configure uploadMode: "bunny-edge-presigned" with edgeUpload, ' +
            "or use the HTTP upload proxy endpoint.",
        );
      }
      if (!edgeUpload) {
        throw new Error(
          "Bunny edge presigned uploads require an edgeUpload signer config.",
        );
      }
      assertBunnyEdgeUploadOptions(opts);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...edgeUpload.headers,
      };
      if (edgeUpload.accessKey !== undefined) {
        headers.AccessKey = edgeUpload.accessKey;
      }

      const response = await fetch(edgeUpload.signUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          checksum: opts.checksum,
          filePath: `/${key}`,
          fileSizeInBytes: opts.contentLength,
        }),
      });

      return parseUploadUrlResponse(response);
    },

    async generateDownloadUrl(
      key: string,
      opts?: DownloadUrlOptions,
    ): Promise<string> {
      const path = `/${key}`;

      // If token authentication is configured, sign the URL (including extra params)
      if (tokenKey) {
        const expiresIn = opts?.expiresIn ?? DEFAULT_TOKEN_TTL;
        return signBunnyUrl(
          cdnBaseUrl,
          path,
          tokenKey,
          expiresIn,
          opts?.extraParams,
        );
      }

      // No token auth - return plain CDN URL with extra params if provided
      if (opts?.extraParams && Object.keys(opts.extraParams).length > 0) {
        const queryString = Object.entries(opts.extraParams)
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
          .join("&");
        return `${cdnBaseUrl}${path}?${queryString}`;
      }

      return `${cdnBaseUrl}${path}`;
    },

    async put(
      key: string,
      data: Blob | Uint8Array | ReadableStream<Uint8Array>,
      opts?: PutOptions,
    ): Promise<void> {
      const url = buildStorageUrl(key);
      const contentType = opts?.contentType ?? "application/octet-stream";

      const headers: Record<string, string> = {
        AccessKey: apiKey,
        "Content-Type": contentType,
      };

      // Include Content-Length when the caller knows the exact size. Callers
      // must not forward an unverified client-supplied value -- a mismatch
      // against the bytes actually streamed truncates or fails the upload.
      // Omitting it sends the request chunked, which Bunny accepts.
      if (opts?.contentLength !== undefined) {
        headers["Content-Length"] = String(opts.contentLength);
      }

      // Determine body and fetch options based on data type
      let body: Blob | ReadableStream<Uint8Array>;
      const fetchOptions: RequestInit = {
        method: "PUT",
        headers,
      };

      if (data instanceof ReadableStream) {
        // Streaming upload - requires duplex: "half"
        body = data;
        // @ts-expect-error - duplex is required for streaming request bodies
        fetchOptions.duplex = "half";
      } else if (data instanceof Uint8Array) {
        // Convert Uint8Array to Blob for fetch body compatibility
        body = new Blob([new Uint8Array(data).buffer as ArrayBuffer]);
      } else {
        body = data;
      }

      fetchOptions.body = body;

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Failed to put blob to Bunny: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`,
        );
      }
    },

    async get(key: string): Promise<Blob | null> {
      const url = buildStorageUrl(key);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          AccessKey: apiKey,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Failed to get blob from Bunny: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`,
        );
      }

      return response.blob();
    },

    async delete(key: string): Promise<DeleteResult> {
      const url = buildStorageUrl(key);

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          AccessKey: apiKey,
        },
      });

      if (response.status === 404) {
        return { status: "not_found" };
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Failed to delete blob from Bunny: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`,
        );
      }

      return { status: "deleted" };
    },
  };
}
