/**
 * Tests for Bunny.net CDN URL signing (advanced token authentication).
 *
 * Signing is pure — no network I/O — so these drive the public
 * `generateDownloadUrl` surface directly rather than mocking `fetch`.
 *
 * The expected tokens below are golden values produced by an independent
 * implementation of Bunny's algorithm (see
 * https://github.com/BunnyWay/BunnyCDN.TokenAuthentication), deliberately not
 * derived from this module's own code: a test that recomputed the hash the same
 * way the implementation does would have passed against the bug in #13.
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
          `?token=yeWW_FuOzFMe5D0ZvcZ-rIGyK6lKmJ2_8F3dAc6jXeY` +
          `&expires=${EXPIRES}`,
      );
    });

    test("honors a custom expiresIn", async () => {
      const url = await signedStore().generateDownloadUrl(KEY, {
        expiresIn: 60,
      });
      expect(url).toContain(`&expires=${Math.floor(NOW_MS / 1000) + 60}`);
    });

    test("produces a URL-safe base64 token with no padding", async () => {
      const url = await signedStore().generateDownloadUrl(KEY);
      const token = new URL(url).searchParams.get("token")!;
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token).not.toContain("=");
    });

    // Regression test for https://github.com/jamwt/convex-fs/issues/13
    test("hashes the DECODED param value but sends the ENCODED one", async () => {
      const url = await signedStore().generateDownloadUrl(KEY, {
        extraParams: { filename: "Artist - Track.wav" },
      });

      // Golden token over the raw value: "filename=Artist - Track.wav".
      // Pre-fix this was r_P7RiJR7xFLd8P6CtfqxgHPhUJ2VrSgj4bXd9RXlVY, which
      // hashed the percent-encoded form and made Bunny return 403.
      expect(url).toBe(
        `https://${CDN_HOSTNAME}/${KEY}` +
          `?token=rVSpKHu3n9t9AvctUx5aruycaPtRm1FKe-cIOldhZXE` +
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
          `?token=CDlamkNtge2pHL0UE2tcq5mz6tvZ-C-NYORvoj5KlKE` +
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
          `?token=gMjstSlKUY5wFudTieTWQNdhH8uJuIQonotQLrXpQ0k` +
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

    // Guards the blast radius of the #13 fix: when a value contains nothing
    // that percent-encodes, encoded and decoded forms are identical, so the
    // token must be byte-identical to what 0.2.1 produced.
    test("does not change tokens for values needing no encoding", async () => {
      const url = await signedStore().generateDownloadUrl(KEY, {
        extraParams: { filename: "track.wav" },
      });
      expect(url).toBe(
        `https://${CDN_HOSTNAME}/${KEY}` +
          `?token=57V5wnmO7W4xld5ufP7GxXGWE6HmLpzlkyhVXcTt81Q` +
          `&expires=${EXPIRES}` +
          `&filename=track.wav`,
      );
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
