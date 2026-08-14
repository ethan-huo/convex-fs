import type {
  BlobStore,
  DeleteResult,
  DownloadUrlOptions,
  PutOptions,
} from "./types.js";

/**
 * Backing store for the in-memory test blob store.
 *
 * This is deliberately module-scoped rather than per-instance. Every call site
 * builds its own store via `createBlobStore(config)` -- the upload route, the
 * GC jobs and `getDownloadUrl` each construct one independently -- so a
 * per-instance map would mean a blob written by one Convex function was
 * invisible to the next. Under `convex-test` everything runs in a single
 * process, so sharing one map gives the store the persistence that real
 * backends have, and lets tests assert on bytes written by code under test.
 *
 * Call `resetTestBlobStore()` between tests to keep them isolated.
 */
const blobs = new Map<string, { data: Uint8Array; contentType: string }>();

/**
 * Clear all blobs held by the in-memory test store.
 *
 * The store is process-global, so call this in `beforeEach` to stop state
 * leaking between tests.
 */
export function resetTestBlobStore(): void {
  blobs.clear();
}

/**
 * In-memory BlobStore for testing.
 *
 * NOT for production use - blobs are held in memory and shared process-wide.
 * This is only useful in convex-test where everything runs in a single process.
 */
export function createTestBlobStore(): BlobStore & {
  /** Access stored blobs for test assertions */
  _blobs: Map<string, { data: Uint8Array; contentType: string }>;
} {
  return {
    _blobs: blobs,

    async generateUploadUrl(): Promise<string> {
      throw new Error(
        "Test store does not support presigned upload URLs. Use put() directly.",
      );
    },

    async generateDownloadUrl(
      key: string,
      opts?: DownloadUrlOptions,
    ): Promise<string> {
      let url = `test://${key}`;
      if (opts?.extraParams && Object.keys(opts.extraParams).length > 0) {
        const queryString = Object.entries(opts.extraParams)
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
          .join("&");
        url += `?${queryString}`;
      }
      return url;
    },

    async put(
      key: string,
      data: Blob | Uint8Array | ReadableStream<Uint8Array>,
      opts?: PutOptions,
    ): Promise<void> {
      let bytes: Uint8Array;

      if (data instanceof ReadableStream) {
        // Collect all chunks from the stream
        const chunks: Uint8Array[] = [];
        const reader = data.getReader();
        let failure: unknown;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
        } catch (error) {
          // Mirror a real interrupted HTTP PUT: the bytes read before the
          // stream failed may already have reached the backend. Persisting
          // them here means callers must clean up after a failed put, exactly
          // as they must against real storage.
          failure = error;
        }

        // Concatenate chunks into single Uint8Array
        const totalLength = chunks.reduce(
          (sum, chunk) => sum + chunk.length,
          0,
        );
        bytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }

        if (failure !== undefined) {
          blobs.set(key, {
            data: bytes,
            contentType: opts?.contentType ?? "application/octet-stream",
          });
          throw failure;
        }
      } else if (data instanceof Blob) {
        bytes = new Uint8Array(await data.arrayBuffer());
      } else {
        bytes = data;
      }

      blobs.set(key, {
        data: bytes,
        contentType: opts?.contentType ?? "application/octet-stream",
      });
    },

    async get(key: string): Promise<Blob | null> {
      const stored = blobs.get(key);
      if (!stored) return null;
      return new Blob([stored.data.buffer as ArrayBuffer], {
        type: stored.contentType,
      });
    },

    async delete(key: string): Promise<DeleteResult> {
      if (blobs.has(key)) {
        blobs.delete(key);
        return { status: "deleted" };
      }
      return { status: "not_found" };
    },
  };
}
