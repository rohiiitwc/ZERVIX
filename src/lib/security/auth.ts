import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Role, AccountStatus } from "@prisma/client";

export const SESSION_COOKIE_NAME = "zervix_session";
const BCRYPT_ROUNDS = 12;
const DEFAULT_SESSION_TTL_HOURS = 24;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: AccountStatus;
  avatarColor: string;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  const pepper = process.env.SESSION_SECRET ?? "zervix-dev-fallback-secret";
  return crypto
    .createHmac("sha256", pepper)
    .update(rawToken)
    .digest("hex");
}

async function getSessionTtlMs(): Promise<number> {
  try {
    const setting = await prisma.applicationSetting.findUnique({
      where: { key: "SESSION_TTL_HOURS" },
    });
    const hours = Number(setting?.value ?? DEFAULT_SESSION_TTL_HOURS);
    if (Number.isFinite(hours) && hours >= 1 && hours <= 720) {
      return hours * 60 * 60 * 1000;
    }
  } catch {
    // Fallback to default if settings table not initialized
  }
  return DEFAULT_SESSION_TTL_HOURS * 60 * 60 * 1000;
}

export async function createUserSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ rawToken: string; expiresAt: Date; sessionId: string }> {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const ttlMs = await getSessionTtlMs();
  const expiresAt = new Date(Date.now() + ttlMs);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      ipAddress: meta?.ipAddress?.slice(0, 120) ?? null,
      userAgent: meta?.userAgent?.slice(0, 250) ?? null,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return { rawToken, expiresAt, sessionId: session.id };
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionAndUser(): Promise<{
  user: AuthUser;
  sessionId: string;
} | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const querySession = () =>
    prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            avatarColor: true,
            emailVerified: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });

  let session;
  try {
    session = await querySession();
  } catch {
    // Retry once on transient local socket reset during HMR
    session = await querySession();
  }

  if (!session) return null;
  if (session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }
  if (session.user.status !== "ACTIVE") {
    return null;
  }

  return {
    user: session.user,
    sessionId: session.id,
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const res = await getSessionAndUser();
  return res?.user ?? null;
}

export async function requirePageUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdminPageUser(): Promise<AuthUser> {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
}

export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await clearSessionCookie();
}

export async function getRequestMetaFromHeaders(): Promise<{
  ipAddress: string;
  userAgent: string;
}> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0].trim()
    : (h.get("x-real-ip") ?? "127.0.0.1");
  const userAgent = h.get("user-agent") ?? "unknown";
  return { ipAddress, userAgent };
}
