const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

function parseKeyValueLine(line) {
  const values = {};
  for (const match of line.matchAll(/([A-Za-z][A-Za-z0-9_]*)=([^\s]+)/g)) {
    values[match[1]] = match[2];
  }
  return values;
}

function parseBackupEvent(line) {
  const match = line.match(/^(\S+)\s+type=(\S+)\s+status=(\S+)(?:\s+(.*))?$/);
  if (!match) return null;
  return {
    timestamp: match[1],
    type: match[2],
    status: match[3],
    values: parseKeyValueLine(match[4] || ""),
  };
}

function readLines(file) {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function latestEvent(events, type) {
  return events.filter((event) => event.type === type).at(-1) || null;
}

function parseTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = bytes;
  let unit = -1;
  do {
    amount /= 1024;
    unit += 1;
  } while (amount >= 1024 && unit < units.length - 1);
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatAge(timestamp, now = new Date()) {
  const date = parseTimestamp(timestamp);
  if (!date) return "unknown age";
  const minutes = Math.max(0, Math.round((now - date) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusFromLines(lines) {
  const events = lines.map(parseBackupEvent).filter(Boolean);
  return {
    database: latestEvent(events, "database"),
    resumes: latestEvent(events, "resumes"),
    disk: latestEvent(events, "disk"),
  };
}

function readStatus(config) {
  return statusFromLines(readLines(config.eventLog));
}

function formatStatus(status, now = new Date()) {
  const backup = (label, event, fields, staleHours = 26) => {
    if (!event) return `${label}: no recorded result\n  WARNING: no successful backup record`;
    const details = fields.map((field) => {
      const value = event.values[field];
      if (value == null) return null;
      return field.includes("bytes") ? `${field}=${formatBytes(value)}` : `${field}=${value}`;
    }).filter(Boolean);
    const timestamp = parseTimestamp(event.timestamp);
    const stale = !timestamp || (now - timestamp) > staleHours * 60 * 60 * 1000;
    return `${label}: ${event.status} (${formatAge(event.timestamp, now)})${details.length ? `\n  ${details.join(" | ")}` : ""}${stale ? `\n  WARNING: older than ${staleHours} hours` : ""}`;
  };
  const disk = status.disk?.values?.usage ? `Disk: ${status.disk.values.usage}% used` : "Disk: no recorded threshold event";
  return [
    "Backup status",
    backup("Database", status.database, ["duration", "bytes", "file"]),
    backup("Resumes", status.resumes, ["duration", "total_files", "total_bytes", "failures"]),
    disk,
    estimateEta(status),
  ].join("\n");
}

function parseCronOutput(output) {
  return output.split(/\r?\n/).filter((line) => /backup|rclone|disk-usage/i.test(line) && !/^\s*#/.test(line));
}

function cronFieldMatches(field, value, minimum, maximum) {
  return field.split(",").some((part) => {
    const [range, stepText] = part.split("/");
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isInteger(step) || step < 1) return false;
    let start = minimum;
    let end = maximum;
    if (range !== "*") {
      if (range.includes("-")) {
        [start, end] = range.split("-").map(Number);
      } else {
        start = Number(range);
        end = Number(range);
      }
    }
    return Number.isInteger(start) && Number.isInteger(end) && value >= start && value <= end && (value - start) % step === 0;
  });
}

function nextCronRun(line, now = new Date()) {
  const fields = line.trim().split(/\s+/).slice(0, 5);
  if (fields.length !== 5 || fields.some((field) => field.startsWith("@"))) return null;
  const candidate = new Date(now.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  for (let checked = 0; checked < 366 * 24 * 60; checked += 1) {
    const values = [candidate.getUTCMinutes(), candidate.getUTCHours(), candidate.getUTCDate(), candidate.getUTCMonth() + 1, candidate.getUTCDay()];
    const limits = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
    if (fields.every((field, index) => cronFieldMatches(field, values[index], limits[index][0], limits[index][1]))) return candidate;
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  return null;
}

function formatCronSchedule(lines, now = new Date()) {
  if (!lines.length) return "No backup-related crontab entries found.";
  return ["Backup cron entries (server time interpreted as UTC):", ...lines.flatMap((line) => {
    const next = nextCronRun(line, now);
    return [line, `  Next: ${next ? next.toISOString() : "unable to calculate"}`];
  })].join("\n");
}

function parseRcloneListing(listing, predicate = () => true) {
  const entries = listing.split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(.+)$/);
    if (!match) return null;
    return { bytes: Number(match[1]), timestamp: `${match[2]}T${match[3]}Z`, path: match[4] };
  }).filter((entry) => entry && predicate(entry));
  const newest = entries.reduce((latest, entry) => !latest || entry.timestamp > latest.timestamp ? entry : latest, null);
  return {
    count: entries.length,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    newest,
  };
}

function parseSummaryManifest(content) {
  return Object.fromEntries(content.split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf("=");
    return index < 0 ? [line, ""] : [line.slice(0, index), line.slice(index + 1)];
  }));
}

function estimateEta(status, currentBytes = null) {
  const durations = [status.database, status.resumes].map((event) => Number(event?.values?.duration_seconds)).filter(Number.isFinite);
  if (!durations.length) return "ETA: no previous duration data";
  const total = durations.reduce((sum, value) => sum + value, 0);
  const sizeNote = currentBytes == null ? "" : ` for ${formatBytes(currentBytes)}`;
  return `ETA: about ${Math.max(1, Math.ceil(total / 60))} minutes${sizeNote} (latest recorded runs)`;
}

function isAuthorizedChat(message, authorizedChatId) {
  return Boolean(message?.chat?.id != null) && String(message.chat.id) === String(authorizedChatId);
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, { timeout: options.timeout || 120000, maxBuffer: 2 * 1024 * 1024, env: options.env || process.env });
  return result.stdout;
}

async function driveVerify(config) {
  const database = await run(config.rcloneBinary, ["size", `${config.databaseRemote}/daily`, "--json"]);
  const resumes = await run(config.rcloneBinary, ["size", config.resumeRemote, "--json"]);
  const databaseListing = await run(config.rcloneBinary, ["lsl", `${config.databaseRemote}/daily`]);
  const resumeListing = await run(config.rcloneBinary, ["lsl", config.resumeRemote]);
  const parseSize = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  };
  const newest = (listing) => listing.split(/\r?\n/).filter(Boolean).slice(-1)[0] || "none";
  const db = parseSize(database);
  const cv = parseSize(resumes);
  return [
    `Google Drive live verification (${config.driveFolderId})`,
    `Database dumps: ${db.count ?? "unknown"} files, ${formatBytes(db.bytes)}`,
    `Resumes: ${cv.count ?? "unknown"} files, ${formatBytes(cv.bytes)}`,
    `Newest database entry: ${newest(databaseListing)}`,
    `Newest resume entry: ${newest(resumeListing)}`,
  ].join("\n");
}

module.exports = {
  parseBackupEvent,
  parseCronOutput,
  nextCronRun,
  formatCronSchedule,
  parseRcloneListing,
  parseSummaryManifest,
  readStatus,
  statusFromLines,
  formatStatus,
  formatBytes,
  estimateEta,
  driveVerify,
  isAuthorizedChat,
  run,
};
