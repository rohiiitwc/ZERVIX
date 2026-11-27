import { NextResponse } from "next/server";
import { getSessionAndUser, revokeCurrentSession } from "@/lib/security/auth";
import { logSecurityEvent } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const current = await getSessionAndUser();

  await revokeCurrentSession();

  if (current) {
    await logSecurityEvent({
      userId: current.user.id,
      eventType: "LOGOUT",
      severity: "LOW",
      description: "User signed out and revoked active session.",
      ipAddress: ip,
      userAgent,
    });
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Clear-Site-Data": '"cookies", "storage", "cache"',
      },
    }
  );
}
