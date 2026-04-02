# ConvexFS Streaming I/O Requirements

## Background

ConvexFS already has partial streaming support in the lower layers, but the
public client API still exposes a buffered mental model.

Current state in this fork:

- `BlobStore.put(...)` already accepts `ReadableStream<Uint8Array>` and Bunny's
  implementation streams correctly.
  Source: `src/blobstore/types.ts`, `src/blobstore/bunny.ts`
- `registerRoutes(...)/upload` already streams `req.body` directly into the blob
  store.
  Source: `src/client/index.ts`
- But the top-level `ConvexFS` client API still forces buffered reads/writes:
  - `getBlob(...) -> Promise<ArrayBuffer | null>`
  - `getFile(...) -> Promise<{ data: ArrayBuffer, ... } | null>`
  - `writeBlob(..., data: ArrayBuffer, ...)`
  - `writeFile(..., data: ArrayBuffer, ...)`
  Source: `src/client/index.ts`

This mismatch is the real problem. The storage backend can stream, the HTTP
upload proxy can stream, but the public API that app code actually uses still
pushes consumers toward `arrayBuffer()`-style buffering.

In real applications, especially media generation pipelines, this causes:

- large output persistence to OOM in action runtimes
- forced local workarounds that bypass ConvexFS abstractions
- duplicated Bunny-specific code in app repos
- broken trust in ConvexFS as the canonical storage boundary

## Problem Statement

ConvexFS is currently a half-finished abstraction for large-object I/O.

More specifically:

1. Uploads are only first-class streaming when the caller goes through the HTTP
   upload proxy or talks to the `BlobStore` directly.
2. Reads are effectively buffer-only at the public API surface.
3. The highest-level convenience methods (`writeBlob`, `writeFile`, `getBlob`,
   `getFile`) incentivize loading entire files into memory.
4. Applications that need robust media handling are forced to bypass the
   library, which means ConvexFS loses architectural ownership of file I/O.

This is not just a performance bug. It is an API design bug.

## Goals

### Primary Goal

Make streaming a first-class, officially supported capability of ConvexFS for
both reads and writes.

### Secondary Goals

- Preserve ConvexFS as the storage abstraction boundary for app code.
- Keep current path/blob/commit semantics intact.
- Make large media workflows possible without custom Bunny glue code.
- Provide a migration path that does not break existing buffered users.

## Non-Goals

- This work does not redesign transactions, ref-counting, GC, or file path
  semantics.
- This work does not change the storage backend contract away from Bunny/S3-like
  object stores.
- This work does not require all existing APIs to become streaming-only.
  Buffered APIs may remain as convenience wrappers.
- This work does not solve arbitrary media transformation workflows inside
  ConvexFS itself.

## User Stories

### 1. Stream provider output directly into storage

As an app author, when I receive a remote `ReadableStream` from `fetch(url)`,
I want to pass that stream into ConvexFS directly and then commit it, without
creating an intermediate `ArrayBuffer`.

### 2. Stream file content back out

As an app author, when I need to pipe a stored file into another service, I
want ConvexFS to give me a `ReadableStream<Uint8Array>` or equivalent response
handle, without forcing a full in-memory read.

### 3. Keep small-file ergonomics

As an app author, when I work with small files, I still want the current
buffered helpers to be easy to use.

### 4. Stay storage-backend-agnostic at the app layer

As an app author, I want my business code to depend on ConvexFS APIs, not on
Bunny-specific upload/delete/signing code.

## Requirements

## 1. First-Class Streaming Write APIs

ConvexFS must expose public client APIs for streaming writes.

Minimum required APIs:

- `writeBlobStream(ctx, stream, contentType, opts?) -> Promise<{ blobId, size }>`
- `writeFileStream(ctx, path, stream, contentType, opts?) -> Promise<{ blobId, size }>`

Required behavior:

- Accept `ReadableStream<Uint8Array>`
- Accept optional `contentLength`
- Register the pending upload after successful storage upload
- Return the final `blobId`
- Return the final `size`
- If `contentLength` is absent, count bytes while streaming
- Never require the caller to materialize the full payload in memory

Buffered wrappers may be implemented on top of the streaming primitive:

- `writeBlob(...)` may wrap `writeBlobStream(...)`
- `writeFile(...)` may wrap `writeFileStream(...)`

## 2. First-Class Streaming Read APIs

ConvexFS must expose public client APIs for streaming reads.

Minimum required APIs:

- `getBlobStream(ctx, blobId) -> Promise<ReadableStream<Uint8Array> | null>`
- `getFileStream(ctx, path) -> Promise<{ stream, contentType, size } | null>`

Required behavior:

- Use the same signed download URL / storage access logic as current reads
- Return a stream without buffering the body
- Preserve metadata such as `contentType` and `size`
- Make `getBlob(...)` and `getFile(...)` convenience wrappers around the
  streaming APIs

Optional but desirable:

- `getBlobResponse(...) -> Promise<Response | null>`
- `getFileResponse(...) -> Promise<Response | null>`

This would make piping easier in runtimes that already work naturally with
`Response.body`.

## 3. No Hidden Full-Buffer Fallback

The new streaming APIs must not internally call `arrayBuffer()`, `blob()`, or
equivalent full-buffer reads except in the buffered compatibility wrappers.

This is a hard requirement. If the "streaming" path buffers internally, the
feature is fake.

## 4. Runtime Compatibility

The streaming APIs must work in the runtimes ConvexFS already targets:

