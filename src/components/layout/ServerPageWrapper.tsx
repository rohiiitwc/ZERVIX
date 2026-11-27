import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/security/auth";
import { AppShell, ShellUser, ShellNotification } from "@/components/layout/AppShell";

export async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();

  const [subscription, notifications] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { tier: true },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const shellUser: ShellUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    subscriptionTier: subscription?.tier,
  };

  const serializedNotifications: ShellNotification[] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <AppShell user={shellUser} initialNotifications={serializedNotifications}>
      {children}
    </AppShell>
  );
}
