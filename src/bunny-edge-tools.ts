const BUNNY_API_BASE_URL = "https://api.bunny.net";
const BUNNY_EDGE_SCRIPT_TYPE_CDN = 1;
const DEFAULT_SIGNER_PATH = "/sign";
const DEFAULT_UPLOAD_PATH = "/upload";
const DEFAULT_UPLOAD_TTL_SECONDS = 900;
const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

type FetchLike = typeof fetch;

export type BunnyEdgeUploadProvisionFailureKind =
  | "missing_config"
  | "invalid_config"
  | "auth_failed"
  | "route_conflict"
  | "deployment_failed"
  | "bunny_api_error";

export type ProvisionBunnyEdgeUploadSignerOptions = {
  bunnyAccountApiKey: string;
  storageZoneName: string;
  storageAccessKey: string;
  region?: string;
  signerHostname: string;
  signerPath?: string;
  uploadPath?: string;
  signerName?: string;
  linkedPullZoneName?: string;
  signerAccessKey?: string;
  uploadTtlSeconds?: number;
  maxUploadBytes?: number;
  fetch?: FetchLike;
};

export type ProvisionBunnyEdgeUploadSignerSuccess = {
  ok: true;
  scriptId: number;
  pullZoneId: number | null;
  signUrl: string;
  accessKey: string;
  env: {
    BUNNY_EDGE_UPLOAD_SIGN_URL: string;
    BUNNY_EDGE_UPLOAD_ACCESS_KEY: string;
  };
};

export type ProvisionBunnyEdgeUploadSignerFailure = {
  ok: false;
  error: {
    kind: BunnyEdgeUploadProvisionFailureKind;
    message: string;
    status?: number;
    details?: unknown;
  };
};

export type ProvisionBunnyEdgeUploadSignerResult =
  | ProvisionBunnyEdgeUploadSignerSuccess
  | ProvisionBunnyEdgeUploadSignerFailure;

type NormalizedProvisionOptions = {
  bunnyAccountApiKey: string;
  storageZoneName: string;
  storageAccessKey: string;
  region: string;
  signerHostname: string;
  signerPath: string;
  uploadPath: string;
  signerName: string;
  linkedPullZoneName: string;
  signerAccessKey: string;
  uploadTtlSeconds: number;
  maxUploadBytes: number;
  fetch: FetchLike;
};

type BunnyApiFailure = {
  kind: BunnyEdgeUploadProvisionFailureKind;
  message: string;
  status?: number;
  details?: unknown;
};

type BunnyEdgeScriptModel = {
  Id?: number;
  Name?: string | null;
  LinkedPullZones?: Array<{
    Id?: number;
    PullZoneName?: string | null;
    DefaultHostname?: string | null;
  }> | null;
};

type BunnyListScriptsResponse = {
  Items?: BunnyEdgeScriptModel[] | null;
};

function failure(
  kind: BunnyEdgeUploadProvisionFailureKind,
  message: string,
  extra?: { status?: number; details?: unknown },
): ProvisionBunnyEdgeUploadSignerFailure {
  return {
    ok: false,
    error: {
      kind,
      message,
      ...extra,
    },
  };
}

function trimRequired(value: string | undefined, name: string): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
}

function normalizePath(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
}

