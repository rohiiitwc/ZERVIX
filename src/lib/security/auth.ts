import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
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

export async function getDefaultDirectUser(): Promise<AuthUser> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
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
  });
  if (admin) return admin;

  const anyUser = await prisma.user.findFirst({
    where: { status: "ACTIVE" },
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
  });
  if (anyUser) return anyUser;

  return prisma.user.create({
    data: {
      email: "admin@zervix.ai",
      name: "Security Operations Admin",
      passwordHash: "unusable-direct-access",
      role: "ADMIN",
      status: "ACTIVE",
      avatarColor: "#8B5CF6",
      emailVerified: true,
    },
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
  });
}

export async function getSessionAndUser(): Promise<{
  user: AuthUser;
  sessionId: string;
} | null> {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (rawToken) {
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

      if (session && !session.revokedAt && session.expiresAt > new Date() && session.user.status === "ACTIVE") {
        return {
          user: session.user,
          sessionId: session.id,
        };
      }
    }
  } catch {
    // Continue to direct user fallback
  }

  // Direct Open Access: Automatically provide authenticated operator session without login
  try {
    const defaultUser = await getDefaultDirectUser();
    return {
      user: defaultUser,
      sessionId: `direct_${defaultUser.id}`,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const res = await getSessionAndUser();
  return res?.user ?? null;
}

export async function requirePageUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) return user;
  return getDefaultDirectUser();
}

export async function requireAdminPageUser(): Promise<AuthUser> {
  const user = await requirePageUser();
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
