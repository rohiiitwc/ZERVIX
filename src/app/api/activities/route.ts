import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit";
import { ALL_PII_CATEGORIES, PiiCategory } from "@/lib/pii/types";
import { Prisma } from "@prisma/client";

const FORBIDDEN_RAW_KEYS = [
  "originalText",
  "sanitizedText",
  "rawContent",
  "documentContent",
  "content",
  "detectedValues",
  "rawValues",
  "mappings",
  "pseudonymMap",
];

const recordActivitySchema = z
  .object({
    fileName: z.string().trim().min(1).max(160),
    fileType: z.enum(["TXT", "CSV", "TEXT"]),
    fileSizeBytes: z.number().int().min(0).max(100 * 1024 * 1024),
    rowCount: z.number().int().min(0).max(500000).default(0),
    sanitizationMode: z.enum(["FULL_MASK", "PARTIAL_MASK", "PSEUDONYMIZE"]),
    enabledCategories: z.array(
      z.enum(["EMAIL", "PHONE", "IPV4", "PAN", "AADHAAR", "CREDIT_CARD"])
    ).min(1),
    totalDetections: z.number().int().min(0).max(1000000),
    uniqueEntities: z.number().int().min(0).max(1000000),
    categoryCounts: z.object({
      EMAIL: z.number().int().min(0),
      PHONE: z.number().int().min(0),
      IPV4: z.number().int().min(0),
      PAN: z.number().int().min(0),
      AADHAAR: z.number().int().min(0),
      CREDIT_CARD: z.number().int().min(0),
    }),
    luhnValidCards: z.number().int().min(0).default(0),
    luhnInvalidCandidates: z.number().int().min(0).default(0),
    aadhaarValidFormat: z.number().int().min(0).default(0),
    durationMs: z.number().int().min(0).max(600000),
    status: z.enum(["COMPLETED", "PARTIAL", "FAILED"]).default("COMPLETED"),
    exportedFormat: z.enum(["NONE", "COPY", "TXT", "CSV"]).default("NONE"),
  })
  .strict();

