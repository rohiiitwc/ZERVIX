import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit";
import { checkPromptForPii } from "@/lib/pii/preflight";
import {
  GeminiIntegrationError,
  generateZervixAssistantReply,
  getGeminiConfigStatus,
} from "@/lib/gemini/client";
import { prisma } from "@/lib/prisma";

const assistantSchema = z.object({
  message: z.string().trim().min(1, "Question cannot be empty.").max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().trim().min(1).max(2500),
      })
    )
    .max(12)
    .optional(),
  appContext: z.string().trim().max(300).optional(),
});

export async function GET() {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  const status = getGeminiConfigStatus();
  return NextResponse.json({
    configured: status.configured,
    engine: "ZERVIX AI",
  });
}

export async function POST(request: Request) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  // Read admin-configured rate limit if available
  let limitPerMin = 20;
  try {
    const setting = await prisma.applicationSetting.findUnique({
      where: { key: "AI_RATE_LIMIT_PER_MIN" },
    });
    const parsedLimit = Number(setting?.value);
    if (Number.isFinite(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 120) {
      limitPerMin = parsedLimit;
    }
  } catch {
    // Use default
  }

  const rl = checkRateLimit(`assistant:${sessionData.user.id}`, limitPerMin, 60 * 1000);
  if (!rl.allowed) {
    await logSecurityEvent({
      userId: sessionData.user.id,
      eventType: "AI_RATE_LIMIT_TRIGGERED",
      severity: "MEDIUM",
      description: "ZERVIX AI Assistant rate limit exceeded.",
      ipAddress: ip,
      userAgent,
    });
    return apiError(
      429,
      "RATE_LIMITED",
      "AI Assistant rate limit reached. Please wait a minute before sending another question.",
      undefined,
      { "Retry-After": String(rl.retryAfterSeconds) }
    );
  }

  const parsed = await parseJsonBody(request, assistantSchema, 24 * 1024);
  if (!parsed.ok) return parsed.response;

  const { message, history, appContext } = parsed.data;

  // Independent server-side PII preflight safeguard (never trust client check alone)
  const combinedHistory = (history ?? []).map((h) => h.text).join("\n");
  const msgCheck = checkPromptForPii(message);
  const historyCheck = checkPromptForPii(combinedHistory);

  if (msgCheck.blocked || historyCheck.blocked) {
    const labels = Array.from(
      new Set([...msgCheck.detectedLabels, ...historyCheck.detectedLabels])
    );
    await logSecurityEvent({
      userId: sessionData.user.id,
      eventType: "AI_PII_BLOCKED",
      severity: "HIGH",
      description: `Server preflight blocked ZERVIX AI request containing sensitive patterns (${labels.join(", ")}).`,
      ipAddress: ip,
      userAgent,
    });

    return apiError(
      422,
      "PII_PREFLIGHT_BLOCKED",
      msgCheck.reason ??
        "Privacy Guard blocked this request because conversation context contained sensitive PII or secret patterns. Clear or edit the sensitive text before continuing.",
      { detectedLabels: labels }
    );
  }

  try {
    const result = await generateZervixAssistantReply({
      message,
      history,
      appContext,
    });
    return NextResponse.json({ reply: result.reply, model: "ZERVIX AI" });
  } catch (err) {
    if (err instanceof GeminiIntegrationError) {
      return apiError(err.statusCode, err.code, err.message);
    }
    return apiError(502, "UPSTREAM_ERROR", "Unexpected ZERVIX AI service error.");
  }
}
