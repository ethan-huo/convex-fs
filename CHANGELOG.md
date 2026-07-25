# Changelog

## Unreleased

- `uploadAuth` now receives the request context as a second argument -- `url`,
  `headers`, `params`, `contentType` and `contentLength` -- so uploads can be
  authorized on what is being uploaded, not just who is uploading. The callback
  may also return `{ allowed, maxBytes }` to cap an individual upload; the cap
  is enforced while streaming, and exceeding it aborts the upload, deletes the
  partial object and returns 413. Existing `async (ctx) => boolean` callbacks
  are unaffected. `registerRoutes` gains `allowedHeaders` so custom headers
  survive the CORS preflight. (#9)
- Bugfix -- recorded file sizes are now measured rather than trusted. The upload
  proxy took `size` straight from the client's `Content-Length` header, so
  uploads sent without one (chunked encoding, or `fetch` with a stream body)
  recorded `size: 0`, and a client could otherwise report any value it liked.
  Bytes are now counted as they stream. Files uploaded before this release keep
  whatever size was recorded; re-uploading corrects them.
- Bugfix -- a failed upload no longer leaves bytes stranded in storage. If the
  transfer or the follow-up bookkeeping failed, the partial object was left
  behind with nothing referencing it, so upload GC never reclaimed it.

- Blob keys now carry a file extension derived from the upload's `Content-Type`.
  Bunny.net's CDN infers the served `Content-Type` from the key's extension, so
  extensionless keys were served as `application/octet-stream`, which breaks
  strict byte-range media players. Backward compatible -- existing extensionless
  keys keep resolving. (#17)
- Bugfix -- signed Bunny CDN URLs returned 403 whenever a CDN parameter value
  contained characters that percent-encode (spaces, accents, etc). The SHA256
  signature hashed the encoded value while Bunny validates against the decoded
  one. Parameters are now hashed raw and only encoded on the wire. URLs without
  CDN parameters, and parameter values needing no encoding, are unaffected.
  (#13)
- Signed Bunny CDN URLs now use Advanced Token Authentication's HMAC-SHA256
  scheme (`HS256-` prefixed tokens) instead of the legacy
  `SHA256(key + message)` digest, which Bunny replaced across all of their
  reference clients in April 2026. The legacy construction hashed the secret as
  a message prefix -- the pattern HMAC exists to replace -- and could not
  express directory tokens, IP locking, or geo-restrictions.

  **No action required.** Same Pull Zone setting, same key, no configuration
  change. Bunny accepts both schemes today, so URLs signed before you upgrade
  keep working until they expire. Pull Zones without token authentication are
  unaffected entirely. Verified end-to-end against a live Pull Zone.

## 0.2.1

Bugfix -- add "Authorization" to CORS headers so auth works on the HTTP routes.

## 0.2.0

- Move data plane out of component to allow large uploads/downloads
- Support passing extra params through to bunny's CDN for edge rules that custom
  filenames, image optimization, custom cache rules, etc.

## 0.1.7

File expiration.

## 0.1.6

Removed lucide-react from deps.

## 0.1.5

NOOP

## 0.1.4

NOOP

## 0.1.3

Support path-based auth on blob download endpoint.

## 0.1.2

Minor package metadata fixes.

## 0.1.1

Minor docs fixes.

## 0.0.0

- Initial release.
