import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { registeredRoutes } = vi.hoisted(() => ({
  registeredRoutes: [] as Array<{
    path?: string;
    pathPrefix?: string;
    method: string;
    handler: (ctx: any, req: Request) => Promise<Response>;
  }>,
}));

vi.mock("convex/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/server")>();
  return {
    ...actual,
    httpActionGeneric: (
      handler: (ctx: any, req: Request) => Promise<Response>,
    ) => handler,
  };
});

vi.mock("convex-helpers/server/cors", () => ({
  corsRouter: () => ({
    route: (route: (typeof registeredRoutes)[number]) => {
      registeredRoutes.push(route);
    },
  }),
}));

import { ConvexFS, registerRoutes } from "./index.js";

const component = {
  lib: {
    registerPendingUpload: "registerPendingUpload",
  },
} as any;

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

function createUploadRequest(
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
) {
  return new Request("https://example.com/fs/upload", {
    method: "POST",
    headers,
    body,
    // @ts-expect-error Request streaming bodies require duplex in compatible runtimes.
    duplex: "half",
  });
}

describe("registerRoutes upload streaming", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalConsoleError = console.error;
    registeredRoutes.length = 0;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    registeredRoutes.length = 0;
    vi.restoreAllMocks();
  });

  test("counts bytes for /upload when Content-Length is missing", async () => {
    const fs = new ConvexFS(component, {
      storage: {
        type: "bunny",
        apiKey: "key",
        storageZoneName: "zone",
        cdnHostname: "cdn.example.com",
      },
    });

    registerRoutes({} as any, component, fs, {
      uploadAuth: vi.fn().mockResolvedValue(true),
      downloadAuth: vi.fn().mockResolvedValue(true),
    });

    const uploadRoute = registeredRoutes.find(
      (route) => route.path === "/fs/upload" && route.method === "POST",
    );

    expect(uploadRoute).toBeDefined();
    console.error = vi.fn();

    const methods: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (_input, init) => {
      methods.push(init?.method ?? "GET");
      expect(init?.headers).toMatchObject({
        AccessKey: "key",
        "Content-Type": "application/octet-stream",
      });
      expect((init?.headers as Record<string, string>)["Content-Length"]).toBe(
        undefined,
      );
      expect(
        new Uint8Array(
          await new Response(init?.body as BodyInit).arrayBuffer(),
        ),
      ).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
      return new Response(null, { status: 201 });
    }) as typeof globalThis.fetch;

    const ctx = {
      runMutation: vi.fn().mockResolvedValue(null),
    };

    const response = await uploadRoute!.handler(
      ctx,
      createUploadRequest(
        createStream([
          [1, 2],
          [3, 4, 5],
        ]),
        {
          "Content-Type": "application/octet-stream",
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(methods).toEqual(["PUT"]);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      component.lib.registerPendingUpload,
      expect.objectContaining({
        contentType: "application/octet-stream",
        size: 5,
      }),
    );
  });

  test("best-effort deletes uploaded blob when route registration fails", async () => {
    const fs = new ConvexFS(component, {
      storage: {
        type: "bunny",
        apiKey: "key",
        storageZoneName: "zone",
        cdnHostname: "cdn.example.com",
      },
    });

    registerRoutes({} as any, component, fs, {
      uploadAuth: vi.fn().mockResolvedValue(true),
      downloadAuth: vi.fn().mockResolvedValue(true),
    });

    const uploadRoute = registeredRoutes.find(
      (route) => route.path === "/fs/upload" && route.method === "POST",
    );

    expect(uploadRoute).toBeDefined();

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

    const ctx = {
      runMutation: vi.fn().mockRejectedValue(new Error("register failed")),
    };

    const response = await uploadRoute!.handler(
      ctx,
      createUploadRequest(createStream([[9, 8, 7]]), {
        "Content-Type": "application/octet-stream",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "register failed" });
    expect(methods).toEqual(["PUT", "DELETE"]);
  });
});
