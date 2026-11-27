import "server-only";
import { prisma } from "@/lib/prisma";
import { SecuritySeverity } from "@prisma/client";

export async function logSecurityEvent(params: {
  userId?: string | null;
  eventType: string;
  severity?: SecuritySeverity;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.securityEvent.create({
      data: {
        userId: params.userId ?? null,
        eventType: params.eventType,
        severity: params.severity ?? "LOW",
        description: params.description.slice(0, 400),
        ipAddress: params.ipAddress?.slice(0, 120) ?? null,
        userAgent: params.userAgent?.slice(0, 250) ?? null,
      },
    });
  } catch (err) {
    console.error("[ZERVIX SECURITY] Failed to persist security event:", err);
  }
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}
