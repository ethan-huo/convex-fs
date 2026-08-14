/**
 * Tests for content-type → extension mapping used when generating blob keys.
 */
import { describe, test, expect } from "vitest";
import { extensionForContentType } from "./extension.js";

describe("extensionForContentType", () => {
  test("maps common media types", () => {
    expect(extensionForContentType("video/mp4")).toBe(".mp4");
    expect(extensionForContentType("video/quicktime")).toBe(".mov");
    expect(extensionForContentType("image/jpeg")).toBe(".jpg");
    expect(extensionForContentType("image/png")).toBe(".png");
    expect(extensionForContentType("audio/mpeg")).toBe(".mp3");
    expect(extensionForContentType("application/pdf")).toBe(".pdf");
  });

  test("ignores content-type parameters", () => {
    expect(extensionForContentType("image/jpeg; charset=binary")).toBe(".jpg");
    expect(extensionForContentType("video/mp4;codecs=avc1")).toBe(".mp4");
  });

  test("is case-insensitive", () => {
    expect(extensionForContentType("VIDEO/MP4")).toBe(".mp4");
    expect(extensionForContentType("Image/PNG")).toBe(".png");
  });

  test("returns empty string for unknown or opaque types", () => {
    expect(extensionForContentType("application/octet-stream")).toBe("");
    expect(extensionForContentType("application/x-made-up")).toBe("");
    expect(extensionForContentType("")).toBe("");
  });

  test("never returns undefined", () => {
    expect(typeof extensionForContentType("whatever")).toBe("string");
  });
});