function normalizeProvisionOptions(
  options: ProvisionBunnyEdgeUploadSignerOptions,
): NormalizedProvisionOptions {
  const signerHostname = trimRequired(options.signerHostname, "signerHostname");
  if (signerHostname.includes("/") || signerHostname.includes("://")) {
    throw new Error("signerHostname must be a hostname, not a URL.");
  }

  const signerPath = normalizePath(options.signerPath, DEFAULT_SIGNER_PATH);
  const uploadPath = normalizePath(options.uploadPath, DEFAULT_UPLOAD_PATH);
  const uploadTtlSeconds =
    options.uploadTtlSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS;
  const maxUploadBytes = options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  assertPositiveSafeInteger(uploadTtlSeconds, "uploadTtlSeconds");
  assertPositiveSafeInteger(maxUploadBytes, "maxUploadBytes");

  const signerName =
    options.signerName?.trim() || `convex-fs upload signer ${signerHostname}`;

  return {
    bunnyAccountApiKey: trimRequired(
      options.bunnyAccountApiKey,
      "bunnyAccountApiKey",
    ),
    storageZoneName: trimRequired(options.storageZoneName, "storageZoneName"),
    storageAccessKey: trimRequired(
      options.storageAccessKey,
      "storageAccessKey",
    ),
    region: options.region?.trim() ?? "",
    signerHostname,
    signerPath,
    uploadPath,
    signerName,
    linkedPullZoneName:
      options.linkedPullZoneName?.trim() ||
      `convex-fs-upload-${signerHostname.replace(/[^a-zA-Z0-9-]/g, "-")}`,
    signerAccessKey:
      options.signerAccessKey?.trim() || generateSignerAccessKey(),
    uploadTtlSeconds,
    maxUploadBytes,
    fetch: options.fetch ?? fetch,
  };
}

function generateSignerAccessKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function classifyBunnyApiFailure(
  response: Response,
  body: string,
): BunnyApiFailure {
  const details = parseMaybeJson(body);
  const messageFromBody =
    typeof details === "object" &&
    details !== null &&
    "Message" in details &&
    typeof details.Message === "string"
      ? details.Message
      : body.trim();
  const message = messageFromBody
    ? `${response.status} ${response.statusText}: ${messageFromBody}`
    : `${response.status} ${response.statusText}`;

  if (response.status === 401 || response.status === 403) {
    return { kind: "auth_failed", message, status: response.status, details };
  }
  if (response.status === 409) {
    return {
      kind: "route_conflict",
      message,
      status: response.status,
      details,
    };
  }
  if (response.status >= 400 && response.status < 500) {
    const lowerMessage = message.toLowerCase();
    const kind = lowerMessage.includes("hostname")
      ? "route_conflict"
      : "bunny_api_error";
    return { kind, message, status: response.status, details };
  }

  return {
    kind: "deployment_failed",
    message,
    status: response.status,
    details,
  };
}

