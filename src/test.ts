/// <reference types="vite/client" />
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import schema from "./component/schema.js";
import { createTestBlobStore, resetTestBlobStore } from "./blobstore/test.js";
const modules = import.meta.glob("./component/**/*.ts");

/**
 * Register the component with the test convex instance.
 * @param t - The test convex instance, e.g. from calling `convexTest`.
 * @param name - The name of the component, as registered in convex.config.ts.
 */
export function register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name: string = "fs",
) {
  t.registerComponent(name, schema, modules);
}

/**
 * Helpers for the in-memory `{ type: "test" }` storage backend.
 *
 * The backend keeps one store for the whole process, so that a blob written by
 * one Convex function is visible to the next. That store outlives an individual
 * `convexTest` instance, whose database is recreated each time -- so reset it
 * between tests or storage and metadata will drift apart:
 *
 * ```typescript
 * import { resetTestBlobStore } from "convex-fs/test";
 *
 * beforeEach(() => {
 *   resetTestBlobStore();
 * });
 * ```
 *
 * `createTestBlobStore()` returns a handle onto that same store, whose `_blobs`
 * map is useful for asserting on bytes written by the code under test.
 */
export { createTestBlobStore, resetTestBlobStore };

export default {
  register,
  schema,
  modules,
  createTestBlobStore,
  resetTestBlobStore,
};
