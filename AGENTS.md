# AGENTS.md - Guidelines for AI Coding Agents

This document provides guidelines for AI agents working on the ConvexFS
codebase.

## Project Overview

ConvexFS is a Convex component providing virtual filesystem semantics backed by
Bunny.net Edge Storage & CDN. It's structured as:

- `src/component/` - Convex backend (queries, mutations, actions, schema, crons)
- `src/blobstore/` - Storage backends (Bunny.net, in-memory test) + `BlobStore`
  interface
- `src/client/` - Client SDK (`ConvexFS` class, `registerRoutes`)
- `src/react/` - React hooks (currently just re-exports `usePaginatedQuery`)
- `src/test.ts` - `convex-test` registration helper plus the in-memory store
  helpers (exported as `convex-fs/test`)
- `example/` - Demo app with Vite frontend + Convex backend
- `docs/` - Astro Starlight docs site published to convexfs.dev

### Control plane vs. data plane

**This is the most important architectural constraint.** As of 0.2.0 the
component is _control plane only_: it stores metadata and mints signed URLs, but
blob bytes never pass through it. All actual blob I/O (`put`/`get`) happens in
the **caller's** context — the app's HTTP action or action — via
`createBlobStore(config.storage)` from `src/blobstore/`. This is what allows
arbitrarily large streaming uploads and downloads.

Do not move blob I/O back into `src/component/`. If you need bytes, do it in
`src/client/` or in the app.

## Build/Lint/Test Commands

```bash
# Install dependencies
npm install

# Development (runs backend, frontend, and build watcher)
npm run dev

# Build TypeScript
npm run build
npm run build:clean    # Clean rebuild with codegen

# Type checking (covers root, example/, and example/convex/)
npm run typecheck

# Linting

# Run all tests with type checking
npm test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npx vitest run src/blobstore/extension.test.ts

# Run tests matching a pattern
npx vitest run -t "put"

# Run a single test by name
npx vitest run -t "maps common media types"

# Debug tests
npm run test:debug

# Regenerate Convex types
npx convex dev --once
```

## Code Style Guidelines

### Formatting

- **Prettier** with trailing commas (`"trailingComma": "all"`)
- **2 spaces** for indentation (TypeScript default)
- Run `npx prettier -w <file>` to format

### Imports

1. External packages first (convex, vitest, etc.)
2. Internal absolute imports second
3. Relative imports last
4. Use `.js` extension for relative imports (ESM requirement)
5. Separate `import type` from value imports

```typescript
// External
import { v } from "convex/values";
import { describe, test, expect } from "vitest";

// Internal - types separate
import type { BlobStore, StorageConfig } from "../blobstore/types.js";
import { createBlobStore } from "../blobstore/index.js";

// Relative
import { configValidator } from "./types.js";
```

### TypeScript

- **Strict mode** enabled - no implicit any, strict null checks
- Use `type` keyword for type-only imports: `import type { Foo } from ...`
- Prefer interfaces for object shapes, types for unions/intersections
- Use `Infer<typeof validator>` to derive types from Convex validators
- Prefix unused parameters with underscore: `_ctx`, `_opts`

```typescript
// Deriving types from validators
export const configValidator = v.object({ ... });
export type Config = Infer<typeof configValidator>;

// Unused parameters
async generateUploadUrl(_key: string, _opts?: UploadUrlOptions): Promise<string>
```

### Naming Conventions

