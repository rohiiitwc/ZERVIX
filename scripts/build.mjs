import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit", env: process.env });
}

run("npx prisma generate");

if (process.env.VERCEL === "1" && process.env.DATABASE_URL) {
  console.log("[ZERVIX BUILD] Syncing Prisma schema to Vercel Postgres...");
  run("npx prisma db push --skip-generate");
}

run("npx next build");
