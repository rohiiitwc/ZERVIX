import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";
import { getGeminiConfigStatus } from "@/lib/gemini/client";
import { isSmtpConfigured, logSecurityEvent } from "@/lib/security/audit";

const updateSettingSchema = z.object({
  key: z.string().trim().min(2).max(80),
  value: z.string().trim().min(1).max(200),
});

export async function GET() {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  if (sessionData.user.role !== "ADMIN") {
    return apiError(403, "FORBIDDEN", "Administrator privileges required.");
  }

  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const [
    totalUsers,
    activeUsers,
    totalActivities,
    aggregateStats,
    securityEvents,
    settings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.processingActivity.count(),
    prisma.processingActivity.aggregate({
      _sum: {
        totalDetections: true,
        uniqueEntities: true,
      },
    }),
    prisma.securityEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        eventType: true,
        severity: true,
        description: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.applicationSetting.findMany({
      orderBy: { key: "asc" },
    }),
  ]);

  const gemini = getGeminiConfigStatus();

  return NextResponse.json({
    health: {
      database: dbHealthy ? "HEALTHY" : "UNREACHABLE",
      geminiConfigured: gemini.configured,
      geminiModel: gemini.model,
      smtpConfigured: isSmtpConfigured(),
      uptimeSeconds: Math.round(process.uptime()),
    },
    overview: {
      totalUsers,
      activeUsers,
      totalDocumentsProcessed: totalActivities,
      totalPiiDetections: aggregateStats._sum.totalDetections ?? 0,
      totalUniqueEntities: aggregateStats._sum.uniqueEntities ?? 0,
    },
    securityEvents,
    settings,
  });
}

export async function PATCH(request: Request) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  if (sessionData.user.role !== "ADMIN") {
    return apiError(403, "FORBIDDEN", "Administrator privileges required.");
  }

  const parsed = await parseJsonBody(request, updateSettingSchema);
  if (!parsed.ok) return parsed.response;

  const updated = await prisma.applicationSetting.update({
    where: { key: parsed.data.key },
    data: {
      value: parsed.data.value,
      updatedBy: sessionData.user.email,
    },
  });

  await logSecurityEvent({
    userId: sessionData.user.id,
    eventType: "ADMIN_SETTING_UPDATED",
    severity: "MEDIUM",
    description: `Admin updated setting ${parsed.data.key}.`,
  });

  return NextResponse.json({ setting: updated });
}
