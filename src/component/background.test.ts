/// <reference types="vite/client" />
import { describe, test, expect, vi, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema.js";
import { internal } from "./_generated/api.js";
import { createTestBlobStore, resetTestBlobStore } from "../blobstore/test.js";

const modules = import.meta.glob("./**/*.ts");

function initConvexTest() {
  return convexTest(schema, modules);
}

// The in-memory blob store is process-global, so reset it between tests.
beforeEach(() => {
  resetTestBlobStore();
});

/** Write real bytes into the store the GC jobs will reach for. */
async function putBlobBytes(blobId: string, body = "payload") {
  await createTestBlobStore().put(blobId, new TextEncoder().encode(body), {
    contentType: "text/plain",
  });
}

/** Whether the blob is still present in object storage. */
function blobExistsInStorage(blobId: string): boolean {
  return createTestBlobStore()._blobs.has(blobId);
}

// Test config using test storage
const testConfig = {
  storage: { type: "test" as const },
  blobGracePeriod: 1, // 1 second - short for tests
};

// Time constants
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Test Helpers
// ============================================================================

async function storeConfig(
  ctx: { db: any },
  config: typeof testConfig & { freezeGc?: boolean },
) {
  await ctx.db.insert("config", {
    key: "storage",
    value: config,
  });
}

async function createExpiredUpload(
  ctx: { db: any },
  blobId: string,
  expiredAgoMs: number,
) {
  await ctx.db.insert("uploads", {
    blobId,
    expiresAt: Date.now() - expiredAgoMs,
    contentType: "text/plain",
    size: 100,
  });
}

async function createOrphanedBlob(
  ctx: { db: any },
  blobId: string,
  orphanedAgoMs: number,
) {
  await ctx.db.insert("blobs", {
    blobId,
    metadata: { contentType: "text/plain", size: 100 },
    refCount: 0,
    updatedAt: Date.now() - orphanedAgoMs,
  });
}

async function createActiveBlob(
  ctx: { db: any },
  blobId: string,
  refCount: number = 1,
) {
  await ctx.db.insert("blobs", {
    blobId,
    metadata: { contentType: "text/plain", size: 100 },
    refCount,
    updatedAt: Date.now(),
  });
}

async function countUploads(ctx: { db: any }): Promise<number> {
  const uploads = await ctx.db.query("uploads").collect();
  return uploads.length;
}

async function countBlobs(ctx: { db: any }): Promise<number> {
  const blobs = await ctx.db.query("blobs").collect();
  return blobs.length;
}

async function countFiles(ctx: { db: any }): Promise<number> {
  const files = await ctx.db.query("files").collect();
  return files.length;
}

async function createExpiredFile(
  ctx: { db: any },
  path: string,
  blobId: string,
  expiredAgoMs: number,
) {
  // Create blob first
  await ctx.db.insert("blobs", {
    blobId,
    metadata: { contentType: "text/plain", size: 100 },
    refCount: 1,
    updatedAt: Date.now(),
  });
  // Create file with expired expiresAt
  await ctx.db.insert("files", {
    path,
    blobId,
    attributes: { expiresAt: Date.now() - expiredAgoMs },
  });
}

async function createFileWithFutureExpiry(
  ctx: { db: any },
  path: string,
  blobId: string,
  expiresInMs: number,
) {
  await ctx.db.insert("blobs", {
    blobId,
    metadata: { contentType: "text/plain", size: 100 },
    refCount: 1,
    updatedAt: Date.now(),
  });
  await ctx.db.insert("files", {
    path,
    blobId,
    attributes: { expiresAt: Date.now() + expiresInMs },
  });
}

async function createFileWithoutExpiry(
  ctx: { db: any },
  path: string,
  blobId: string,
) {
  await ctx.db.insert("blobs", {
    blobId,
    metadata: { contentType: "text/plain", size: 100 },
    refCount: 1,
    updatedAt: Date.now(),
  });
  await ctx.db.insert("files", {
    path,
    blobId,
    // No attributes
  });
}

async function getBlob(ctx: { db: any }, blobId: string) {
  return await ctx.db
    .query("blobs")
    .withIndex("blobId", (q: any) => q.eq("blobId", blobId))
    .unique();
}

// ============================================================================
// Upload GC (UGC) Tests
// ============================================================================

describe("Upload GC (UGC)", () => {
  describe("findExpiredUploads", () => {
    test("returns uploads older than threshold", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createExpiredUpload(ctx, "old-1", TWO_HOURS_MS);
        await createExpiredUpload(ctx, "old-2", TWO_HOURS_MS);
      });

      const expired = await t.query(internal.background.findExpiredUploads, {
        threshold: Date.now() - ONE_HOUR_MS,
        limit: 100,
      });

      expect(expired).toHaveLength(2);
      expect(expired.map((e) => e.blobId).sort()).toEqual(["old-1", "old-2"]);
    });

    test("does not return uploads newer than threshold", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        // Create one expired and one fresh upload
        await createExpiredUpload(ctx, "old", TWO_HOURS_MS);
        await ctx.db.insert("uploads", {
          blobId: "fresh",
          expiresAt: Date.now() + ONE_HOUR_MS, // expires in the future
          contentType: "text/plain",
          size: 100,
        });
      });

      const expired = await t.query(internal.background.findExpiredUploads, {
        threshold: Date.now() - ONE_HOUR_MS,
        limit: 100,
      });

      expect(expired).toHaveLength(1);
      expect(expired[0].blobId).toBe("old");
    });

    test("respects limit parameter", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await createExpiredUpload(ctx, `upload-${i}`, TWO_HOURS_MS);
        }
      });

      const expired = await t.query(internal.background.findExpiredUploads, {
        threshold: Date.now() - ONE_HOUR_MS,
        limit: 5,
      });

      expect(expired).toHaveLength(5);
    });
  });

  describe("gcExpiredUploads", () => {
    test("deletes expired uploads from DB", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await storeConfig(ctx, testConfig);
        await createExpiredUpload(ctx, "expired-1", TWO_HOURS_MS);
        await createExpiredUpload(ctx, "expired-2", TWO_HOURS_MS);
      });

      await t.action(internal.background.gcExpiredUploads, {});

      await t.run(async (ctx) => {
        expect(await countUploads(ctx)).toBe(0);
      });
    });

    test("removes the blob bytes from storage", async () => {
      const t = initConvexTest();

      await putBlobBytes("expired-with-bytes");
      await putBlobBytes("still-pending");
      expect(blobExistsInStorage("expired-with-bytes")).toBe(true);

      await t.run(async (ctx) => {
        await storeConfig(ctx, testConfig);
        await createExpiredUpload(ctx, "expired-with-bytes", TWO_HOURS_MS);
      });

      await t.action(internal.background.gcExpiredUploads, {});

      expect(blobExistsInStorage("expired-with-bytes")).toBe(false);
      // An unrelated blob must survive.
      expect(blobExistsInStorage("still-pending")).toBe(true);
    });

    test("skips when no config exists", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createExpiredUpload(ctx, "expired", TWO_HOURS_MS);
      });

      // Should not throw, just return early
      await t.action(internal.background.gcExpiredUploads, {});

      await t.run(async (ctx) => {
        // Upload should still exist (GC didn't run)
        expect(await countUploads(ctx)).toBe(1);
      });
    });

    test("skips when freezeGc is true", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await storeConfig(ctx, { ...testConfig, freezeGc: true });
        await createExpiredUpload(ctx, "expired", TWO_HOURS_MS);
      });

      await t.action(internal.background.gcExpiredUploads, {});

      await t.run(async (ctx) => {
        // Upload should still exist (GC is frozen)
        expect(await countUploads(ctx)).toBe(1);
      });
    });

    test("handles missing blobs gracefully (upload abandoned before blob written)", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await storeConfig(ctx, testConfig);
        // Create upload record but NO blob in storage (simulates abandoned upload)
        await createExpiredUpload(ctx, "abandoned", TWO_HOURS_MS);
      });

      // Should not throw - missing blob is OK (status: "not_found")
      await t.action(internal.background.gcExpiredUploads, {});

      await t.run(async (ctx) => {
        // Upload record should still be cleaned up
        expect(await countUploads(ctx)).toBe(0);
      });
    });

    test("cleans up all uploads across multiple scheduled batches (150 items)", async () => {
      vi.useFakeTimers();
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await storeConfig(ctx, testConfig);
        // Create 150 expired uploads (exceeds batch size of 100)
        for (let i = 0; i < 150; i++) {
          await createExpiredUpload(ctx, `upload-${i}`, TWO_HOURS_MS);
        }
      });

      // Run GC - it should self-schedule to handle remaining items
      await t.action(internal.background.gcExpiredUploads, {});

      // Wait for all scheduled functions to complete
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());

      await t.run(async (ctx) => {
        expect(await countUploads(ctx)).toBe(0);
      });

      vi.useRealTimers();
    });
  });
});

