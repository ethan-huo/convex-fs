import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";
const crons = cronJobs();
/**
 * UGC: GC expired uploads every hour at :00.
 *
 * Cleans up upload records where the upload has expired
 * (plus a 1-hour grace period). Also deletes the corresponding
 * blobs from object storage.
 *
 * The job runs to completion by scheduling follow-up runs if
 * there are more than 100 expired uploads to process (unless
 * storage errors occur, to avoid hammering during outages).
 */
crons.cron("gc-expired-uploads", "0 * * * *", // Every hour at :00
internal.background.gcExpiredUploads);
/**
 * BGC: GC orphaned blobs every hour at :20.
 *
 * Cleans up blobs with refCount=0 that have been orphaned for
 * longer than the configured grace period (default 24 hours).
 *
 * The job runs to completion by scheduling follow-up runs if
 * there are more than 100 orphaned blobs to process (unless
 * storage errors occur, to avoid hammering during outages).
 */
crons.cron("gc-orphaned-blobs", "20 * * * *", // Every hour at :20
internal.background.gcOrphanedBlobs);
/**
 * FGC: GC expired files every 15 seconds.
 *
 * Cleans up files where attributes.expiresAt is in the past.
 * Deletes the file record and decrements the blob refCount.
 * BGC will later clean up orphaned blobs from storage.
 *
 * Runs every 15 seconds for quick QoS on expiration promises.
 * Does NOT respect freezeGc since it doesn't delete storage data.
 */
crons.interval("gc-expired-files", { seconds: 15 }, internal.background.gcExpiredFiles);
export default crons;
//# sourceMappingURL=crons.js.map