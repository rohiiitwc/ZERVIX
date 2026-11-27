import crypto from "node:crypto";

export const DEMO_EMAIL = "demo@zervix.ai";
export const MAX_DEMO_USES = 5;
export const DEMO_COOKIE_NAME = "zervix_demo_uses";

function getSigningSecret(): string {
  return process.env.SESSION_SECRET?.trim() || "zervix-local-demo-counter-key";
}

function signCount(count: number): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`demo:${count}`)
    .digest("hex")
    .slice(0, 24);
}

export function encodeDemoUsesCookie(count: number): string {
  const clamped = Math.max(0, Math.min(MAX_DEMO_USES, Math.floor(count)));
  return `${clamped}.${signCount(clamped)}`;
}

export function readDemoUsesFromCookie(rawCookie?: string | null): number {
  if (!rawCookie) return 0;
  const dotIdx = rawCookie.indexOf(".");
  if (dotIdx <= 0) return MAX_DEMO_USES;
  const countStr = rawCookie.slice(0, dotIdx);
  const sig = rawCookie.slice(dotIdx + 1);
  const parsed = Number(countStr);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_DEMO_USES) {
    return MAX_DEMO_USES;
  }
  const expected = signCount(parsed);
  if (sig.length !== expected.length) return MAX_DEMO_USES;
  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(sig, "utf8"),
      Buffer.from(expected, "utf8")
    );
    return valid ? parsed : MAX_DEMO_USES;
  } catch {
    return MAX_DEMO_USES;
  }
}
