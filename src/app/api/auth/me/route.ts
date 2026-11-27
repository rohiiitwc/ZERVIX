import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api/http";
import { getSessionAndUser } from "@/lib/security/auth";

export async function GET() {
  const sessionData = await getSessionAndUser();
  if (!sessionData) {
    return apiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const [preferences, subscription, unreadNotifications] = await Promise.all([
    prisma.userPreference.findUnique({
      where: { userId: sessionData.user.id },
    }),
    prisma.subscription.findUnique({
      where: { userId: sessionData.user.id },
    }),
    prisma.notification.count({
      where: { userId: sessionData.user.id, read: false },
    }),
  ]);

  return NextResponse.json({
    user: sessionData.user,
    sessionId: sessionData.sessionId,
    preferences,
    subscription,
    unreadNotifications,
  });
}
