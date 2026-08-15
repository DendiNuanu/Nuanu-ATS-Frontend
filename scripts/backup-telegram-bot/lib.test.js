const test = require("node:test");
const assert = require("node:assert/strict");
const {
  estimateEta,
  formatBytes,
  formatCronSchedule,
  formatStatus,
  isAuthorizedChat,
  nextCronRun,
  parseBackupEvent,
  parseCronOutput,
  parseRcloneListing,
  parseSummaryManifest,
  statusFromLines,
} = require("./lib");

test("parses token-free backup events", () => {
  const event = parseBackupEvent("2026-08-15T10:00:00Z type=database status=success duration=12s duration_seconds=12 bytes=2048 file=db.dump failures=0");
  assert.deepEqual(event.values, { duration: "12s", duration_seconds: "12", bytes: "2048", file: "db.dump", failures: "0" });
});

test("builds status from recent event lines", () => {
  const status = statusFromLines([
    "2026-08-15T10:00:00Z type=database status=success duration=12s duration_seconds=12 bytes=2048 file=db.dump failures=0",
    "2026-08-15T10:01:00Z type=resumes status=success duration=20s duration_seconds=20 total_files=4 total_bytes=4096 failures=0",
    "2026-08-15T10:02:00Z type=disk status=warning usage=81 threshold=80",
  ]);
  assert.equal(status.database.values.bytes, "2048");
  assert.equal(status.resumes.values.total_files, "4");
  assert.match(formatStatus(status, new Date("2026-08-15T10:03:00Z")), /Database: success/);
  assert.match(formatStatus(status, new Date("2026-08-15T10:03:00Z")), /2\.0 KB/);
});

test("fails closed for duplicate or missing authorization", () => {
  assert.equal(isAuthorizedChat({ chat: { id: 5481015560 } }, "5481015560"), true);
  assert.equal(isAuthorizedChat({ chat: { id: 42 } }, "5481015560"), false);
  assert.equal(isAuthorizedChat({}, "5481015560"), false);
});

test("filters actual backup cron lines", () => {
  assert.deepEqual(parseCronOutput("# backup comment\n0 2 * * * /root/scripts/backup-database-to-drive.sh\n*/5 * * * * echo hello\n15 3 * * * check-backup-disk-usage.sh\n"), [
    "0 2 * * * /root/scripts/backup-database-to-drive.sh",
    "15 3 * * * check-backup-disk-usage.sh",
  ]);
});

test("calculates and formats the next cron run", () => {
  const next = nextCronRun("0 2 * * * /root/scripts/backup.sh", new Date("2026-08-15T01:30:00Z"));
  assert.equal(next.toISOString(), "2026-08-15T02:00:00.000Z");
  assert.match(formatCronSchedule(["0 2 * * * backup.sh"], new Date("2026-08-15T01:30:00Z")), /Next: 2026-08-15T02:00:00.000Z/);
});

test("counts real rclone objects and chooses newest by timestamp", () => {
  const listing = [
    "  100 2026-08-15 09:00:00.000000000 ats-db-daily-old.dump",
    "  200 2026-08-15 11:00:00.000000000 ats-db-daily-new.dump",
    "   64 2026-08-15 12:00:00.000000000 ats-db-daily-new.dump.sha256",
  ].join("\n");
  const result = parseRcloneListing(listing, (entry) => entry.path.endsWith(".dump"));
  assert.equal(result.count, 2);
  assert.equal(result.bytes, 300);
  assert.equal(result.newest.timestamp, "2026-08-15T11:00:00.000000000Z");
});

test("parses summary manifests and formats ETA", () => {
  assert.deepEqual(parseSummaryManifest("total_files=12\ntotal_bytes=2048\n"), { total_files: "12", total_bytes: "2048" });
  assert.equal(formatBytes(1024 * 1024), "1.0 MB");
  assert.match(estimateEta({ database: { values: { duration_seconds: "60" } }, resumes: { values: { duration_seconds: "120" } } }), /about 3 minutes/);
});
