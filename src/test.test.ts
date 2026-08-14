/**
 * Tests for the `convex-fs/test` entry point.
 *
 * These deliberately import through the published subpath rather than by
 * relative path, so they fail if a helper stops being reachable by consumers.
 * The in-memory store is process-global, and `convexTest` rebuilds its database
 * for every instance, so without an exported reset a consumer's storage and
 * metadata drift apart between tests.
 */
import { describe, test, expect, beforeEach } from "vitest";
import {
  register,
  createTestBlobStore,
  resetTestBlobStore,
} from "convex-fs/test";
import testEntry from "convex-fs/test";

describe("convex-fs/test entry point", () => {
  beforeEach(() => {
    resetTestBlobStore();
  });

  test("exposes the component registration helper", () => {
    expect(typeof register).toBe("function");
  });

  test("exposes the in-memory store helpers", () => {
    expect(typeof createTestBlobStore).toBe("function");
    expect(typeof resetTestBlobStore).toBe("function");
  });

  test("exposes the same helpers on the default export", () => {
    expect(testEntry.register).toBe(register);
    expect(testEntry.createTestBlobStore).toBe(createTestBlobStore);
    expect(testEntry.resetTestBlobStore).toBe(resetTestBlobStore);
    expect(testEntry.schema).toBeDefined();
    expect(testEntry.modules).toBeDefined();
  });

  test("resetTestBlobStore clears blobs written through the store", async () => {
    const store = createTestBlobStore();
    await store.put("entry-point-blob", new TextEncoder().encode("bytes"), {
      contentType: "text/plain",
    });
    expect(await createTestBlobStore().get("entry-point-blob")).not.toBeNull();

    resetTestBlobStore();

    expect(await createTestBlobStore().get("entry-point-blob")).toBeNull();
  });
});
