import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";
import { logSecurityEvent } from "@/lib/security/audit";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const sp = request.nextUrl.searchParams;
  const format = sp.get("format"); // csv | json | null
  const auditId = sp.get("auditId")?.trim() ?? "";
  const activityId = sp.get("activityId")?.trim() ?? "";
  const search = sp.get("search")?.trim() ?? "";
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const sortField = sp.get("sortBy") === "detectionCount" ? "detectionCount" : "createdAt";
  const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize") ?? 12) || 12));

  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!Number.isNaN(d.getTime())) fromDate = d;
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      toDate = d;
    }
  }

  const where: Prisma.AuditLogWhereInput = {
    userId: sessionData.user.id,
    ...(auditId ? { id: auditId } : {}),
    ...(activityId ? { activityId } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { fileName: { contains: search, mode: "insensitive" } },
            { action: { contains: search, mode: "insensitive" } },
            { exportStatus: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  if (format === "csv" || format === "json") {
    const allLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      take: 1000,
    });

    const nextExportStatus = format === "json" ? "EXPORTED_JSON" : "EXPORTED_CSV";
    const pendingLogIds = allLogs
      .filter((l) => l.exportStatus === "NOT_EXPORTED")
      .map((l) => l.id);
    const pendingActivityIds = allLogs
      .filter((l) => l.exportStatus === "NOT_EXPORTED" && l.activityId)
      .map((l) => l.activityId as string);

    if (pendingLogIds.length > 0) {
      await prisma.auditLog.updateMany({
        where: {
          id: { in: pendingLogIds },
          userId: sessionData.user.id,
        },
        data: { exportStatus: nextExportStatus },
      });

      if (format === "csv" && pendingActivityIds.length > 0) {
        await prisma.processingActivity.updateMany({
          where: {
            id: { in: pendingActivityIds },
            userId: sessionData.user.id,
            exportedFormat: "NONE",
          },
          data: { exportedFormat: "CSV" },
        });
      }
    }

    const exportedLogs = allLogs.map((l) =>
      l.exportStatus === "NOT_EXPORTED"
        ? { ...l, exportStatus: nextExportStatus }
        : l
    );

    if (format === "json") {
      return new NextResponse(
        JSON.stringify({ exportedAt: new Date().toISOString(), records: exportedLogs }, null, 2),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": 'attachment; filename="zervix-audit-report.json"',
          },
        }
      );
    }

    const csv = Papa.unparse(
      exportedLogs.map((l) => ({
        id: l.id,
        userId: l.userId,
        timestamp: l.createdAt.toISOString(),
        action: l.action,
        fileName: l.fileName ?? "",
        sanitizationMode: l.sanitizationMode ?? "",
        enabledCategories: l.enabledCategories.join("|"),
        detectionCount: l.detectionCount,
        uniqueEntityCount: l.uniqueEntityCount,
        durationMs: l.durationMs,
        exportStatus: l.exportStatus,
      }))
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="zervix-audit-report.csv"',
      },
    });
  }

  const [items, totalItems] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json(
    {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}

const deleteAuditSchema = z
  .object({
    auditId: z.string().min(1).optional(),
    deleteAll: z.boolean().optional(),
  })
  .refine((d) => Boolean(d.auditId) || d.deleteAll === true, {
    message: "Specify auditId or deleteAll: true.",
  });

export async function DELETE(request: NextRequest) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const parsed = await parseJsonBody(request, deleteAuditSchema);
  if (!parsed.ok) return parsed.response;

  const userId = sessionData.user.id;

  if (parsed.data.deleteAll) {
    const existingLogs = await prisma.auditLog.findMany({
      where: { userId },
      select: { id: true, activityId: true },
    });
    const activityIds = existingLogs
      .map((l) => l.activityId)
      .filter((id): id is string => Boolean(id));

    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { userId } }),
      ...(activityIds.length > 0
        ? [
            prisma.processingActivity.deleteMany({
              where: { id: { in: activityIds }, userId },
            }),
          ]
        : []),
    ]);

    await logSecurityEvent({
      userId,
      eventType: "AUDIT_LOGS_CLEARED",
      severity: "LOW",
      description: `User deleted ${existingLogs.length} personal audit record(s).`,
    });

    return NextResponse.json({ deletedCount: existingLogs.length });
  }

  const existing = await prisma.auditLog.findFirst({
    where: { id: parsed.data.auditId, userId },
  });

  if (!existing) {
    return apiError(404, "NOT_FOUND", "Audit record not found.");
  }

  await prisma.$transaction([
    prisma.auditLog.deleteMany({
      where: { id: existing.id, userId },
    }),
    ...(existing.activityId
      ? [
          prisma.processingActivity.deleteMany({
            where: { id: existing.activityId, userId },
          }),
        ]
      : []),
  ]);

  await logSecurityEvent({
    userId,
    eventType: "AUDIT_LOG_DELETED",
    severity: "LOW",
    description: "User deleted a personal audit record.",
  });

  return NextResponse.json({ deletedId: existing.id });
}
