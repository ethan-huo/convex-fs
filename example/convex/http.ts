import { httpRouter } from "convex/server";
import { registerRoutes } from "convex-fs";
import { components } from "./_generated/api";
import { fs } from "./fs";

const http = httpRouter();

// Mount ConvexFS routes at /fs:
// - POST /fs/upload - Upload proxy for Bunny.net storage
// - GET /fs/blobs/{blobId} - Returns 302 redirect to signed CDN URL
registerRoutes(http, components.fs, fs, {
  pathPrefix: "/fs",
  uploadAuth: async (_ctx, info) => {
    // TODO: Add real auth check, e.g.:
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) return false;

    // This gallery is for images and media, so reject PDFs. The check runs
    // before any of the body is read, so a rejected upload never reaches
    // storage. Note the client sets Content-Type, so this is a content policy
    // rather than a security boundary -- see the note on maxBytes below for
    // the difference between a client claim and something we enforce.
    if (info.contentType.split(";")[0].trim() === "application/pdf") {
      return false;
    }

    // Cap uploads at 100 MB. Unlike Content-Type, this is enforced: bytes are
    // counted as they stream, and the upload is aborted if it runs over.
    return { allowed: true, maxBytes: 100 * 1024 * 1024 };
  },
  downloadAuth: async () => {
    // TODO: Add real auth check, e.g.:
    // const identity = await ctx.auth.getUserIdentity();
    // return identity !== null;
    return true;
  },
});

export default http;
