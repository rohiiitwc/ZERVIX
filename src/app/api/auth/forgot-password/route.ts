import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { generateSecureToken, hashToken } from "@/lib/security/auth";
import { isSmtpConfigured, logSecurityEvent } from "@/lib/security/audit";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const forgotSchema = z.object({
  email: z.string().trim().email("Valid email address is required.").toLowerCase(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const rl = checkRateLimit(`forgot:${ip}`, 8, 15 * 60 * 1000);
  if (!rl.allowed) {
    return apiError(
      429,
      "RATE_LIMITED",
      "Too many password reset requests. Please try again later.",
      undefined,
      { "Retry-After": String(rl.retryAfterSeconds) }
    );
  }

  const parsed = await parseJsonBody(request, forgotSchema);
  if (!parsed.ok) return parsed.response;

  const { email } = parsed.data;
  const smtpReady = isSmtpConfigured();

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status === "ACTIVE") {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await logSecurityEvent({
      userId: user.id,
      eventType: "PASSWORD_RESET_REQUEST",
      severity: "LOW",
      description: smtpReady
        ? "Password reset token issued for email delivery."
        : "Password reset token issued; SMTP delivery not configured.",
      ipAddress: ip,
      userAgent,
    });
  }

  return NextResponse.json({
    ok: true,
    emailConfigured: smtpReady,
    message: smtpReady
      ? "If an active account exists for that email, password reset instructions have been queued for delivery."
      : "Reset request recorded safely, but outbound email delivery is not configured on this server. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env.local to send reset emails.",
  });
}
