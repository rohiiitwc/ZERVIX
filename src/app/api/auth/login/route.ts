import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { createUserSession, verifyPassword } from "@/lib/security/auth";
import { logSecurityEvent } from "@/lib/security/audit";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import {
  DEMO_COOKIE_NAME,
  DEMO_EMAIL,
  MAX_DEMO_USES,
  encodeDemoUsesCookie,
  readDemoUsesFromCookie,
} from "@/lib/security/demo-limit";

const loginSchema = z.object({
  email: z.string().trim().email("Valid email address is required.").toLowerCase(),
  password: z.string().min(1, "Password is required.").max(128),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const rl = checkRateLimit(`login:${ip}`, 20, 15 * 60 * 1000);
  if (!rl.allowed) {
    await logSecurityEvent({
      eventType: "RATE_LIMIT_TRIGGERED",
      severity: "HIGH",
      description: "Login rate limit exceeded.",
      ipAddress: ip,
      userAgent,
    });
    return apiError(
      429,
      "RATE_LIMITED",
      "Too many login attempts. Please wait before trying again.",
      undefined,
      { "Retry-After": String(rl.retryAfterSeconds) }
    );
  }

  const parsed = await parseJsonBody(request, loginSchema);
  if (!parsed.ok) return parsed.response;

  const { email, password } = parsed.data;
  const isDemoAccount = email === DEMO_EMAIL;
  let currentDemoUses = 0;

  if (isDemoAccount) {
    const cookieStore = await cookies();
    currentDemoUses = readDemoUsesFromCookie(cookieStore.get(DEMO_COOKIE_NAME)?.value);
    if (currentDemoUses >= MAX_DEMO_USES) {
      await logSecurityEvent({
        eventType: "DEMO_LIMIT_REACHED",
        severity: "LOW",
        description: "Demo account login blocked after reaching 5-use limit.",
        ipAddress: ip,
        userAgent,
      });
      return apiError(
        403,
        "DEMO_LIMIT_REACHED",
        "Demo Evaluation Account limit (5 uses only) has been reached. Please create your own account."
      );
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await logSecurityEvent({
      eventType: "LOGIN_FAILED",
      severity: "MEDIUM",
      description: "Failed login attempt for unrecognized account.",
      ipAddress: ip,
      userAgent,
    });
    return apiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  if (user.status !== "ACTIVE") {
    await logSecurityEvent({
      userId: user.id,
      eventType: "LOGIN_BLOCKED_SUSPENDED",
      severity: "HIGH",
      description: "Suspended account attempted login.",
      ipAddress: ip,
      userAgent,
    });
    return apiError(
      403,
      "ACCOUNT_SUSPENDED",
      "This account has been suspended by an administrator."
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await logSecurityEvent({
      userId: user.id,
      eventType: "LOGIN_FAILED",
      severity: "MEDIUM",
      description: "Failed login attempt due to invalid password.",
      ipAddress: ip,
      userAgent,
    });
    return apiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createUserSession(user.id, { ipAddress: ip, userAgent });

  let demoUsage: { used: number; max: number; remaining: number } | undefined;
  if (isDemoAccount) {
    const nextDemoUses = Math.min(MAX_DEMO_USES, currentDemoUses + 1);
    // Set demo usage cookie on response
    demoUsage = {
      used: nextDemoUses,
      max: MAX_DEMO_USES,
      remaining: Math.max(0, MAX_DEMO_USES - nextDemoUses),
    };
    // We'll attach the cookie to the response after building it.
  }

  await logSecurityEvent({
    userId: user.id,
    eventType: "LOGIN_SUCCESS",
    severity: "LOW",
    description: "User signed in with verified session cookie.",
    ipAddress: ip,
    userAgent,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarColor: user.avatarColor,
    },
    ...(demoUsage ? { demoUsage } : {}),
  });
  if (isDemoAccount && demoUsage) {
    response.cookies.set(DEMO_COOKIE_NAME, encodeDemoUsesCookie(demoUsage.used), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  return response;
}