- Convex action runtime
- HTTP action runtime
- browser/client upload proxy flows where applicable

The design should stay on Web Streams primitives:

- `ReadableStream<Uint8Array>`
- `Response`
- `fetch`

Do not introduce a Node-only stream abstraction at the public API layer.

## 5. Clear Control Plane vs Data Plane Separation

The design should explicitly preserve the existing architecture:

- control plane:
  - path metadata
  - blob registration
  - commitFiles
  - signed URL generation
- data plane:
  - actual byte upload/download through storage

Streaming APIs must make this separation more explicit, not more implicit.

## 6. Partial Failure Semantics

Streaming write APIs must document and implement clear failure semantics:

- If the storage upload fails, no pending upload must be registered.
- If the storage upload succeeds but pending-upload registration fails, behavior
  must be clearly defined and tested.
- If `writeFileStream(...)` includes an immediate commit step, the library must
  document whether this is:
  - upload then commit
  - upload and commit with best-effort cleanup on commit failure

The failure model must be explicit, not left for applications to guess.

## 7. Storage Backend Contract

`BlobStore` already accepts streams. That contract should be treated as the
canonical capability surface.

The higher-level client API must no longer lag behind it.

If any backend cannot support streaming reads or writes, that limitation must be
made explicit in backend capabilities rather than silently degrading to
buffering.

If necessary, introduce an optional capability model, for example:

- `supportsStreamingUpload`
- `supportsStreamingDownload`

But the default Bunny path should fully support both.

## 8. Route-Level Support

The upload proxy already streams request bodies. That path should remain.

In addition:

- route docs must explicitly state that `/upload` is streaming
- large upload behavior and recommended usage should be documented
- the route implementation must not regress into buffering

Download routes should also be audited so they do not introduce unnecessary
server-side buffering.

## API Shape Proposal

The exact names can change, but the capability split should look roughly like
this:

```ts
class ConvexFS {
  async writeBlobStream(
    ctx: ActionCtx,
    stream: ReadableStream<Uint8Array>,
    contentType: string,
    opts?: { contentLength?: number },
  ): Promise<{ blobId: string; size: number }>

  async writeFileStream(
    ctx: ActionCtx,
    path: string,
    stream: ReadableStream<Uint8Array>,
    contentType: string,
    opts?: { contentLength?: number },
  ): Promise<{ blobId: string; size: number }>

  async getBlobStream(
    ctx: ActionCtx,
    blobId: string,
  ): Promise<ReadableStream<Uint8Array> | null>

  async getFileStream(
    ctx: ActionCtx,
    path: string,
  ): Promise<{
    stream: ReadableStream<Uint8Array>
    contentType: string
    size: number
  } | null>

  // Existing convenience wrappers remain
  async writeBlob(...)
  async writeFile(...)
  async getBlob(...)
  async getFile(...)
}
```

## Migration Strategy

The migration should be additive first.

Phase 1:

- add streaming APIs
- keep existing buffered APIs unchanged
- update docs to recommend streaming APIs for large files

Phase 2:

- refactor buffered APIs internally to reuse streaming primitives
- audit example app and docs to use the correct API for large objects

Phase 3:

- consider de-emphasizing buffered APIs in docs for large-media workflows

Do not ship this as a breaking rewrite if an additive path is possible.

## Testing Requirements

## Unit Tests

- Bunny `put(...)` with `ReadableStream` remains covered
- new `writeBlobStream(...)` uploads without buffering
- new `getBlobStream(...)` returns a stream without buffering
- `writeBlob(...)` still works by wrapping the stream path
- `getBlob(...)` still works by wrapping the stream path
- missing `contentLength` correctly counts bytes
- explicit `contentLength` is preserved

## Integration Tests

- HTTP upload proxy still streams request bodies end-to-end
- large-file write path does not call `arrayBuffer()`
- large-file read path does not call `arrayBuffer()` unless the buffered wrapper
  is used
- signed download URLs still work with the streaming read path
- failed upload does not leave inconsistent metadata

## Regression Tests

Add explicit tests for the real failure mode this work is meant to prevent:

- streaming a large provider response into storage from an action runtime
- then committing and reading it back successfully

If this scenario is not in the test suite, the feature is not actually done.

## Documentation Requirements

The docs must stop implying that buffered APIs are the only normal path.

Need documentation updates for:

- API reference
- uploading files guide
- filesystem operations guide
- example app or example snippets

At minimum, docs should clearly explain:

- when to use buffered APIs
- when to use streaming APIs
- why streaming matters for large media files

## Acceptance Criteria

This work is complete only when all of the following are true:

1. A user can stream remote media into ConvexFS from an action without creating
   an intermediate `ArrayBuffer`.
2. A user can stream file contents back out of ConvexFS without first loading
   the full file into memory.
3. Existing buffered callers keep working.
4. Docs explicitly recommend the streaming APIs for large-file workflows.
5. Test coverage includes the large-file scenario that motivated this change.

## Practical Priority Order

Implement in this order:

1. `writeBlobStream(...)`
2. `writeFileStream(...)`
3. `getBlobStream(...)`
4. `getFileStream(...)`
5. buffered wrappers refactored onto streaming internals
6. docs and examples

This order solves the production pain first instead of polishing the entire API
surface before the critical path works.

## Bottom Line

ConvexFS already has the backend capability for streaming, but not the public
API discipline.

This fork should close that gap properly.

If the fork only adds another internal helper while leaving the public API
buffer-centric, the root problem will remain unsolved.
