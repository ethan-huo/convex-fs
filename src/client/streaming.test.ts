import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexFS } from "./index.js";

const component = {
  lib: {
    commitFiles: "commitFiles",
    copyByPath: "copyByPath",
    deleteByPath: "deleteByPath",
    getDownloadUrl: "getDownloadUrl",
    moveByPath: "moveByPath",
    registerPendingUpload: "registerPendingUpload",
    stat: "stat",
    transact: "transact",
  },
} as any;

function createFs(
  storage:
    | {
        type: "test";
      }
    | {
        type: "bunny";
        apiKey: string;
        storageZoneName: string;
        cdnHostname: string;
        region?: string;
        tokenKey?: string;
      } = { type: "test" },
) {
  return new ConvexFS(component, { storage });
}

function createStream(
  chunks: Array<ArrayLike<number>>,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new Uint8Array(chunk));
      }
      controller.close();
    },
  });
}

async function readStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("ConvexFS streaming I/O", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("getBlobStream returns the response stream without buffering", async () => {
    const fs = createFs();
    const body = createStream([
      [1, 2],
      [3, 4],
    ]);
    const actionCtx = {
      runAction: vi.fn().mockResolvedValue("https://cdn.example/blob"),
    } as any;

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
      }),
    ) as typeof globalThis.fetch;

    const stream = await fs.getBlobStream(actionCtx, "blob-1");

    expect(stream).not.toBeNull();
    expect(await readStream(stream!)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(actionCtx.runAction).toHaveBeenCalledWith(
      component.lib.getDownloadUrl,
      {
        config: fs.config,
        blobId: "blob-1",
        extraParams: undefined,
      },
    );
  });

  test("getFileStream combines stat metadata with streamed bytes", async () => {
    const fs = createFs();
    const queryCtx = {
      runQuery: vi.fn().mockResolvedValue({
        path: "/docs/file.txt",
        blobId: "blob-1",
        contentType: "text/plain",
        size: 4,
      }),
    } as any;
    vi.spyOn(fs, "getBlobStream").mockResolvedValue(
      createStream([
        [1, 2],
        [3, 4],
      ]),
    );

    const result = await fs.getFileStream(queryCtx, "/docs/file.txt");

    expect(result).not.toBeNull();
    expect(result?.contentType).toBe("text/plain");
    expect(result?.size).toBe(4);
    expect(await readStream(result!.stream)).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
  });

  test("writeBlobStream counts bytes when contentLength is omitted", async () => {
    const fs = createFs({
      type: "bunny",
      apiKey: "key",
      storageZoneName: "zone",
      cdnHostname: "cdn.example.com",
    });
    const ctx = {
      runMutation: vi.fn().mockResolvedValue(null),
    } as any;

    globalThis.fetch = vi.fn().mockImplementation(async (_input, init) => {
      if (init?.method === "PUT") {
        expect(init.headers).toMatchObject({
          AccessKey: "key",
          "Content-Type": "application/octet-stream",
        });
        expect(
          (init.headers as Record<string, string>)["Content-Length"],
        ).toBeUndefined();
        expect(
          new Uint8Array(
            await new Response(init.body as BodyInit).arrayBuffer(),
          ),
        ).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fetch method: ${init?.method}`);
    }) as typeof globalThis.fetch;

    const result = await fs.writeBlobStream(
      ctx,
      createStream([
        [1, 2],
        [3, 4, 5],
      ]),
      "application/octet-stream",
    );

    expect(result.size).toBe(5);
    expect(result.blobId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      component.lib.registerPendingUpload,
      expect.objectContaining({
        blobId: result.blobId,
        contentType: "application/octet-stream",
        size: 5,
      }),
    );
  });

  test("writeBlobStream deletes the uploaded blob if registration fails", async () => {
    const fs = createFs({
      type: "bunny",
      apiKey: "key",
      storageZoneName: "zone",
      cdnHostname: "cdn.example.com",
    });
    const ctx = {
      runMutation: vi.fn().mockRejectedValue(new Error("register failed")),
    } as any;

    const methods: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (_input, init) => {
      methods.push(init?.method ?? "GET");
      if (init?.method === "PUT") {
        await new Response(init.body as BodyInit).arrayBuffer();
        return new Response(null, { status: 201 });
      }
      if (init?.method === "DELETE") {
        return new Response(null, { status: 200 });
      }
      throw new Error(`Unexpected fetch method: ${init?.method}`);
    }) as typeof globalThis.fetch;

    await expect(
      fs.writeBlobStream(
        ctx,
        createStream([[9, 8, 7]]),
        "application/octet-stream",
      ),
    ).rejects.toThrow("register failed");

    expect(methods).toEqual(["PUT", "DELETE"]);
  });

  test("writeFileStream commits the uploaded blob to the target path", async () => {
    const fs = createFs();
    const ctx = {} as any;
    vi.spyOn(fs, "writeBlobStream").mockResolvedValue({
      blobId: "blob-1",
      size: 5,
    });
    const commitSpy = vi.spyOn(fs, "commitFiles").mockResolvedValue();

    const result = await fs.writeFileStream(
      ctx,
      "/docs/output.txt",
      createStream([[1, 2, 3, 4, 5]]),
      "text/plain",
    );

    expect(result).toEqual({ blobId: "blob-1", size: 5 });
    expect(commitSpy).toHaveBeenCalledWith(ctx, [
      { path: "/docs/output.txt", blobId: "blob-1" },
    ]);
  });
});
