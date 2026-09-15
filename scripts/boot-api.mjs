// Deterministic API boot probe.
//
// The sandbox does not reliably relay stdout for long-running processes, so
// every lifecycle event is ALSO appended to .boot-api.log on disk. That file
// can be read back directly, which turns an invisible crash into a readable
// stack trace.
import fs from "node:fs";

const LOG = ".boot-api.log";
try {
  fs.writeFileSync(LOG, "");
} catch {}

const stamp = () => new Date().toISOString();
function say(tag, msg) {
  const line = `[boot ${stamp()}] ${tag}: ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG, line + "\n");
  } catch {}
}

const PORT = process.env.API_PORT || process.env.PORT || 3001;
process.env.API_PORT = String(PORT);

say("node", process.version);
say("cwd", process.cwd());
say("port", String(PORT));
say("DATABASE_URL", process.env.DATABASE_URL ? "SET" : "UNSET");
say(
  "env-port-vars",
  JSON.stringify({ PORT: process.env.PORT ?? null, API_PORT: process.env.API_PORT ?? null })
);

process.on("uncaughtException", (err) => {
  say("uncaughtException", err && err.stack ? err.stack : String(err));
});
process.on("unhandledRejection", (err) => {
  say("unhandledRejection", err && err.stack ? err.stack : String(err));
});

// Step 1: can the database module even be imported? A top-level failure here
// (PGlite failing to initialise) would stop the server before it ever listens.
try {
  say("import", "./db.js");
  const mod = await import("../db.js");
  say("imported", `db.js ok, kind=${mod.db?.kind ?? "unknown"}, managed=${mod.usingManagedPostgres}`);
} catch (err) {
  say("dbImportFailed", err && err.stack ? err.stack : String(err));
}

// Step 2: the server itself.
try {
  say("import", "./server.js");
  await import("../server.js");
  say("imported", "server module evaluated");
} catch (err) {
  say("serverImportFailed", err && err.stack ? err.stack : String(err));
}

// Step 3: prove the port is actually bound and answering.
const url = `http://127.0.0.1:${PORT}/api/health`;
for (let i = 1; i <= 15; i++) {
  await new Promise((r) => setTimeout(r, 600));
  try {
    const res = await fetch(url);
    const body = await res.text();
    say("probe", `attempt ${i} status ${res.status} body ${body.slice(0, 300)}`);
    break;
  } catch (err) {
    say("probe", `attempt ${i} no answer (${err?.cause?.code || err?.message})`);
  }
}
say("alive", "probe finished, process staying up to hold the port");
