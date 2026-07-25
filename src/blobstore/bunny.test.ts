/**
 * Tests for Bunny.net CDN URL signing (Advanced Token Authentication,
 * HMAC-SHA256).
 *
 * Signing is pure — no network I/O — so these drive the public
 * `generateDownloadUrl` surface directly rather than mocking `fetch`.
 *
 * The expected tokens below are golden values produced by an independent
 * implementation of Bunny's algorithm (see
 * https://github.com/BunnyWay/BunnyCDN.TokenAuthentication), deliberately not
 * derived from this module's own code: a test that recomputed the hash the same
 * way the implementation does would have passed against the bug in #13.
 *
 * They were additionally verified end-to-end against a live Bunny Pull Zone —
 * a token this code produces is accepted by the CDN, and a deliberately
 * malformed one is rejected.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { createBunnyBlobStore } from "./bunny.js";

const TOKEN_KEY = "test-security-key";
const CDN_HOSTNAME = "test.b-cdn.net";
const KEY = "abc123.wav";

// Pinned clock so `expires` is deterministic: 2026-01-01T00:00:00Z.
const NOW_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const EXPIRES = 1767229200; // NOW_MS / 1000 + 3600

function signedStore() {
  return createBunnyBlobStore({
    apiKey: "test-api-key",
    storageZoneName: "test-zone",
    cdnHostname: CDN_HOSTNAME,
    tokenKey: TOKEN_KEY,
  });
}

function unsignedStore() {
  return createBunnyBlobStore({
    apiKey: "test-api-key",
    storageZoneName: "test-zone",
    cdnHostname: CDN_HOSTNAME,
  });
}

describe("bunny generateDownloadUrl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("without token authentication", () => {
    test("returns a plain CDN URL", async () => {
      const url = await unsignedStore().generateDownloadUrl(KEY);
      expect(url).toBe(`https://${CDN_HOSTNAME}/${KEY}`);
    });

    test("appends URL-encoded extra params and no token", async () => {
      const url = await unsignedStore().generateDownloadUrl(KEY, {
        extraParams: { filename: "Artist - Track.wav" },
      });
      expect(url).toBe(
        `https://${CDN_HOSTNAME}/${KEY}?filename=Artist%20-%20Track.wav`,
      );
      expect(url).not.toContain("token=");
    });
  });

  describe("with token authentication", () => {
    test("signs path and expiry when there are no extra params", async () => {
      const url = await signedStore().generateDownloadUrl(KEY);
      expect(url).toBe(
        `https://${CDN_HOSTNAME}/${KEY}` +
          `?token=HS256-A-4O1eagTSrzfGy4TWiCHvB2BoVOKD4eWCJ6FssYS_k` +
          `&expires=${EXPIRES}`,
      );
    });

    test("honors a custom expiresIn", async () => {
      const url = await signedStore().generateDownloadUrl(KEY, {
        expiresIn: 60,
      });
      expect(url).toBe(
        `https://${CDN_HOSTNAME}/${KEY}` +
          `?token=HS256-RF3AVzBSoBllxqJVAYExJYqAg0E3AhrZ60z23o1dHdA` +
          `&expires=${Math.floor(NOW_MS / 1000) + 60}`,
      );
    });

    test("produces an HS256-prefixed, unpadded base64url token", async () => {
      const url = await signedStore().generateDownloadUrl(KEY);
      const token = new URL(url).searchParams.get("token")!;
      expect(token.startsWith("HS256-")).toBe(true);
      expect(token.slice("HS256-".length)).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token).not.toContain("=");
    });

    // Regression test for https://github.com/jamwt/convex-fs/issues/13
    test("hashes the DECODED param value but sends the ENCODED one", async () => {
      const url = await signedStore().generateDownloadUrl(KEY, {
        extraParams: { filename: "Artist - Track.wav" },
      });

      // Golden token over the raw value: "filename=Artist - Track.wav".
      expect(url).toBe(
        `https://${CDN_HOSTNAME}/${KEY}` +
          `?token=HS256-8_TZeI_VHnRZnf02jHTAUjhU4Le6ENYudE5xtDHuXOU` +
          `&expires=${EXPIRES}` +
          `&filename=Artist%20-%20Track.wav`,
      );

      // The wire format must stay encoded so the URL is well-formed, and must
      // decode back to exactly what was signed.
      const parsed = new URL(url);
      expect(parsed.search).toContain("filename=Artist%20-%20Track.wav");
      expect(parsed.searchParams.get("filename")).toBe("Artist - Track.wav");
    });

    test("handles non-ASCII values", async () => {
      const url = await signedStore().generateDownloadUrl(KEY, {
        extraParams: { filename: "Ünïcodé Trâck.wav" },
      });
      expect(url).toBe(
        `https://${CDN_HOSTNAME}/${KEY}` +
          `?token=HS256-uvdJad2vALflTV5KZRUl4pNWHv-ZPfcBgrAvbeoTX_4` +
          `&expires=${EXPIRES}` +
          `&filename=%C3%9Cn%C3%AFcod%C3%A9%20Tr%C3%A2ck.wav`,
      );
      expect(new URL(url).searchParams.get("filename")).toBe(
        "Ünïcodé Trâck.wav",
      );
    });

    test("sorts params alphabetically in both signature and URL", async () => {
      // Insertion order is deliberately not alphabetical.
      const url = await signedStore().generateDownloadUrl(KEY, {
        extraParams: { width: "800", filename: "My File.jpg" },
      });
      expect(url).toBe(
        `https://${CDN_HOSTNAME}/${KEY}` +
          `?token=HS256-zbYNimHNJUT2WKJNn-QuoSySTpk8O30VjaVfKOoJnEo` +
          `&expires=${EXPIRES}` +
          `&filename=My%20File.jpg&width=800`,
      );
    });

    test("treats an empty extraParams object as no params", async () => {
      const withEmpty = await signedStore().generateDownloadUrl(KEY, {
        extraParams: {},
      });
      const without = await signedStore().generateDownloadUrl(KEY);
      expect(withEmpty).toBe(without);
    });

    test("uses the security key as the HMAC key, not a message prefix", async () => {
      // A bare SHA256(key + message) digest -- the pre-0.3.0 scheme -- would be
      // 43 base64url chars with no prefix. Guard against regressing to it.
      const url = await signedStore().generateDownloadUrl(KEY, {
        extraParams: { filename: "track.wav" },
      });
      expect(url).toBe(
        `https://${CDN_HOSTNAME}/${KEY}` +
          `?token=HS256-anaiIs2aXLsgjvm0gLmHTRkeLkHuwlAMSlQZzZjvFME` +
          `&expires=${EXPIRES}` +
          `&filename=track.wav`,
      );
      // The legacy digest for these exact inputs, which must NOT appear.
      expect(url).not.toContain("57V5wnmO7W4xld5ufP7GxXGWE6HmLpzlkyhVXcTt81Q");
    });

    test("changes the token when the security key changes", async () => {
      const other = createBunnyBlobStore({
        apiKey: "test-api-key",
        storageZoneName: "test-zone",
        cdnHostname: CDN_HOSTNAME,
        tokenKey: "a-different-security-key",
      });
      const a = await signedStore().generateDownloadUrl(KEY);
      const b = await other.generateDownloadUrl(KEY);
      expect(a).not.toBe(b);
    });
  });

  describe("generateUploadUrl", () => {
    test("throws, since Bunny has no presigned uploads", async () => {
      await expect(unsignedStore().generateUploadUrl(KEY)).rejects.toThrow(
        /does not support presigned upload URLs/,
      );
    });
  });
});