// ============================================================================
// Blob GC (BGC) Tests
// ============================================================================

describe("Blob GC (BGC)", () => {
  describe("findOrphanedBlobs", () => {
    test("returns blobs with refCount=0 older than threshold", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createOrphanedBlob(ctx, "orphan-1", ONE_DAY_MS);
        await createOrphanedBlob(ctx, "orphan-2", ONE_DAY_MS);
      });

      const orphaned = await t.query(internal.background.findOrphanedBlobs, {
        threshold: Date.now() - ONE_HOUR_MS,
        limit: 100,
      });

      expect(orphaned).toHaveLength(2);
    });

    test("does not return blobs with refCount > 0", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createOrphanedBlob(ctx, "orphan", ONE_DAY_MS);
        await createActiveBlob(ctx, "active", 1);
      });

      const orphaned = await t.query(internal.background.findOrphanedBlobs, {
        threshold: Date.now() - ONE_HOUR_MS,
        limit: 100,
      });

      expect(orphaned).toHaveLength(1);
      expect(orphaned[0].blobId).toBe("orphan");
    });

    test("does not return recently orphaned blobs (within grace period)", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createOrphanedBlob(ctx, "old-orphan", ONE_DAY_MS);
        await createOrphanedBlob(ctx, "fresh-orphan", 1000); // 1 second ago
      });

      const orphaned = await t.query(internal.background.findOrphanedBlobs, {
        threshold: Date.now() - ONE_HOUR_MS,
        limit: 100,
      });

      expect(orphaned).toHaveLength(1);
      expect(orphaned[0].blobId).toBe("old-orphan");
    });

    test("respects limit parameter", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await createOrphanedBlob(ctx, `blob-${i}`, ONE_DAY_MS);
        }
      });

      const orphaned = await t.query(internal.background.findOrphanedBlobs, {
        threshold: Date.now() - ONE_HOUR_MS,
        limit: 5,
      });

      expect(orphaned).toHaveLength(5);
    });
  });

  describe("gcOrphanedBlobs", () => {
    test("deletes orphaned blobs from DB", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await storeConfig(ctx, { ...testConfig, blobGracePeriod: 1 });
        await createOrphanedBlob(ctx, "orphan-1", ONE_DAY_MS);
        await createOrphanedBlob(ctx, "orphan-2", ONE_DAY_MS);
      });

      await t.action(internal.background.gcOrphanedBlobs, {});

      await t.run(async (ctx) => {
        expect(await countBlobs(ctx)).toBe(0);
      });
    });

    test("removes the blob bytes from storage", async () => {
      const t = initConvexTest();

      await putBlobBytes("orphan-with-bytes");
      await putBlobBytes("live-blob");

      await t.run(async (ctx) => {
        await storeConfig(ctx, { ...testConfig, blobGracePeriod: 1 });
        await createOrphanedBlob(ctx, "orphan-with-bytes", ONE_DAY_MS);
        // refCount > 0, so it must not be collected.
        await createActiveBlob(ctx, "live-blob", 1);
      });

      await t.action(internal.background.gcOrphanedBlobs, {});

      expect(blobExistsInStorage("orphan-with-bytes")).toBe(false);
      expect(blobExistsInStorage("live-blob")).toBe(true);
    });

    test("leaves bytes untouched when freezeGc is true", async () => {
      const t = initConvexTest();

      await putBlobBytes("frozen-orphan");

      await t.run(async (ctx) => {
        await storeConfig(ctx, {
          ...testConfig,
          blobGracePeriod: 1,
          freezeGc: true,
        });
        await createOrphanedBlob(ctx, "frozen-orphan", ONE_DAY_MS);
      });

      await t.action(internal.background.gcOrphanedBlobs, {});

      expect(blobExistsInStorage("frozen-orphan")).toBe(true);
      await t.run(async (ctx) => {
        expect(await countBlobs(ctx)).toBe(1);
      });
    });

    test("respects configured blobGracePeriod", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        // Grace period of 1 hour (3600 seconds)
        await storeConfig(ctx, { ...testConfig, blobGracePeriod: 3600 });
        // Orphaned 30 minutes ago - should NOT be deleted
        await createOrphanedBlob(ctx, "recent", 30 * 60 * 1000);
        // Orphaned 2 hours ago - should be deleted
        await createOrphanedBlob(ctx, "old", TWO_HOURS_MS);
      });

      await t.action(internal.background.gcOrphanedBlobs, {});

      await t.run(async (ctx) => {
        expect(await countBlobs(ctx)).toBe(1);
        const remaining = await ctx.db.query("blobs").collect();
        expect(remaining[0].blobId).toBe("recent");
      });
    });

    test("skips when no config exists", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createOrphanedBlob(ctx, "orphan", ONE_DAY_MS);
      });

      await t.action(internal.background.gcOrphanedBlobs, {});

      await t.run(async (ctx) => {
        expect(await countBlobs(ctx)).toBe(1);
      });
    });

    test("skips when freezeGc is true", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await storeConfig(ctx, { ...testConfig, freezeGc: true });
        await createOrphanedBlob(ctx, "orphan", ONE_DAY_MS);
      });

      await t.action(internal.background.gcOrphanedBlobs, {});

      await t.run(async (ctx) => {
        expect(await countBlobs(ctx)).toBe(1);
      });
    });

    test("handles missing blobs gracefully (already deleted from storage)", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await storeConfig(ctx, { ...testConfig, blobGracePeriod: 1 });
        // Create blob record but NO blob in storage
        await createOrphanedBlob(ctx, "missing", ONE_DAY_MS);
      });

      // Should not throw - missing blob is OK (status: "not_found")
      await t.action(internal.background.gcOrphanedBlobs, {});

      await t.run(async (ctx) => {
        // Blob record should still be cleaned up
        expect(await countBlobs(ctx)).toBe(0);
      });
    });

    test("cleans up all orphaned blobs across multiple scheduled batches (150 items)", async () => {
      vi.useFakeTimers();
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await storeConfig(ctx, { ...testConfig, blobGracePeriod: 1 });
        // Create 150 orphaned blobs (exceeds batch size of 100)
        for (let i = 0; i < 150; i++) {
          await createOrphanedBlob(ctx, `blob-${i}`, ONE_DAY_MS);
        }
      });

      await t.action(internal.background.gcOrphanedBlobs, {});
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());

      await t.run(async (ctx) => {
        expect(await countBlobs(ctx)).toBe(0);
      });

      vi.useRealTimers();
    });
  });
});

