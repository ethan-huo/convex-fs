/**
 * Maps common Content-Types to a canonical file extension (with leading dot).
 *
 * Blob keys are opaque UUIDs with no extension. Some object stores and CDNs —
 * notably Bunny.net Edge Storage — derive the `Content-Type` they *serve* from
 * the key's file extension rather than the type set at upload time. Without an
 * extension those stores serve every blob as `application/octet-stream`, which
 * breaks strict media clients: byte-range video/audio players (AVPlayer,
 * ExoPlayer) refuse to play a stream typed `application/octet-stream` even
 * though the bytes are correct. Appending the extension to the blob key makes
 * such stores serve the right `Content-Type`, and is harmless for stores that
 * honor the uploaded `Content-Type` directly (S3, R2, GCS).
 */
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  // Images
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/tiff": ".tiff",
  "image/x-icon": ".ico",
  // Video
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-matroska": ".mkv",
  "video/mpeg": ".mpeg",
  "video/3gpp": ".3gp",
  "video/x-msvideo": ".avi",
  // Audio
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "audio/ogg": ".ogg",
  "audio/opus": ".opus",
  "audio/wav": ".wav",
  "audio/webm": ".weba",
  "audio/flac": ".flac",
  // Documents & data
  "application/pdf": ".pdf",
  "application/json": ".json",
  "application/zip": ".zip",
  "application/gzip": ".gz",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "text/html": ".html",
  "text/markdown": ".md",
  "text/css": ".css",
  "text/javascript": ".js",
};

/**
 * Returns the canonical file extension (including the leading dot) for a
 * Content-Type, or an empty string when the type is unknown. Content-Type
 * parameters (e.g. `; charset=utf-8`) and casing are ignored.
 *
 * @example
 * extensionForContentType("video/mp4") // ".mp4"
 * extensionForContentType("image/jpeg; charset=binary") // ".jpg"
 * extensionForContentType("application/octet-stream") // ""
 */
export function extensionForContentType(contentType: string): string {
  const normalized = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  return EXTENSION_BY_CONTENT_TYPE[normalized] ?? "";
}
