import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

function loadDatabaseUrl() {
  for (const file of [".env.local", ".env"]) {
    const full = path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf8");
    const match = content.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
    if (match) return match[1];
  }
  return process.env.DATABASE_URL ?? "";
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function startLocalPostgresIfNeeded() {
  const dbUrl = loadDatabaseUrl();
  const isLocal5432 =
    dbUrl.includes("127.0.0.1:5432") || dbUrl.includes("localhost:5432");

  if (!isLocal5432) {
    return null;
  }

  const alreadyRunning = await isPortOpen("127.0.0.1", 5432);
  if (alreadyRunning) {
    console.log("[ZERVIX DB] Detected PostgreSQL already listening on 127.0.0.1:5432.");
    return null;
  }

  const dataDir = path.resolve(process.cwd(), ".zervix-pgdata");
  fs.mkdirSync(dataDir, { recursive: true });

  const stalePid = path.join(dataDir, "postmaster.pid");
  if (fs.existsSync(stalePid)) {
    try {
      fs.unlinkSync(stalePid);
    } catch {
      // Ignore if locked
    }
  }

  const db = new PGlite(dataDir);
  await db.waitReady;
  try {
    await db.exec("CREATE DATABASE zervix;");
  } catch {
    // Already exists
  }

  const server = new PGLiteSocketServer({
    db,
    port: 5432,
    host: "127.0.0.1",
    maxConnections: 25,
  });
  await server.start();
  console.log("[ZERVIX DB] Auto-started local PostgreSQL (PGlite TCP) on 127.0.0.1:5432.");

  return async () => {
    await server.stop();
    await db.close();
  };
}

async function main() {
  const stopDb = await startLocalPostgresIfNeeded();
  const nextBin = path.resolve(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );

  const extraArgs = process.argv.slice(2);
  const child = spawn(process.execPath, [nextBin, "dev", ...extraArgs], {
    stdio: "inherit",
    env: process.env,
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    child.kill(signal);
    if (stopDb) {
      await stopDb();
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGBREAK", () => void shutdown("SIGBREAK"));

  child.on("exit", async (code) => {
    if (stopDb && !shuttingDown) {
      await stopDb();
    }
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[ZERVIX DEV] Startup failed:", err);
  process.exit(1);
});
