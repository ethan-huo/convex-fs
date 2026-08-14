/**
 * Tests for the HTTP routes registered by `registerRoutes`, focused on the
 * upload proxy: what it authorizes, what it records, and what it cleans up.
 *
 * The routes are exercised through a real `httpRouter()` and the real
 * in-memory blob store. The handler is pulled off the registered action via
 * `_handler` -- the same seam `convex-test`'s own `t.fetch` uses -- so the
 * production code path runs unmodified, while `ctx.runMutation` is stubbed to
 * capture exactly what would be written to the component.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { httpRouter } from "convex/server";
import { ConvexFS, registerRoutes } from "./index.js";
import type {
  UploadRequestInfo,
  UploadAuthDecision,
  HttpActionCtx,
} from "./types.js";
import type { ComponentApi } from "../component/_generated/component.js";
import { createTestBlobStore, resetTestBlobStore } from "../blobstore/test.js";

/** Sentinel function references; the stub ctx only compares identity. */
const REGISTER_PENDING_UPLOAD = "lib.registerPendingUpload" as const;
const component = {
  lib: { registerPendingUpload: REGISTER_PENDING_UPLOAD },
} as unknown as ComponentApi;

type RecordedMutation = { ref: unknown; args: Record<string, unknown> };

type UploadAuthFn = (
  ctx: HttpActionCtx,
  info: UploadRequestInfo,
) => Promise<boolean | UploadAuthDecision>;

function buildUploadHandler(
  uploadAuth: UploadAuthFn,
  opts: { failMutation?: boolean } = {},
) {
  const http = httpRouter();
  const fs = new ConvexFS(component, { storage: { type: "test" } });

  registerRoutes(http, component, fs, {
    pathPrefix: "/fs",
    uploadAuth,
    downloadAuth: async () => true,
  });

  const found = http.lookup("/fs/upload", "POST");
  if (!found) throw new Error("upload route was not registered");
  const handler = (found[0] as unknown as { _handler: unknown })._handler as (
    ctx: HttpActionCtx,
    req: Request,
  ) => Promise<Response>;

  const mutations: RecordedMutation[] = [];
  const ctx = {
    runMutation: async (ref: unknown, args: Record<string, unknown>) => {
      if (opts.failMutation) {
        throw new Error("component unavailable");
      }
      mutations.push({ ref, args });
      return null;
    },
    auth: { getUserIdentity: async () => null },
  } as unknown as HttpActionCtx;

  return {
    mutations,
    async upload(
      body: BodyInit | ReadableStream<Uint8Array>,
      init: { headers?: Record<string, string>; query?: string } = {},
    ) {
      const url = `https://example.convex.site/fs/upload${init.query ?? ""}`;
      const request = new Request(url, {
        method: "POST",
        body: body as BodyInit,
        headers: init.headers,
        // Required when the body is a stream.
        ...({ duplex: "half" } as Record<string, unknown>),
      });
      return handler(ctx, request);
    },
  };
}

/** A stream that emits `chunks` of `size` bytes without a Content-Length. */
function chunkedBody(chunks: number, size: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= chunks) {
        controller.close();
        return;
      }
      sent++;
      controller.enqueue(new Uint8Array(size).fill(65));
    },
  });
}

function storedBlobIds(): string[] {
  return [...createTestBlobStore()._blobs.keys()];
}

