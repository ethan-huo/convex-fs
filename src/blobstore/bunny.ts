import type {
  BlobStore,
  DeleteResult,
  BunnyBlobStoreConfig,
  UploadUrlOptions,
  DownloadUrlOptions,
  PutOptions,
} from "./types.js";

const DEFAULT_TOKEN_TTL = 3600; // 1 hour

/**
 * Sign a Bunny CDN URL using token authentication (advanced mode with SHA256).
 * Reference: https://docs.bunny.net/docs/cdn-token-authentication
 *
 * Note: Requires "URL Token Authentication" to be enabled on the Pull Zone
 * with the authentication type set to use SHA256 (advanced mode).
 *
 * The signature format is: SHA256(token_security_key + path + expiration + query_parameters)
 * where query_parameters is optional and must be sorted alphabetically by key.
 *
 * IMPORTANT: the query parameters are folded into the hash using their *raw*
 * (decoded) values, while the URL itself must carry them URL-encoded. Bunny
 * validates by parsing the incoming query string (which decodes values) and
 * re-hashing, so signing the encoded form yields a 403 for any value containing
 * characters that get percent-encoded. This mirrors Bunny's own reference
 * implementation, which builds separate `signingData` and `urlData` strings.
 * See https://github.com/BunnyWay/BunnyCDN.TokenAuthentication
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

  // Advanced token format: SHA256(token_security_key + path + expiration + query_params)
  const tokenContent = hashQueryString
    ? `${tokenKey}${path}${expirationTimestamp}${hashQueryString}`
    : `${tokenKey}${path}${expirationTimestamp}`;

  // Compute SHA256 hash using Web Crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(tokenContent);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);

  // Base64 encode and make URL-safe
  const base64Token = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // Build final URL: token and expires first, then extra params
  let url = `${baseUrl}${path}?token=${base64Token}&expires=${expirationTimestamp}`;
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
      _key: string,
      _opts?: UploadUrlOptions,
    ): Promise<string> {
      // Bunny.net does not support presigned upload URLs natively.
      // Client uploads should go through the HTTP upload proxy endpoint.
      throw new Error(
        "Bunny.net storage does not support presigned upload URLs. " +
          "Use the HTTP upload proxy endpoint instead.",
      );
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

      // Include Content-Length if known (helps Bunny allocate resources)
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
