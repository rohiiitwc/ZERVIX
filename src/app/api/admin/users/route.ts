import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";
import { logSecurityEvent } from "@/lib/security/audit";

const updateUserSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export async function GET() {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  if (sessionData.user.role !== "ADMIN") {
    return apiError(403, "FORBIDDEN", "Administrator privileges required.");
  }

  // Strictly select account metadata only — never documents, raw PII, or password hashes
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      subscription: {
        select: { tier: true, status: true },
      },
      _count: {
        select: { activities: true, auditLogs: true },
      },
    },
  });

  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  if (sessionData.user.role !== "ADMIN") {
    return apiError(403, "FORBIDDEN", "Administrator privileges required.");
  }

  const parsed = await parseJsonBody(request, updateUserSchema);
  if (!parsed.ok) return parsed.response;

  if (
    parsed.data.userId === sessionData.user.id &&
    parsed.data.status === "SUSPENDED"
  ) {
    return apiError(400, "INVALID_ACTION", "You cannot suspend your own account.");
  }

  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (parsed.data.status === "SUSPENDED") {
    await prisma.session.updateMany({
      where: { userId: updated.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await logSecurityEvent({
    userId: sessionData.user.id,
    eventType: "ADMIN_USER_UPDATED",
    severity: "MEDIUM",
    description: `Admin updated account status/role for ${updated.email}.`,
  });

  return NextResponse.json({ user: updated });
}