describe("registerRoutes upload", () => {
  beforeEach(() => {
    resetTestBlobStore();
  });

  describe("authorization", () => {
    test("accepts a legacy boolean-returning callback", async () => {
      const h = buildUploadHandler(async () => true);
      const res = await h.upload("hello");

      expect(res.status).toBe(200);
      expect(await res.json()).toHaveProperty("blobId");
    });

    test("denies with 403 and writes nothing", async () => {
      const h = buildUploadHandler(async () => false);
      const res = await h.upload("hello");

      expect(res.status).toBe(403);
      expect(storedBlobIds()).toEqual([]);
      expect(h.mutations).toEqual([]);
    });

    test("treats a throwing callback as denial", async () => {
      const h = buildUploadHandler(async () => {
        throw new Error("boom");
      });
      const res = await h.upload("hello");

      expect(res.status).toBe(403);
      expect(storedBlobIds()).toEqual([]);
    });

    test("denies when the decision object says so", async () => {
      const h = buildUploadHandler(async () => ({ allowed: false }));
      expect((await h.upload("hello")).status).toBe(403);
      expect(storedBlobIds()).toEqual([]);
    });
  });

  describe("request info", () => {
    test("surfaces query params, headers, content type and length", async () => {
      let seen: UploadRequestInfo | undefined;
      const h = buildUploadHandler(async (_ctx, info) => {
        seen = info;
        return true;
      });

      await h.upload("hello world", {
        query: "?projectId=proj_123&tag=avatar",
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": "11",
          "X-Project-Id": "proj_123",
        },
      });

      expect(seen).toBeDefined();
      expect(seen!.params).toEqual({ projectId: "proj_123", tag: "avatar" });
      expect(seen!.contentType).toBe("text/plain");
      expect(seen!.contentLength).toBe(11);
      expect(seen!.headers.get("X-Project-Id")).toBe("proj_123");
      expect(seen!.url).toContain("/fs/upload");
    });

    test("defaults content type and omits an absent content length", async () => {
      let seen: UploadRequestInfo | undefined;
      const h = buildUploadHandler(async (_ctx, info) => {
        seen = info;
        return true;
      });

      await h.upload(chunkedBody(1, 8));

      expect(seen!.contentType).toBe("application/octet-stream");
      expect(seen!.contentLength).toBeUndefined();
    });

    test("does not expose the request body to the callback", async () => {
      let keys: string[] = [];
      const h = buildUploadHandler(async (_ctx, info) => {
        keys = Object.keys(info);
        return true;
      });

      await h.upload("hello");

      expect(keys).not.toContain("body");
      expect(keys).not.toContain("request");
    });
  });

  describe("recorded size", () => {
    test("records the observed byte count", async () => {
      const h = buildUploadHandler(async () => true);
      const res = await h.upload("hello world", {
        headers: { "Content-Type": "text/plain", "Content-Length": "11" },
      });

      expect(res.status).toBe(200);
      expect(h.mutations).toHaveLength(1);
      expect(h.mutations[0].ref).toBe(REGISTER_PENDING_UPLOAD);
      expect(h.mutations[0].args.size).toBe(11);
    });

    // Regression: a chunked upload used to record size 0, because the handler
    // read Content-Length and defaulted to 0 when it was absent.
    test("records the real size when there is no Content-Length", async () => {
      const h = buildUploadHandler(async () => true);
      const res = await h.upload(chunkedBody(4, 256));

      expect(res.status).toBe(200);
      expect(h.mutations[0].args.size).toBe(1024);
      expect(h.mutations[0].args.size).not.toBe(0);
    });

    // The header is a claim; the counter is the fact.
    test("ignores a Content-Length that understates the body", async () => {
      const h = buildUploadHandler(async () => true);
      const res = await h.upload("0123456789", {
        headers: { "Content-Type": "text/plain", "Content-Length": "2" },
      });

      expect(res.status).toBe(200);
      expect(h.mutations[0].args.size).toBe(10);
    });

    test("stores the bytes under the returned blobId", async () => {
      const h = buildUploadHandler(async () => true);
      const res = await h.upload("hello world", {
        headers: { "Content-Type": "text/plain" },
      });
      const { blobId } = (await res.json()) as { blobId: string };

      const stored = createTestBlobStore()._blobs.get(blobId);
      expect(stored).toBeDefined();
      expect(new TextDecoder().decode(stored!.data)).toBe("hello world");
      expect(h.mutations[0].args.blobId).toBe(blobId);
    });

    test("derives a blobId extension from the content type", async () => {
      const h = buildUploadHandler(async () => true);
      const res = await h.upload("x", {
        headers: { "Content-Type": "image/png" },
      });
      const { blobId } = (await res.json()) as { blobId: string };

      expect(blobId.endsWith(".png")).toBe(true);
    });
  });

  describe("maxBytes enforcement", () => {
    test("rejects an oversized upload with 413", async () => {
      const h = buildUploadHandler(async () => ({
        allowed: true,
        maxBytes: 100,
      }));

      const res = await h.upload(chunkedBody(4, 256)); // 1024 bytes

      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({
        error: "Upload exceeds the maximum allowed size of 100 bytes",
      });
    });

    test("leaves no orphaned blob behind when it aborts", async () => {
      const h = buildUploadHandler(async () => ({
        allowed: true,
        maxBytes: 100,
      }));

      await h.upload(chunkedBody(4, 256));

      // Nothing may survive in storage: no `uploads` row references it, so
      // upload GC would never reclaim it.
      expect(storedBlobIds()).toEqual([]);
      expect(h.mutations).toEqual([]);
    });

    test("allows an upload exactly at the limit", async () => {
      const h = buildUploadHandler(async () => ({
        allowed: true,
        maxBytes: 1024,
      }));

      const res = await h.upload(chunkedBody(4, 256));

      expect(res.status).toBe(200);
      expect(h.mutations[0].args.size).toBe(1024);
    });

    test("imposes no limit when maxBytes is omitted", async () => {
      const h = buildUploadHandler(async () => ({ allowed: true }));
      const res = await h.upload(chunkedBody(8, 1024));

      expect(res.status).toBe(200);
      expect(h.mutations[0].args.size).toBe(8192);
    });

    test("enforces the cap even when Content-Length claims otherwise", async () => {
      const h = buildUploadHandler(async () => ({
        allowed: true,
        maxBytes: 100,
      }));

      // Client declares a small body, then streams far more than that.
      const res = await h.upload(chunkedBody(4, 256), {
        headers: { "Content-Length": "10" },
      });

      expect(res.status).toBe(413);
      expect(storedBlobIds()).toEqual([]);
    });
  });

  describe("orphan cleanup", () => {
    // The blob is fully written, then the control-plane call fails. Nothing
    // references the object, so upload GC would never reclaim it -- the
    // handler has to delete it itself.
    test("removes the blob when registering the upload fails", async () => {
      const h = buildUploadHandler(async () => true, { failMutation: true });

      const res = await h.upload("hello world", {
        headers: { "Content-Type": "text/plain" },
      });

      expect(res.status).toBe(500);
      expect(storedBlobIds()).toEqual([]);
    });

    test("still reports 413 rather than 500 when the cap trips", async () => {
      const h = buildUploadHandler(async () => ({
        allowed: true,
        maxBytes: 10,
      }));

      const res = await h.upload(chunkedBody(2, 64));

      expect(res.status).toBe(413);
      expect(storedBlobIds()).toEqual([]);
    });
  });
});
