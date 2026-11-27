import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Mock server-only so Next.js server modules can be tested in Vitest
vi.mock("server-only", () => ({}));

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: generateContentMock,
      };
    },
  };
});

describe("ZERVIX Gemini Integration & Secret Protection", () => {
  const origKey = process.env.GEMINI_API_KEY;
  const origModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    generateContentMock.mockReset();
    process.env.GEMINI_API_KEY = "test-server-key-not-real";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = origKey;
    process.env.GEMINI_MODEL = origModel;
  });

  it("handles successful Gemini response", async () => {
    generateContentMock.mockResolvedValue({
      text: "Luhn validation checks payment card candidate digits using Mod-10.",
    });

    const { generateZervixAssistantReply } = await import("@/lib/gemini/client");
    const res = await generateZervixAssistantReply({
      message: "What is Luhn validation?",
    });

    expect(res.reply).toContain("Mod-10");
    expect(res.model).toBe("gemini-2.5-flash");
  });

  it("handles invalid credentials error safely", async () => {
    generateContentMock.mockRejectedValue(new Error("401 API_KEY_INVALID"));
    const { generateZervixAssistantReply } = await import(
      "@/lib/gemini/client"
    );

    await expect(
      generateZervixAssistantReply({ message: "Hello" })
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      statusCode: 502,
    });
  });

  it("handles quota exhaustion (429 / RESOURCE_EXHAUSTED)", async () => {
    generateContentMock.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED"));
    const { generateZervixAssistantReply } = await import("@/lib/gemini/client");

    await expect(
      generateZervixAssistantReply({ message: "Hello" })
    ).rejects.toMatchObject({
      code: "QUOTA_EXHAUSTED",
      statusCode: 429,
    });
  });

  it("handles network / upstream failures safely", async () => {
    generateContentMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const { generateZervixAssistantReply } = await import("@/lib/gemini/client");

    await expect(
      generateZervixAssistantReply({ message: "Hello" })
    ).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
      statusCode: 502,
    });
  });

  it("rejects missing GEMINI_API_KEY cleanly", async () => {
    process.env.GEMINI_API_KEY = "";
    const { generateZervixAssistantReply } = await import("@/lib/gemini/client");

    await expect(
      generateZervixAssistantReply({ message: "Hello" })
    ).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
      statusCode: 503,
    });
  });

  it("ensures no NEXT_PUBLIC_GEMINI_API_KEY or raw PII columns exist in source or schema", () => {
    const srcRoot = path.resolve(process.cwd(), "src");
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        return st.isDirectory() ? walk(full) : [full];
      });

    const files = walk(srcRoot);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toContain("NEXT_PUBLIC_GEMINI_API_KEY");
    }

    const schema = fs.readFileSync(
      path.resolve(process.cwd(), "prisma/schema.prisma"),
      "utf8"
    );
    expect(schema).not.toMatch(/originalText|sanitizedText|rawContent|pseudonymMap/);
  });
});

describe("ZERVIX Privacy Boundary & Auth Helpers", () => {
  it("enforces rate limiting and reset", async () => {
    const { checkRateLimit, clearRateLimitBucketsForTest } = await import(
      "@/lib/security/rate-limit"
    );
    clearRateLimitBucketsForTest();
    expect(checkRateLimit("k1", 2, 60000).allowed).toBe(true);
    expect(checkRateLimit("k1", 2, 60000).allowed).toBe(true);
    expect(checkRateLimit("k1", 2, 60000).allowed).toBe(false);
  });

  it("hashes passwords and tokens securely without storing plaintext", async () => {
    const { hashPassword, verifyPassword, hashToken } = await import(
      "@/lib/security/auth"
    );
    const hash = await hashPassword("ZervixSecure#2026");
    expect(hash).not.toContain("ZervixSecure#2026");
    expect(await verifyPassword("ZervixSecure#2026", hash)).toBe(true);
    expect(await verifyPassword("WrongPassword", hash)).toBe(false);

    const tokenHash = hashToken("raw-token-value");
    expect(tokenHash).not.toBe("raw-token-value");
    expect(tokenHash).toHaveLength(64);
  });

  it("enforces strict per-user isolation on user documents, audit trails, and admin views", () => {
    const readApi = (rel: string) =>
      fs.readFileSync(path.resolve(process.cwd(), "src/app/api", rel), "utf8");

    const activitiesRoute = readApi("activities/route.ts");
    const activityPatchRoute = readApi("activities/[id]/route.ts");
    const auditsRoute = readApi("audits/route.ts");
    const adminOverviewRoute = readApi("admin/overview/route.ts");
    const adminUsersRoute = readApi("admin/users/route.ts");

    expect(activitiesRoute).toContain("userId: sessionData.user.id");
    expect(activitiesRoute).toContain("no-store");
    expect(activityPatchRoute).toContain("userId: sessionData.user.id");
    expect(auditsRoute).toContain("userId: sessionData.user.id");
    expect(auditsRoute).toContain("DELETE");
    expect(auditsRoute).toContain("no-store");

    // Admin routes must never select or query individual user document file names or text
    expect(adminOverviewRoute).not.toContain("fileName");
    expect(adminOverviewRoute).not.toContain("auditLog");
    expect(adminUsersRoute).not.toContain("fileName");
    expect(adminUsersRoute).not.toContain("passwordHash");
  });

  it("enforces and tamper-protects the 5-use demo evaluation account limit", async () => {
    const {
      MAX_DEMO_USES,
      encodeDemoUsesCookie,
      readDemoUsesFromCookie,
    } = await import("@/lib/security/demo-limit");

    expect(MAX_DEMO_USES).toBe(5);
    expect(readDemoUsesFromCookie(undefined)).toBe(0);

    const signed3 = encodeDemoUsesCookie(3);
    expect(readDemoUsesFromCookie(signed3)).toBe(3);

    const signedClamped = encodeDemoUsesCookie(9);
    expect(readDemoUsesFromCookie(signedClamped)).toBe(5);

    // Tampered cookie fails closed to MAX_DEMO_USES
    expect(readDemoUsesFromCookie("0.tamperedsignature000000")).toBe(5);
    expect(readDemoUsesFromCookie("2")).toBe(5);
  });
});