export async function GET(request: NextRequest) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize") ?? 10) || 10));
  const mode = sp.get("mode");
  const status = sp.get("status");
  const category = sp.get("category");
  const search = sp.get("search")?.trim() ?? "";
  const range = sp.get("range") ?? "30d";

  let dateFrom: Date | undefined;
  const now = Date.now();
  if (range === "7d") dateFrom = new Date(now - 7 * 86400000);
  else if (range === "30d") dateFrom = new Date(now - 30 * 86400000);
  else if (range === "90d") dateFrom = new Date(now - 90 * 86400000);

  const customFrom = sp.get("dateFrom");
  const customTo = sp.get("dateTo");
  if (customFrom) {
    const parsedFrom = new Date(customFrom);
    if (!Number.isNaN(parsedFrom.getTime())) dateFrom = parsedFrom;
  }
  let dateTo: Date | undefined;
  if (customTo) {
    const parsedTo = new Date(customTo);
    if (!Number.isNaN(parsedTo.getTime())) {
      parsedTo.setHours(23, 59, 59, 999);
      dateTo = parsedTo;
    }
  }

  const where: Prisma.ProcessingActivityWhereInput = {
    userId: sessionData.user.id,
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...(mode && ["FULL_MASK", "PARTIAL_MASK", "PSEUDONYMIZE"].includes(mode)
      ? { sanitizationMode: mode as "FULL_MASK" | "PARTIAL_MASK" | "PSEUDONYMIZE" }
      : {}),
    ...(status && ["COMPLETED", "PARTIAL", "FAILED"].includes(status)
      ? { status: status as "COMPLETED" | "PARTIAL" | "FAILED" }
      : {}),
    ...(category && ALL_PII_CATEGORIES.includes(category as PiiCategory)
      ? { enabledCategories: { has: category } }
      : {}),
    ...(search
      ? {
          fileName: { contains: search, mode: "insensitive" },
        }
      : {}),
  };

  const [items, totalItems, allMatched] = await Promise.all([
    prisma.processingActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.processingActivity.count({ where }),
    prisma.processingActivity.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        fileName: true,
        totalDetections: true,
        uniqueEntities: true,
        categoryCounts: true,
        luhnValidCards: true,
        luhnInvalidCandidates: true,
        aadhaarValidFormat: true,
        durationMs: true,
        status: true,
        sanitizationMode: true,
        createdAt: true,
      },
    }),
  ]);

  const categoryTotals: Record<PiiCategory, number> = {
    EMAIL: 0,
    PHONE: 0,
    IPV4: 0,
    PAN: 0,
    AADHAAR: 0,
    CREDIT_CARD: 0,
  };

  let totalDetections = 0;
  let totalUniqueEntities = 0;
  let successfullySanitized = 0;
  let luhnValidCards = 0;
  let luhnInvalidCandidates = 0;
  let aadhaarValidFormat = 0;
  let syntheticDemoCount = 0;

  const dailyMap = new Map<
    string,
    { date: string; documents: number; detections: number; sanitized: number }
  >();

  for (const row of allMatched) {
    if (row.fileName.startsWith("[SYNTHETIC DEMO]")) {
      syntheticDemoCount += 1;
    }
    totalDetections += row.totalDetections;
    totalUniqueEntities += row.uniqueEntities;
    if (row.status === "COMPLETED") successfullySanitized += 1;
    luhnValidCards += row.luhnValidCards;
    luhnInvalidCandidates += row.luhnInvalidCandidates;
    aadhaarValidFormat += row.aadhaarValidFormat;

    const counts = (row.categoryCounts ?? {}) as Partial<Record<PiiCategory, number>>;
    for (const cat of ALL_PII_CATEGORIES) {
      categoryTotals[cat] += Number(counts[cat] ?? 0);
    }

    const dayKey = row.createdAt.toISOString().slice(0, 10);
    const bucket = dailyMap.get(dayKey) ?? {
      date: dayKey,
      documents: 0,
      detections: 0,
      sanitized: 0,
    };
    bucket.documents += 1;
    bucket.detections += row.totalDetections;
    if (row.status === "COMPLETED") bucket.sanitized += 1;
    dailyMap.set(dayKey, bucket);
  }

  return NextResponse.json(
    {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
      analytics: {
        totalDocuments: allMatched.length,
        totalDetections,
        successfullySanitized,
        uniqueEntities: totalUniqueEntities,
        categoryTotals,
        luhnValidCards,
        luhnInvalidCandidates,
        aadhaarValidFormat,
        containsSyntheticDemo: syntheticDemoCount > 0,
        syntheticDemoCount,
        trends: Array.from(dailyMap.values()),
      },
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}

export async function POST(request: Request) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(`activity:${sessionData.user.id}`, 60, 60 * 1000);
  if (!rl.allowed) {
    return apiError(429, "RATE_LIMITED", "Rate limit exceeded for metadata logging.");
  }

  // Explicitly peek raw body first to enforce privacy boundary against raw content keys
  let rawCloneText = "";
  try {
    rawCloneText = await request.clone().text();
    const rawObj = JSON.parse(rawCloneText) as Record<string, unknown>;
    for (const forbidden of FORBIDDEN_RAW_KEYS) {
      if (forbidden in rawObj) {
        await logSecurityEvent({
          userId: sessionData.user.id,
          eventType: "PRIVACY_BOUNDARY_BLOCK",
          severity: "HIGH",
          description: `Blocked attempt to transmit forbidden raw field "${forbidden}" to metadata API.`,
          ipAddress: ip,
        });
        return apiError(
          400,
          "PRIVACY_VIOLATION_REJECTED",
          "Original documents, raw content, and PII mappings must never be sent to the server."
        );
      }
    }
  } catch {
    // Will be cleanly rejected by parseJsonBody below
  }

  const parsed = await parseJsonBody(request, recordActivitySchema, 16 * 1024);
  if (!parsed.ok) return parsed.response;

  const d = parsed.data;

  const activity = await prisma.processingActivity.create({
    data: {
      userId: sessionData.user.id,
      fileName: d.fileName,
      fileType: d.fileType,
      fileSizeBytes: d.fileSizeBytes,
      rowCount: d.rowCount,
      sanitizationMode: d.sanitizationMode,
      enabledCategories: d.enabledCategories,
      totalDetections: d.totalDetections,
      uniqueEntities: d.uniqueEntities,
      categoryCounts: d.categoryCounts,
      luhnValidCards: d.luhnValidCards,
      luhnInvalidCandidates: d.luhnInvalidCandidates,
      aadhaarValidFormat: d.aadhaarValidFormat,
      durationMs: d.durationMs,
      status: d.status,
      exportedFormat: d.exportedFormat,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: sessionData.user.id,
      activityId: activity.id,
      action: "DOCUMENT_SANITIZED",
      fileName: d.fileName,
      sanitizationMode: d.sanitizationMode,
      enabledCategories: d.enabledCategories,
      detectionCount: d.totalDetections,
      uniqueEntityCount: d.uniqueEntities,
      durationMs: d.durationMs,
      exportStatus:
        d.exportedFormat === "NONE" ? "NOT_EXPORTED" : `EXPORTED_${d.exportedFormat}`,
      metadata: {
        fileType: d.fileType,
        rowCount: d.rowCount,
        luhnValidCards: d.luhnValidCards,
      },
    },
  });

  return NextResponse.json({ activity }, { status: 201 });
}
