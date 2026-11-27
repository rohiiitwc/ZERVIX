import Link from "next/link";
import { getCurrentUser } from "@/lib/security/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { AboutClient } from "@/components/about/AboutClient";
import { ZervixLogo } from "@/components/brand/ZervixLogo";

export default async function AboutPage() {
  const user = await getCurrentUser();

  if (user) {
    const [sub, notifications] = await Promise.all([
      prisma.subscription.findUnique({ where: { userId: user.id } }),
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    return (
      <AppShell
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarColor: user.avatarColor,
          subscriptionTier: sub?.tier ?? "FREE_COMMUNITY",
        }}
        initialNotifications={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        }))}
      >
        <AboutClient authenticated />
      </AppShell>
    );
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col bg-transparent text-[var(--text-primary)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/85 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <ZervixLogo
              size="md"
              showWordmark
              subtitle="Your Data. Your Privacy. Your Control."
            />
          </Link>

          <nav aria-label="About navigation" className="flex items-center gap-3">
            <Link
              href="/about"
              className="px-3.5 py-2 rounded-xl text-sm font-medium text-cyan-300 border border-cyan-400/35 bg-cyan-500/10"
            >
              About
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-violet-400/60 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-95 shadow-[0_0_24px_rgba(139,92,246,0.4)] transition"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-10">
        <AboutClient authenticated={false} />
      </main>
    </div>
  );
}