- **Files**: `camelCase.ts` for modules, `camelCase.test.ts` for tests
- **Classes**: `PascalCase` (e.g., `ConvexFS`, `BlobStore`)
- **Functions/methods**: `camelCase` (e.g., `createBlobStore`, `getDownloadUrl`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants, `camelCase` otherwise
- **Types/Interfaces**: `PascalCase` (e.g., `FileMetadata`, `StorageConfig`)
- **Validators**: `camelCaseValidator` suffix (e.g., `configValidator`)

### Convex Patterns

```typescript
// Queries/mutations/actions export pattern
export const myQuery = query({
  args: { path: v.string() },
  returns: v.union(v.null(), fileMetadataValidator),
  handler: async (ctx, args) => { ... },
});

// Internal functions use internalQuery/internalMutation/internalAction
export const myInternalQuery = internalQuery({ ... });

// Schema definition
export default defineSchema({
  tableName: defineTable({
    field: v.string(),
  }).index("indexName", ["field"]),
});
```

### Error Handling

- Throw `Error` with descriptive messages for expected failures
- Use try/catch in HTTP handlers, return appropriate status codes
- Log errors with `console.error()` before returning error responses

```typescript
// In actions/mutations
if (!config) {
  throw new Error("Storage not configured");
}

// In HTTP handlers
try {
  const result = await doSomething();
  return new Response(JSON.stringify(result), { status: 200 });
} catch (error) {
  console.error("Operation failed:", error);
  return new Response("Error message", { status: 500 });
}
```

### Testing Patterns

- Use Vitest with `describe`/`test`/`expect`. **Use `test()`, not `it()`** — the
  codebase uses `test()` exclusively.
- Test files adjacent to source: `foo.ts` -> `foo.test.ts`
- Tests run under the `edge-runtime` environment (see `vitest.config.js`)
- Use the in-memory `{ type: "test" }` storage backend rather than mocking
  `fetch`. It only works under `convex-test`, where everything is one process.
- The test backend keeps **one store for the whole process**, so a blob written
  by one Convex function is visible to the next. It therefore outlives an
  individual `convexTest` instance, whose database is rebuilt each time — call
  `resetTestBlobStore()` in `beforeEach` or storage and metadata drift apart.
  Both it and `createTestBlobStore()` are exported from `convex-fs/test`, and
  the latter's `_blobs` map is how you assert on bytes written by code under
  test.

**Pure unit tests** (no Convex runtime) — e.g.
`src/blobstore/extension.test.ts`, `src/client/index.test.ts`:

```typescript
import { describe, test, expect } from "vitest";
import { extensionForContentType } from "./extension.js";

describe("extensionForContentType", () => {
  test("maps common media types", () => {
    expect(extensionForContentType("video/mp4")).toBe(".mp4");
  });
});
```

**Component tests** — instantiate the component's own schema directly. Note the
`/// <reference types="vite/client" />` pragma required for `import.meta.glob`:

```typescript
/// <reference types="vite/client" />
import { describe, test, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema.js";
import { api, internal } from "./_generated/api.js";

const modules = import.meta.glob("./**/*.ts");

function initConvexTest() {
  return convexTest(schema, modules);
}

test("stat returns null for a missing path", async () => {
  const t = initConvexTest();
  const result = await t.query(api.ops.basics.stat, {
    config: { storage: { type: "test" } },
    path: "/nope",
  });
  expect(result).toBeNull();
});
```

Use `t.run(async (ctx) => { ... })` to seed or assert on raw table state.

**Client tests** — mount the component into a host app via the `register` helper
from `src/test.ts` (see `src/client/setup.test.ts` for `initConvexTest`).

**Testing scheduled work (GC/crons).** The background jobs self-reschedule, so
drive them with fake timers:

```typescript
vi.useFakeTimers();
const t = initConvexTest();
await t.action(internal.background.gcExpiredUploads, {});
await t.finishAllScheduledFunctions(() => vi.runAllTimers());
vi.useRealTimers();
```

**Asserting conflict errors.** `convex-test` serializes `ConvexError` data as a
JSON string, so parse before asserting (see the `expectConflictError` helper in
`src/component/ops.test.ts`).

### Documentation

- Use JSDoc comments for public APIs with `@example` blocks
- Document complex parameters with `@param`
- Keep inline comments brief and focused on "why" not "what"

## Project-Specific Patterns

### BlobStore Interface

All storage backends implement the `BlobStore` interface
(`src/blobstore/types.ts`):

```typescript
interface BlobStore {
  generateUploadUrl(key: string, opts?: UploadUrlOptions): Promise<string>;
  generateDownloadUrl(key: string, opts?: DownloadUrlOptions): Promise<string>;
  put(
    key: string,
    data: Blob | Uint8Array | ReadableStream<Uint8Array>,
    opts?: PutOptions,
  ): Promise<void>;
  get(key: string): Promise<Blob | null>;
  delete(key: string): Promise<DeleteResult>;
}
```

Notes:

- `put` accepts a `ReadableStream` so uploads stream in constant memory. The
  Bunny backend sets `duplex: "half"` on the underlying `fetch`.
- `delete` returns `{ status: "deleted" | "not_found" }` and throws only on real
  storage errors (5xx, network). GC relies on this distinction.
- Bunny has no presigned uploads, so `generateUploadUrl` throws there; uploads
  go through the app's HTTP route instead.

### Discriminated Union Config

Storage config uses discriminated unions with `type` field:

```typescript
type StorageConfig =
  | ({ type: "bunny" } & BunnyBlobStoreConfig)
  | { type: "test" };

// Factory pattern
function createBlobStore(config: StorageConfig): BlobStore {
  switch (config.type) {
    case "bunny":
      return createBunnyBlobStore({ ... });
    case "test":
      return createTestBlobStore();
    default:
      throw new Error(
        `Unknown storage type: ${(config as { type: string }).type}`,
      );
  }
}
```

The `test` backend is in-memory and only works under `convex-test`. S3 support
was removed; do not reintroduce it without discussion.

### HTTP Routes

Use `corsRouter` from convex-helpers for CORS support:

```typescript
const cors = corsRouter(http, {
  allowedOrigins: ["*"],
  allowedHeaders: ["Content-Type", "Content-Length", "Authorization"],
});

cors.route({
  path: "/upload",
  method: "POST",
  handler: httpActionGeneric(async (ctx, req) => { ... }),
});
```

`Authorization` is required in `allowedHeaders` or authenticated browser uploads
break on the preflight.

## Data Model Invariants

These are the rules that are easiest to break silently. Read before touching
`src/component/ops/` or `src/component/background.ts`.

### Reference counting is the only liveness signal

`blobs.refCount` decides whether bytes survive. It is incremented on
`commitFiles` (a new blob is born at `refCount: 1`) and on `copy`; decremented
on `delete`, on overwrite, and on `move` over an existing destination. Every
change must also stamp `blobs.updatedAt`, because that timestamp is what starts
the GC grace-period clock. **If you add a code path that creates or drops a
`files` row, it must adjust the refCount and `updatedAt`** — use the shared
`deleteFileAndDecrefBlob` helper in `src/component/ops/helpers.ts` rather than
hand-rolling it.

There are no tombstones or `deletedAt` columns. "Soft delete" is an emergent
property of the two-phase lifecycle: the `files` row goes away immediately, the
blob sits at `refCount: 0` for `blobGracePeriod` (default 24h), and only then
are the bytes removed. That window is what makes undelete possible.

### Three GC loops (`background.ts` + `crons.ts`)

| Job                      | Schedule     | Removes                                                                | Honors `freezeGc` |
| ------------------------ | ------------ | ---------------------------------------------------------------------- | ----------------- |
| `gcExpiredUploads` (UGC) | hourly `:00` | uncommitted `uploads` past their 4h TTL, plus their bytes              | yes               |
| `gcOrphanedBlobs` (BGC)  | hourly `:20` | `blobs` at `refCount: 0` older than the grace period, plus their bytes | yes               |
| `gcExpiredFiles` (FGC)   | every 15s    | `files` past `attributes.expiresAt` (metadata only)                    | **no**            |

FGC intentionally ignores `freezeGc` because it never touches object storage;
the bytes still wait for BGC. All three batch at 100 and self-reschedule with
`runAfter(0, ...)`; UGC and BGC additionally require `errorCount === 0` before
rescheduling so a storage outage can't become a hot loop. Preserve that guard.

`freezeGc` and `allowClearAllFiles` are deliberately dashboard-only — they are
in the `config` table schema but not in the client-facing `configValidator`.

### Transactions and preconditions

`transact` applies ops sequentially inside one Convex mutation, so a throw
anywhere rolls the whole batch back. Each op carries the full expected `source`
metadata, which acts as the source precondition. Destinations use a three-valued
`basis`:

- `undefined` — no check, overwrite silently
- `null` — destination must not exist
- `string` — destination's current `blobId` must match (compare-and-swap)

Failures throw `ConvexError<ConflictErrorData>` with a stable `code` and a
1-indexed `operationIndex`. Add new codes to `src/component/types.ts` rather
than throwing bare `Error`s from op handlers.

### Misc

- `files.attributes` is scoped to the path, not the blob, and is deliberately
  cleared on `move`/`copy` and replaced wholesale on overwrite.
- Paths are opaque strings — nothing normalizes or validates them. Prefix
  listing is a lexicographic range scan using a `\uffff` sentinel, so it is
  byte-prefix semantics, not true directory semantics.
- Blob keys are `crypto.randomUUID() + extensionForContentType(contentType)`.
  The extension is load-bearing: Bunny's CDN infers `Content-Type` from it, and
  without it media players break on byte-range requests.
- The component cannot read env vars, so config is persisted into the `config`
  table on `registerPendingUpload` for the crons to use.

## Common Tasks

### Adding a new storage backend

1. Create `src/blobstore/newbackend.ts` implementing `BlobStore`
2. Add its config interface and a `{ type: "newbackend" }` alias to
   `src/blobstore/types.ts`, and add the alias to the `StorageConfig` union
3. Export it and add a `case` to `createBlobStore` in `src/blobstore/index.ts`
4. Add a matching member to `storageConfigValidator` in `src/component/types.ts`
   (the component validates config on every call)
5. Write tests in `src/blobstore/newbackend.test.ts`

### Modifying schema

1. Update `src/component/schema.ts`
2. Run `npx convex dev --once` to regenerate types
3. Clear existing data if schema change is incompatible
