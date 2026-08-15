#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const {
  estimateEta,
  formatBytes,
  formatCronSchedule,
  formatStatus,
  parseBackupEvent,
  parseCronOutput,
  parseRcloneListing,
  statusFromLines,
  isAuthorizedChat,
  run,
} = require("./lib");

const APP_DIR = process.env.BACKUP_APP_DIR || "/root/Nuanu-ATS-Frontend-New";
const config = {
  appDir: APP_DIR,
  rootOperations: process.env.BACKUP_ROOT_OPERATIONS || "/usr/local/sbin/nuanu-ats-backup-operations",
  driveFolderId: process.env.GDRIVE_BACKUP_FOLDER_ID || "12p3aqJxm8CKPQL8rXVniqJk2Cn2zbRiW",
  authorizedChatId: String(process.env.TELEGRAM_AUTHORIZED_CHAT_ID || "5481015560"),
  pollSeconds: Number(process.env.TELEGRAM_POLL_SECONDS || 30),
  stateFile: process.env.BACKUP_BOT_STATE_FILE || "/var/lib/nuanu-ats-backup-bot/state.json",
};

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

let updateOffset = 0;
let stopped = false;
let manualBackupRunning = false;
let state = readState(config.stateFile);

function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return { lastEventLine: null }; }
}

function saveState() {
  fs.mkdirSync(path.dirname(config.stateFile), { recursive: true });
  const temporary = `${config.stateFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(temporary, config.stateFile);
}

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`Telegram ${method} failed: ${response.status}`);
  return payload.result;
}

async function send(chatId, text) {
  return telegram("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}

function helpText() {
  return [
    "Nuanu ATS backup monitor",
    "/status - latest backup results, freshness, and disk use",
    "/cron - configured backup schedule",
    "/verify - live Google Drive counts and newest entries",
    "/backup_now - run both existing backup scripts",
    "/eta - estimate combined backup duration",
    "/help - show this help",
  ].join("\n");
}

async function handleCommand(message, command) {
  const chatId = message.chat.id;
  switch (command) {
    case "/help": return send(chatId, helpText());
    case "/status": {
      const output = await run("sudo", [config.rootOperations, "status"]);
      return send(chatId, formatStatus(statusFromLines(output.split(/\r?\n/).filter(Boolean))));
    }
    case "/cron": {
      const output = await run("sudo", [config.rootOperations, "cron"]);
      const entries = parseCronOutput(output);
      return send(chatId, formatCronSchedule(entries));
    }
    case "/verify": {
      const output = await run("sudo", [config.rootOperations, "verify"]);
      const sections = output.split(/\n--(RESUMES|DATABASE-LISTING|RESUME-LISTING)--\n/);
      const database = parseRcloneListing(sections[4] || "", (entry) => entry.path.endsWith(".dump"));
      const resumes = parseRcloneListing(sections[6] || "", (entry) => !entry.path.startsWith("manifests/"));
      return send(chatId, [
        `Google Drive live verification (${config.driveFolderId})`,
        `Database dumps: ${database.count} files, ${formatBytes(database.bytes)}`,
        `Resumes: ${resumes.count} files, ${formatBytes(resumes.bytes)}`,
        `Combined size: ${formatBytes(database.bytes + resumes.bytes)}`,
        `Newest database timestamp: ${database.newest?.timestamp || "none"}`,
        `Newest resume timestamp: ${resumes.newest?.timestamp || "none"}`,
      ].join("\n"));
    }
    case "/eta": {
      const output = await run("sudo", [config.rootOperations, "status"]);
      return send(chatId, estimateEta(statusFromLines(output.split(/\r?\n/).filter(Boolean))));
    }
    case "/backup_now": {
      if (manualBackupRunning) return send(chatId, "A manual backup is already running.");
      manualBackupRunning = true;
      await send(chatId, "Backup started. I will report completion or failure when both existing scripts finish.");
      const started = Date.now();
      try {
        await run("sudo", [config.rootOperations, "backup"], { timeout: 6 * 60 * 60 * 1000 });
        return send(chatId, `Manual database and resume backups completed in ${Math.ceil((Date.now() - started) / 1000)}s.`);
      } catch (error) {
        return send(chatId, `Manual backup failed after ${Math.ceil((Date.now() - started) / 1000)}s (exit ${error.code || "unknown"}). Check /status for the recorded result.`);
      } finally {
        manualBackupRunning = false;
      }
    }
    default: return send(chatId, "Unknown command. Use /help.");
  }
}

async function processEvents() {
  let lines;
  try {
    const output = await run("sudo", [config.rootOperations, "status"]);
    lines = output.split(/\r?\n/).filter(Boolean);
  } catch {
    return;
  }
  if (!state.lastEventLine) {
    state.lastEventLine = lines.slice(-1)[0] || null;
    saveState();
    return;
  }
  const lastIndex = lines.lastIndexOf(state.lastEventLine);
  if (lastIndex < 0) {
    state.lastEventLine = lines.slice(-1)[0] || null;
    saveState();
    return;
  }
  const newLines = lines.slice(lastIndex + 1);
  const events = newLines.map(parseBackupEvent).filter(Boolean);
  if (newLines.length) state.lastEventLine = newLines.slice(-1)[0];
  saveState();
  for (const event of events) {
    if (event.type === "disk" && event.status === "warning") {
      await send(config.authorizedChatId, `Disk warning: ${event.values.usage || "unknown"}% used (threshold ${event.values.threshold || "80"}%).`);
    } else if (["database", "resumes"].includes(event.type) && ["success", "failure", "partial"].includes(event.status)) {
      await send(config.authorizedChatId, `${event.type === "database" ? "Database" : "Resume"} backup ${event.status}.\n${Object.entries(event.values).map(([key, value]) => `${key}=${value}`).join(" | ")}`);
    }
  }
}

async function poll() {
  while (!stopped) {
    try {
      const updates = await telegram("getUpdates", { offset: updateOffset, timeout: config.pollSeconds });
      for (const update of updates) {
        updateOffset = update.update_id + 1;
        const message = update.message;
        if (!isAuthorizedChat(message, config.authorizedChatId)) continue;
        const command = (message.text || "").trim().split(/\s+/)[0].toLowerCase().split("@")[0];
        if (command.startsWith("/")) await handleCommand(message, command);
      }
      await processEvents();
    } catch (error) {
      console.error(`bot loop error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

process.on("SIGTERM", () => { stopped = true; });
process.on("SIGINT", () => { stopped = true; });
poll().catch((error) => { console.error(`bot stopped: ${error.message}`); process.exit(1); });
