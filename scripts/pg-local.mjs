import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), ".zervix-pgdata");
fs.mkdirSync(dataDir, { recursive: true });

// Remove stale postmaster.pid if a previous local dev process exited abruptly
const stalePid = path.join(dataDir, "postmaster.pid");
if (fs.existsSync(stalePid)) {
  try {
    fs.unlinkSync(stalePid);
  } catch {
    // Ignore if locked by a live instance
  }
}

const port = Number(process.env.PG_LOCAL_PORT || 5432);
const host = "127.0.0.1";

async function main() {
  const db = new PGlite(dataDir);
  await db.waitReady;

  // Ensure the 'zervix' database exists if requested, or default 'postgres'
  try {
    await db.exec("CREATE DATABASE zervix;");
  } catch {
    // Ignore if already exists
  }

  const server = new PGLiteSocketServer({
    db,
    port,
    host,
    maxConnections: 25,
  });

  await server.start();
  console.log(`[ZERVIX DB] Local PostgreSQL (PGlite TCP) listening on ${host}:${port}`);
  console.log(`[ZERVIX DB] Data directory: ${dataDir}`);

  const shutdown = async () => {
    console.log("[ZERVIX DB] Shutting down PostgreSQL socket server...");
    await server.stop();
    await db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGBREAK", shutdown);
}

main().catch((err) => {
  console.error("[ZERVIX DB] Failed to start local PostgreSQL:", err);
  process.exit(1);
});
