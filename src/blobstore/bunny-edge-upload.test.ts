import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createBunnyBlobStore } from "./bunny.js";

describe("createBunnyBlobStore", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("keeps native Bunny presigned uploads disabled by default", async () => {
    const store = createBunnyBlobStore({
      apiKey: "storage-key",
      storageZoneName: "zone",
      cdnHostname: "cdn.example.com",
    });

    await expect(
      store.generateUploadUrl("blob-1", {
        contentLength: 12,
        checksum:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      }),
    ).rejects.toThrow(/bunny-edge-presigned/);
  });

  test("requests a Bunny edge presigned upload URL", async () => {
    const signedUrl = "https://uploads.example.com/upload?token=abc";
    const store = createBunnyBlobStore({
      apiKey: "storage-key",
      storageZoneName: "zone",
      cdnHostname: "cdn.example.com",
      uploadMode: "bunny-edge-presigned",
      edgeUpload: {
        signUrl: "https://uploads.example.com/sign",
        accessKey: "edge-access-key",
        headers: {
          "X-App": "convex-fs",
        },
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(` ${signedUrl}\n`, {
        status: 201,
      }),
    ) as typeof globalThis.fetch;

    const uploadUrl = await store.generateUploadUrl("blob-1", {
      contentLength: 12,
      checksum:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    });

    expect(uploadUrl).toBe(signedUrl);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://uploads.example.com/sign",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          AccessKey: "edge-access-key",
          "X-App": "convex-fs",
        },
        body: JSON.stringify({
          checksum:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          filePath: "/blob-1",
          fileSizeInBytes: 12,
        }),
      },
    );
  });

  test("requires checksum and size for Bunny edge presigning", async () => {
    const store = createBunnyBlobStore({
      apiKey: "storage-key",
      storageZoneName: "zone",
      cdnHostname: "cdn.example.com",
      uploadMode: "bunny-edge-presigned",
      edgeUpload: {
        signUrl: "https://uploads.example.com/sign",
      },
    });

    await expect(
      store.generateUploadUrl("blob-1", {
        checksum:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      }),
    ).rejects.toThrow(/contentLength/);

    await expect(
      store.generateUploadUrl("blob-1", {
        contentLength: 12,
      }),
    ).rejects.toThrow(/checksum/);
  });
});
