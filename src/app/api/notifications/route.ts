import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";

const markReadSchema = z.object({
  id: z.string().optional(),
  markAll: z.boolean().optional(),
});

export async function GET() {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: sessionData.user.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return NextResponse.json({ notifications });
}

export async function PATCH(request: Request) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const parsed = await parseJsonBody(request, markReadSchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.markAll) {
    await prisma.notification.updateMany({
      where: { userId: sessionData.user.id, read: false },
      data: { read: true },
    });
  } else if (parsed.data.id) {
    await prisma.notification.updateMany({
      where: { id: parsed.data.id, userId: sessionData.user.id },
      data: { read: true },
    });
  }

  return NextResponse.json({ ok: true });
}
