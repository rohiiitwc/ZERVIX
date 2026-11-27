import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";
import { checkPromptForPii } from "@/lib/pii/preflight";

const createEntrySchema = z.object({
  phase: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(5).max(500),
  promptNotes: z.string().trim().min(5).max(800),
  outcome: z.string().trim().min(5).max(500),
});

export async function GET() {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const entries = await prisma.promptLogEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  if (sessionData.user.role !== "ADMIN") {
    return apiError(
      403,
      "FORBIDDEN",
      "Only administrators can append prompt engineering records."
    );
  }

  const parsed = await parseJsonBody(request, createEntrySchema);
  if (!parsed.ok) return parsed.response;

  const combined = `${parsed.data.title}\n${parsed.data.summary}\n${parsed.data.promptNotes}\n${parsed.data.outcome}`;
  const check = checkPromptForPii(combined);
  if (check.blocked) {
    return apiError(
      422,
      "PII_PREFLIGHT_BLOCKED",
      "Prompt log entries must never contain sensitive PII or secret keys."
    );
  }

  const entry = await prisma.promptLogEntry.create({
    data: parsed.data,
  });

  return NextResponse.json({ entry }, { status: 201 });
}
