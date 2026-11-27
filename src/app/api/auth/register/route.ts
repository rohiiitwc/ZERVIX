import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, parseJsonBody } from "@/lib/api/http";
import { createUserSession, hashPassword } from "@/lib/security/auth";
import { logSecurityEvent } from "@/lib/security/audit";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email: z.string().trim().email("Valid email address is required.").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128)
    .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
    .regex(/[0-9]/, "Password must include at least one number."),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const rl = checkRateLimit(`register:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    await logSecurityEvent({
      eventType: "RATE_LIMIT_TRIGGERED",
      severity: "MEDIUM",
      description: "Registration rate limit exceeded.",
      ipAddress: ip,
      userAgent,
    });
    return apiError(
      429,
      "RATE_LIMITED",
      "Too many registration attempts. Please try again later.",
      undefined,
      { "Retry-After": String(rl.retryAfterSeconds) }
    );
  }

  const parsed = await parseJsonBody(request, registerSchema);
  if (!parsed.ok) return parsed.response;

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return apiError(409, "EMAIL_EXISTS", "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "USER",
      status: "ACTIVE",
      preferences: {
        create: {
          theme: "DARK",
          defaultRedactionMode: "PARTIAL_MASK",
        },
      },
      subscription: {
        create: {
          tier: "FREE_COMMUNITY",
          status: "ACTIVE",
          monthlyDocLimit: 250,
        },
      },
      notifications: {
        create: {
          title: "Welcome to ZERVIX",
          message:
            "Your privacy-first workspace is ready. Documents are processed strictly inside your browser.",
          type: "SUCCESS",
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      avatarColor: true,
      createdAt: true,
    },
  });

  await createUserSession(user.id, { ipAddress: ip, userAgent });

  await logSecurityEvent({
    userId: user.id,
    eventType: "REGISTER",
    severity: "LOW",
    description: "New user account registered.",
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({ user }, { status: 201 });
}
