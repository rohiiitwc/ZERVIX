import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { hashPassword, hashToken } from "@/lib/security/auth";
import { logSecurityEvent } from "@/lib/security/audit";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const resetSchema = z.object({
  token: z.string().trim().min(32, "Invalid reset token.").max(256),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128)
    .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
    .regex(/[0-9]/, "Password must include at least one number."),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const rl = checkRateLimit(`reset:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return apiError(
      429,
      "RATE_LIMITED",
      "Too many password reset attempts. Please try again later.",
      undefined,
      { "Retry-After": String(rl.retryAfterSeconds) }
    );
  }

  const parsed = await parseJsonBody(request, resetSchema);
  if (!parsed.ok) return parsed.response;

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    return apiError(400, "INVALID_OR_EXPIRED_TOKEN", "Reset token is invalid or expired.");
  }

  const newHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: newHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logSecurityEvent({
    userId: record.userId,
    eventType: "PASSWORD_RESET_COMPLETED",
    severity: "MEDIUM",
    description: "User password was reset and previous sessions were revoked.",
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    message: "Password updated successfully. Please sign in with your new password.",
  });
}
