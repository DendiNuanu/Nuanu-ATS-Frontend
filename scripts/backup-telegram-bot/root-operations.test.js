const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const wrapperPath = path.join(__dirname, "root-operations.sh");

function isolatedWrapper() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nuanu-backup-operations-"));
  const script = fs.readFileSync(wrapperPath, "utf8")
    .replace("/root/Nuanu-ATS-Frontend-New/backup-logs/events.log", path.join(directory, "missing-events.log"))
    .replace("/var/spool/cron/crontabs/root", path.join(directory, "missing-root-crontab"));
  const file = path.join(directory, "root-operations.sh");
  fs.writeFileSync(file, script, { mode: 0o700 });
  return { directory, file };
}

for (const command of ["status", "cron"]) {
  test(`${command} succeeds with empty output when its source file is absent`, (context) => {
    const { directory, file } = isolatedWrapper();
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    const result = spawnSync(file, [command], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  });
}