// ============================================================================
// File GC (FGC) Tests
// ============================================================================

describe("File GC (FGC)", () => {
  describe("findExpiredFiles", () => {
    test("returns files with expiresAt in the past", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createExpiredFile(ctx, "/expired-1.txt", "blob-1", TWO_HOURS_MS);
        await createExpiredFile(ctx, "/expired-2.txt", "blob-2", TWO_HOURS_MS);
      });

      const expired = await t.query(internal.background.findExpiredFiles, {
        threshold: Date.now(),
        limit: 100,
      });

      expect(expired).toHaveLength(2);
      expect(expired.map((f) => f.path).sort()).toEqual([
        "/expired-1.txt",
        "/expired-2.txt",
      ]);
    });

    test("does not return files with expiresAt in the future", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createExpiredFile(ctx, "/expired.txt", "blob-1", TWO_HOURS_MS);
        await createFileWithFutureExpiry(
          ctx,
          "/not-expired.txt",
          "blob-2",
          ONE_HOUR_MS,
        );
      });

      const expired = await t.query(internal.background.findExpiredFiles, {
        threshold: Date.now(),
        limit: 100,
      });

      expect(expired).toHaveLength(1);
      expect(expired[0].path).toBe("/expired.txt");
    });

    test("does not return files without expiresAt", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createExpiredFile(ctx, "/expired.txt", "blob-1", TWO_HOURS_MS);
        await createFileWithoutExpiry(ctx, "/no-expiry.txt", "blob-2");
      });

      const expired = await t.query(internal.background.findExpiredFiles, {
        threshold: Date.now(),
        limit: 100,
      });

      expect(expired).toHaveLength(1);
      expect(expired[0].path).toBe("/expired.txt");
    });

    test("respects limit parameter", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await createExpiredFile(
            ctx,
            `/file-${i}.txt`,
            `blob-${i}`,
            TWO_HOURS_MS,
          );
        }
      });

      const expired = await t.query(internal.background.findExpiredFiles, {
        threshold: Date.now(),
        limit: 5,
      });

      expect(expired).toHaveLength(5);
    });
  });

  describe("gcExpiredFiles", () => {
    test("deletes expired files from DB", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createExpiredFile(ctx, "/expired-1.txt", "blob-1", TWO_HOURS_MS);
        await createExpiredFile(ctx, "/expired-2.txt", "blob-2", TWO_HOURS_MS);
      });

      await t.action(internal.background.gcExpiredFiles, {});

      await t.run(async (ctx) => {
        expect(await countFiles(ctx)).toBe(0);
      });
    });

    test("decrements blob refCount when file is deleted", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createExpiredFile(ctx, "/expired.txt", "blob-1", TWO_HOURS_MS);
      });

      await t.action(internal.background.gcExpiredFiles, {});

      await t.run(async (ctx) => {
        const blob = await getBlob(ctx, "blob-1");
        expect(blob).not.toBeNull();
        expect(blob!.refCount).toBe(0);
      });
    });

    test("does NOT skip when freezeGc is true (no storage deletion)", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await storeConfig(ctx, { ...testConfig, freezeGc: true });
        await createExpiredFile(ctx, "/expired.txt", "blob-1", TWO_HOURS_MS);
      });

      await t.action(internal.background.gcExpiredFiles, {});

      await t.run(async (ctx) => {
        // File should be deleted even with freezeGc (no storage impact)
        expect(await countFiles(ctx)).toBe(0);
      });
    });

    test("does not delete files with future expiresAt", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createFileWithFutureExpiry(
          ctx,
          "/not-expired.txt",
          "blob-1",
          ONE_HOUR_MS,
        );
      });

      await t.action(internal.background.gcExpiredFiles, {});

      await t.run(async (ctx) => {
        expect(await countFiles(ctx)).toBe(1);
      });
    });

    test("does not delete files without expiresAt", async () => {
      const t = initConvexTest();

      await t.run(async (ctx) => {
        await createFileWithoutExpiry(ctx, "/no-expiry.txt", "blob-1");
      });

      await t.action(internal.background.gcExpiredFiles, {});

      await t.run(async (ctx) => {
        expect(await countFiles(ctx)).toBe(1);
      });
    });

    test("cleans up all expired files across multiple scheduled batches (150 items)", async () => {
      vi.useFakeTimers();
      const t = initConvexTest();

      await t.run(async (ctx) => {
        // Create 150 expired files (exceeds batch size of 100)
        for (let i = 0; i < 150; i++) {
          await createExpiredFile(
            ctx,
            `/file-${i}.txt`,
            `blob-${i}`,
            TWO_HOURS_MS,
          );
        }
      });

      await t.action(internal.background.gcExpiredFiles, {});
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());

      await t.run(async (ctx) => {
        expect(await countFiles(ctx)).toBe(0);
        // All blobs should have refCount=0
        const blobs = await ctx.db.query("blobs").collect();
        expect(blobs.every((b: any) => b.refCount === 0)).toBe(true);
      });

      vi.useRealTimers();
    });
  });
});
