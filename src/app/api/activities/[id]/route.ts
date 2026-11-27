import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";

const updateExportSchema = z.object({
  exportedFormat: z.enum(["COPY", "TXT", "CSV"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, updateExportSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await prisma.processingActivity.findFirst({
    where: { id, userId: sessionData.user.id },
  });

  if (!existing) {
    return apiError(404, "NOT_FOUND", "Processing record not found.");
  }

  const exportStatus =
    parsed.data.exportedFormat === "COPY"
      ? "COPIED"
      : `EXPORTED_${parsed.data.exportedFormat}`;

  const [updated] = await prisma.$transaction([
    prisma.processingActivity.update({
      where: { id: existing.id },
      data: { exportedFormat: parsed.data.exportedFormat },
    }),
    prisma.auditLog.updateMany({
      where: { activityId: existing.id, userId: sessionData.user.id },
      data: { exportStatus },
    }),
  ]);

  return NextResponse.json({ activity: updated });
}