function parseMaybeJson(text: string): unknown {
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function bunnyApi<T>(
  options: NormalizedProvisionOptions,
  path: string,
  init: RequestInit,
  okStatuses: number[],
): Promise<{ ok: true; value: T } | { ok: false; error: BunnyApiFailure }> {
  const response = await options.fetch(`${BUNNY_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      AccessKey: options.bunnyAccountApiKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!okStatuses.includes(response.status)) {
    return {
      ok: false,
      error: classifyBunnyApiFailure(response, await response.text()),
    };
  }

  if (response.status === 204) {
    return { ok: true, value: undefined as T };
  }

  return { ok: true, value: (await response.json()) as T };
}

function encodeQuery(value: string): string {
  return encodeURIComponent(value);
}

function getLinkedPullZoneId(script: BunnyEdgeScriptModel): number | null {
  const id = script.LinkedPullZones?.find((zone) => zone.Id !== undefined)?.Id;
  return typeof id === "number" ? id : null;
}

function createSignerScript(options: NormalizedProvisionOptions): string {
  return `import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const signerPath = ${JSON.stringify(options.signerPath)};
const uploadPath = ${JSON.stringify(options.uploadPath)};
const storageZoneName = process.env.STORAGE_ZONE_NAME;
const storageAccessKey = process.env.STORAGE_ACCESS_KEY;
const signerAccessKey = process.env.SIGNER_ACCESS_KEY;
const storageRegion = process.env.STORAGE_REGION || "";
const uploadTtlSeconds = Number(process.env.UPLOAD_TTL_SECONDS || "900");
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || "5368709120");

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function storageHost() {
  return storageRegion ? \`\${storageRegion}.storage.bunnycdn.com\` : "storage.bunnycdn.com";
}

function getEnvError() {
  if (!storageZoneName) return "Missing STORAGE_ZONE_NAME.";
  if (!storageAccessKey) return "Missing STORAGE_ACCESS_KEY.";
  if (!signerAccessKey) return "Missing SIGNER_ACCESS_KEY.";
  if (!Number.isSafeInteger(uploadTtlSeconds) || uploadTtlSeconds <= 0) {
    return "UPLOAD_TTL_SECONDS must be a positive safe integer.";
  }
  if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes <= 0) {
    return "MAX_UPLOAD_BYTES must be a positive safe integer.";
  }
  return null;
}

function isSha256Hex(value) {
  return typeof value === "string" && /^[a-fA-F0-9]{64}$/.test(value);
}

function normalizeFilePath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("..")) {
    return null;
  }
  return value;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function signaturePayload(params) {
  return [
    params.filePath,
    params.fileSizeInBytes,
    params.checksum.toLowerCase(),
    params.expires,
  ].join("\\n");
}

async function handleSign(request) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (request.headers.get("AccessKey") !== signerAccessKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Request body must be JSON." });
  }

  const filePath = normalizeFilePath(body.filePath);
  const fileSizeInBytes = body.fileSizeInBytes;
  const checksum = body.checksum;
  if (!filePath) return json(400, { error: "filePath must be an absolute path without '..'." });
  if (!Number.isSafeInteger(fileSizeInBytes) || fileSizeInBytes < 0) {
    return json(400, { error: "fileSizeInBytes must be a non-negative safe integer." });
  }
  if (fileSizeInBytes > maxUploadBytes) return json(413, { error: "Upload exceeds maxUploadBytes." });
  if (!isSha256Hex(checksum)) return json(400, { error: "checksum must be a 64-character SHA-256 hex string." });

  const expires = Math.floor(Date.now() / 1000) + uploadTtlSeconds;
  const signature = await hmacHex(signerAccessKey, signaturePayload({
    filePath,
    fileSizeInBytes,
    checksum,
    expires,
  }));
  const url = new URL(request.url);
  url.pathname = uploadPath;
  url.search = "";
  url.searchParams.set("filePath", filePath);
  url.searchParams.set("fileSizeInBytes", String(fileSizeInBytes));
  url.searchParams.set("checksum", checksum.toLowerCase());
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("signature", signature);
  return new Response(url.toString(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function handleUpload(request) {
  if (request.method !== "PUT") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const filePath = normalizeFilePath(url.searchParams.get("filePath"));
  const fileSizeInBytes = Number(url.searchParams.get("fileSizeInBytes"));
  const checksum = url.searchParams.get("checksum") || "";
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") || "";

  if (!filePath || !Number.isSafeInteger(fileSizeInBytes) || !isSha256Hex(checksum)) {
    return json(400, { error: "Invalid upload URL." });
  }
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000)) {
    return new Response("Upload URL expired", { status: 403 });
  }
  const expectedSignature = await hmacHex(signerAccessKey, signaturePayload({
    filePath,
    fileSizeInBytes,
    checksum,
    expires,
  }));
  if (signature !== expectedSignature) {
    return new Response("Invalid signature", { status: 403 });
  }
  if (request.headers.get("Content-Length") !== String(fileSizeInBytes)) {
    return json(400, { error: "Content-Length does not match signed size." });
  }

  const storageUrl = \`https://\${storageHost()}/\${storageZoneName}\${filePath}\`;
  const response = await fetch(storageUrl, {
    method: "PUT",
    headers: {
      AccessKey: storageAccessKey,
      "Content-Type": request.headers.get("Content-Type") || "application/octet-stream",
      "Content-Length": String(fileSizeInBytes),
      Checksum: checksum.toLowerCase(),
    },
    body: request.body,
  });

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }
  return new Response(null, { status: 204 });
}

BunnySDK.net.http.serve(async (request) => {
  const envError = getEnvError();
  if (envError) return json(500, { error: envError });

  const pathname = new URL(request.url).pathname;
  if (pathname === signerPath) return handleSign(request);
  if (pathname === uploadPath) return handleUpload(request);
  return new Response("Not Found", { status: 404 });
});
`;
}

async function findExistingScript(
  options: NormalizedProvisionOptions,
): Promise<
  | { ok: true; script: BunnyEdgeScriptModel | null }
  | { ok: false; error: BunnyApiFailure }
> {
  const response = await bunnyApi<BunnyListScriptsResponse>(
    options,
    `/compute/script?type=${BUNNY_EDGE_SCRIPT_TYPE_CDN}&page=1&perPage=1000&search=${encodeQuery(options.signerName)}&includeLinkedPullzones=true`,
    { method: "GET" },
    [200],
  );
  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    script:
      response.value.Items?.find(
        (script) => script.Name === options.signerName,
      ) ?? null,
  };
}

async function createOrUpdateScript(
  options: NormalizedProvisionOptions,
): Promise<
  | { ok: true; script: BunnyEdgeScriptModel }
  | { ok: false; error: BunnyApiFailure }
> {
  const existing = await findExistingScript(options);
  if (!existing.ok) {
    return existing;
  }

  if (existing.script?.Id !== undefined) {
    const updated = await bunnyApi<BunnyEdgeScriptModel>(
      options,
      `/compute/script/${existing.script.Id}`,
      {
        method: "POST",
        body: JSON.stringify({
          Name: options.signerName,
          ScriptType: BUNNY_EDGE_SCRIPT_TYPE_CDN,
        }),
      },
      [200],
    );
    return updated.ok ? { ok: true, script: updated.value } : updated;
  }

  const created = await bunnyApi<BunnyEdgeScriptModel>(
    options,
    "/compute/script",
    {
      method: "POST",
      body: JSON.stringify({
        Name: options.signerName,
        Code: createSignerScript(options),
        ScriptType: BUNNY_EDGE_SCRIPT_TYPE_CDN,
        CreateLinkedPullZone: true,
        LinkedPullZoneName: options.linkedPullZoneName,
      }),
    },
    [201],
  );
  return created.ok ? { ok: true, script: created.value } : created;
}

async function configureScript(
  options: NormalizedProvisionOptions,
  scriptId: number,
): Promise<{ ok: true } | { ok: false; error: BunnyApiFailure }> {
  const steps: Array<
    () => Promise<{ ok: true } | { ok: false; error: BunnyApiFailure }>
  > = [
    async () => {
      const response = await bunnyApi<void>(
        options,
        `/compute/script/${scriptId}/code`,
        {
          method: "POST",
          body: JSON.stringify({ Code: createSignerScript(options) }),
        },
        [204],
      );
      return response.ok ? { ok: true } : response;
    },
    async () =>
      upsertSecret(
        options,
        scriptId,
        "STORAGE_ACCESS_KEY",
        options.storageAccessKey,
      ),
    async () =>
      upsertSecret(
        options,
        scriptId,
        "SIGNER_ACCESS_KEY",
        options.signerAccessKey,
      ),
    async () =>
      upsertVariable(
        options,
        scriptId,
        "STORAGE_ZONE_NAME",
        options.storageZoneName,
      ),
    async () =>
      upsertVariable(options, scriptId, "STORAGE_REGION", options.region),
    async () =>
      upsertVariable(
        options,
        scriptId,
        "UPLOAD_TTL_SECONDS",
        String(options.uploadTtlSeconds),
      ),
    async () =>
      upsertVariable(
        options,
        scriptId,
        "MAX_UPLOAD_BYTES",
        String(options.maxUploadBytes),
      ),
    async () => {
      const response = await bunnyApi<void>(
        options,
        `/compute/script/${scriptId}/publish`,
        {
          method: "POST",
          body: JSON.stringify({ Note: "Provisioned by convex-fs." }),
        },
        [204],
      );
      return response.ok ? { ok: true } : response;
    },
  ];

  for (const step of steps) {
    const response = await step();
    if (!response.ok) {
      return response;
    }
  }

  return { ok: true };
}

async function upsertSecret(
  options: NormalizedProvisionOptions,
  scriptId: number,
  name: string,
  secret: string,
): Promise<{ ok: true } | { ok: false; error: BunnyApiFailure }> {
  const response = await bunnyApi<void>(
    options,
    `/compute/script/${scriptId}/secrets`,
    {
      method: "PUT",
      body: JSON.stringify({ Name: name, Secret: secret }),
    },
    [200, 204],
  );
  return response.ok ? { ok: true } : response;
}

async function upsertVariable(
  options: NormalizedProvisionOptions,
  scriptId: number,
  name: string,
  value: string,
): Promise<{ ok: true } | { ok: false; error: BunnyApiFailure }> {
  const response = await bunnyApi<void>(
    options,
    `/compute/script/${scriptId}/variables`,
    {
      method: "PUT",
      body: JSON.stringify({ Name: name, Required: true, DefaultValue: value }),
    },
    [200, 204],
  );
  return response.ok ? { ok: true } : response;
}

async function ensureHostname(
  options: NormalizedProvisionOptions,
  pullZoneId: number,
): Promise<{ ok: true } | { ok: false; error: BunnyApiFailure }> {
  const response = await bunnyApi<void>(
    options,
    `/pullzone/${pullZoneId}/addHostname`,
    {
      method: "POST",
      body: JSON.stringify({ Hostname: options.signerHostname }),
    },
    [204],
  );
  return response.ok ? { ok: true } : response;
}

/**
 * Provision or update the standalone Bunny Edge Script used by
 * uploadMode: "bunny-edge-presigned".
 *
 * This helper is for setup scripts, CI, and admin tooling only. Do not call it
 * from Convex functions or application runtime code because it requires the
 * account-level Bunny API key.
 */
export async function provisionBunnyEdgeUploadSigner(
  options: ProvisionBunnyEdgeUploadSignerOptions,
): Promise<ProvisionBunnyEdgeUploadSignerResult> {
  let normalized: NormalizedProvisionOptions;
  try {
    normalized = normalizeProvisionOptions(options);
  } catch (error) {
    return failure(
      error instanceof Error && error.message.includes("required")
        ? "missing_config"
        : "invalid_config",
      error instanceof Error ? error.message : "Invalid Bunny signer config.",
    );
  }

  const scriptResult = await createOrUpdateScript(normalized);
  if (!scriptResult.ok) {
    return failure(scriptResult.error.kind, scriptResult.error.message, {
      status: scriptResult.error.status,
      details: scriptResult.error.details,
    });
  }

  const scriptId = scriptResult.script.Id;
  if (scriptId === undefined) {
    return failure(
      "deployment_failed",
      "Bunny API did not return a script ID.",
    );
  }

  const configured = await configureScript(normalized, scriptId);
  if (!configured.ok) {
    return failure(configured.error.kind, configured.error.message, {
      status: configured.error.status,
      details: configured.error.details,
    });
  }

  const pullZoneId = getLinkedPullZoneId(scriptResult.script);
  if (pullZoneId === null) {
    return failure(
      "deployment_failed",
      "Bunny API did not return a linked Pull Zone for the signer script.",
    );
  }

  const hostname = await ensureHostname(normalized, pullZoneId);
  if (!hostname.ok) {
    return failure(hostname.error.kind, hostname.error.message, {
      status: hostname.error.status,
      details: hostname.error.details,
    });
  }

  const signUrl = `https://${normalized.signerHostname}${normalized.signerPath}`;
  return {
    ok: true,
    scriptId,
    pullZoneId,
    signUrl,
    accessKey: normalized.signerAccessKey,
    env: {
      BUNNY_EDGE_UPLOAD_SIGN_URL: signUrl,
      BUNNY_EDGE_UPLOAD_ACCESS_KEY: normalized.signerAccessKey,
    },
  };
}
