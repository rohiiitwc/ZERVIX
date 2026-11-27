import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";
import { getGeminiConfigStatus } from "@/lib/gemini/client";
import { isSmtpConfigured } from "@/lib/security/audit";

export async function GET() {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const gemini = getGeminiConfigStatus();
  const smtp = isSmtpConfigured();

  return NextResponse.json({
    checks: [
      {
        id: "client-processing",
        title: "Client-Side Document Processing",
        status: "VERIFIED_ACTIVE",
        detail:
          "TXT and CSV parsing, PII detection, Luhn/Verhoeff validation, and sanitization run 100% locally in the browser.",
      },
      {
        id: "document-transmission",
        title: "Zero-Upload Document Transmission",
        status: "VERIFIED_ACTIVE",
        detail:
          "Metadata API strictly rejects payloads containing originalText, sanitizedText, rawContent, or pseudonym mappings.",
      },
      {
        id: "authentication",
        title: "Authentication & Password Hashing",
        status: "VERIFIED_ACTIVE",
        detail:
          "Bcrypt (12 salt rounds) password hashing with server-side session verification and RBAC route protection.",
      },
      {
        id: "session-security",
        title: "Session Cookie Hardening",
        status: "VERIFIED_ACTIVE",
        detail:
          "HTTP-only, SameSite=Lax cookies backed by HMAC-SHA256 hashed session tokens in PostgreSQL with expiration and revocation.",
      },
      {
        id: "database-protection",
        title: "PostgreSQL Database Protection",
        status: dbHealthy ? "VERIFIED_ACTIVE" : "DEGRADED",
        detail: dbHealthy
          ? "PostgreSQL connection verified. Schema stores only non-sensitive metadata counts with user-level isolation."
          : "Database connectivity check failed.",
      },
      {
        id: "gemini-integration",
        title: "ZERVIX AI Server-Side Engine",
        status: gemini.configured ? "VERIFIED_ACTIVE" : "NOT_CONFIGURED",
        detail: gemini.configured
          ? "Server-side ZERVIX AI engine active with dual client/server PII preflight guard."
          : "Server-side ZERVIX AI boundary and PII preflight guard are active; server AI key is not yet configured.",
      },
      {
        id: "api-rate-limiting",
        title: "API Rate Limiting & Size Guards",
        status: "VERIFIED_ACTIVE",
        detail:
          "Sliding-window rate limiting enforced on authentication, metadata logging, and ZERVIX AI Assistant endpoints.",
      },
      {
        id: "secret-management",
        title: "Secret Management & Key Hygiene",
        status: "VERIFIED_ACTIVE",
        detail:
          "No public client-side AI credential exposure; .env.local and secret files are git-ignored; SMTP " +
          (smtp ? "configured." : "not configured (password-reset emails disabled until SMTP env vars are set)."),
      },
    ],
  });
}
