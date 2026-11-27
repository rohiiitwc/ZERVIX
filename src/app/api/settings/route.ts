import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import {
  getSessionAndUser,
  hashPassword,
  verifyPassword,
} from "@/lib/security/auth";
import { logSecurityEvent } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";

const updateSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  theme: z.enum(["DARK", "LIGHT", "SYSTEM"]).optional(),
  defaultRedactionMode: z
    .enum(["FULL_MASK", "PARTIAL_MASK", "PSEUDONYMIZE"])
    .optional(),
  enabledCategories: z
    .array(z.enum(["EMAIL", "PHONE", "IPV4", "PAN", "AADHAAR", "CREDIT_CARD"]))
    .min(1)
    .optional(),
  emailNotifications: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  auditDigest: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  dashboardWidgets: z
    .array(
      z.enum([
        "kpis",
        "piiDistribution",
        "detectionTrends",
        "recentActivity",
        "categoryBreakdown",
        "holographicShield",
      ])
    )
    .optional(),
  passwordChange: z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z
        .string()
        .min(8, "New password must be at least 8 characters.")
        .max(128)
        .regex(/[A-Z]/, "Must include at least one uppercase letter.")
        .regex(/[0-9]/, "Must include at least one number."),
    })
    .optional(),
});

const revokeSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export async function GET() {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const [preferences, subscription, sessions] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId: sessionData.user.id } }),
    prisma.subscription.findUnique({ where: { userId: sessionData.user.id } }),
    prisma.session.findMany({
      where: {
        userId: sessionData.user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    user: sessionData.user,
    currentSessionId: sessionData.sessionId,
    preferences,
    subscription,
    sessions,
  });
}

export async function PATCH(request: Request) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const parsed = await parseJsonBody(request, updateSettingsSchema);
  if (!parsed.ok) return parsed.response;

  const d = parsed.data;
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  if (d.passwordChange) {
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionData.user.id },
      select: { passwordHash: true },
    });
    if (!dbUser) {
      return apiError(404, "USER_NOT_FOUND", "User not found.");
    }
    const valid = await verifyPassword(
      d.passwordChange.currentPassword,
      dbUser.passwordHash
    );
    if (!valid) {
      return apiError(
        400,
        "INVALID_CURRENT_PASSWORD",
        "Current password is incorrect."
      );
    }

    const newHash = await hashPassword(d.passwordChange.newPassword);
    await prisma.user.update({
      where: { id: sessionData.user.id },
      data: { passwordHash: newHash },
    });

    await logSecurityEvent({
      userId: sessionData.user.id,
      eventType: "PASSWORD_CHANGED",
      severity: "MEDIUM",
      description: "User updated account password from Settings.",
      ipAddress: ip,
      userAgent,
    });
  }

  if (d.name !== undefined || d.avatarColor !== undefined) {
    await prisma.user.update({
      where: { id: sessionData.user.id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.avatarColor !== undefined ? { avatarColor: d.avatarColor } : {}),
      },
    });
  }

  const hasPrefUpdates =
    d.theme !== undefined ||
    d.defaultRedactionMode !== undefined ||
    d.enabledCategories !== undefined ||
    d.emailNotifications !== undefined ||
    d.securityAlerts !== undefined ||
    d.auditDigest !== undefined ||
    d.compactMode !== undefined ||
    d.dashboardWidgets !== undefined;

  let updatedPreferences = await prisma.userPreference.findUnique({
    where: { userId: sessionData.user.id },
  });

  if (hasPrefUpdates) {
    updatedPreferences = await prisma.userPreference.upsert({
      where: { userId: sessionData.user.id },
      create: {
        userId: sessionData.user.id,
        theme: d.theme ?? "DARK",
        defaultRedactionMode: d.defaultRedactionMode ?? "PARTIAL_MASK",
        enabledCategories: d.enabledCategories ?? [
          "EMAIL",
          "PHONE",
          "IPV4",
          "PAN",
          "AADHAAR",
          "CREDIT_CARD",
        ],
        emailNotifications: d.emailNotifications ?? true,
        securityAlerts: d.securityAlerts ?? true,
        auditDigest: d.auditDigest ?? false,
        compactMode: d.compactMode ?? false,
        dashboardWidgets: d.dashboardWidgets ?? [
          "kpis",
          "piiDistribution",
          "detectionTrends",
          "recentActivity",
          "categoryBreakdown",
          "holographicShield",
        ],
      },
      update: {
        ...(d.theme !== undefined ? { theme: d.theme } : {}),
        ...(d.defaultRedactionMode !== undefined
          ? { defaultRedactionMode: d.defaultRedactionMode }
          : {}),
        ...(d.enabledCategories !== undefined
          ? { enabledCategories: d.enabledCategories }
          : {}),
        ...(d.emailNotifications !== undefined
          ? { emailNotifications: d.emailNotifications }
          : {}),
        ...(d.securityAlerts !== undefined
          ? { securityAlerts: d.securityAlerts }
          : {}),
        ...(d.auditDigest !== undefined ? { auditDigest: d.auditDigest } : {}),
        ...(d.compactMode !== undefined ? { compactMode: d.compactMode } : {}),
        ...(d.dashboardWidgets !== undefined
          ? { dashboardWidgets: d.dashboardWidgets }
          : {}),
      },
    });
  }

  const updatedUser = await prisma.user.findUnique({
    where: { id: sessionData.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      avatarColor: true,
    },
  });

  return NextResponse.json({
    user: updatedUser,
    preferences: updatedPreferences,
    passwordUpdated: Boolean(d.passwordChange),
  });
}

export async function DELETE(request: Request) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const parsed = await parseJsonBody(request, revokeSessionSchema);
  if (!parsed.ok) return parsed.response;

  const target = await prisma.session.findFirst({
    where: {
      id: parsed.data.sessionId,
      userId: sessionData.user.id,
      revokedAt: null,
    },
  });

  if (!target) {
    return apiError(404, "NOT_FOUND", "Active session not found.");
  }

  await prisma.session.update({
    where: { id: target.id },
    data: { revokedAt: new Date() },
  });

  await logSecurityEvent({
    userId: sessionData.user.id,
    eventType: "SESSION_REVOKED",
    severity: "LOW",
    description: "User revoked an active session from Settings.",
  });

  return NextResponse.json({ ok: true });
}
