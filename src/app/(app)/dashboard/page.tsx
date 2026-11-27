import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/security/auth";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const pref = await prisma.userPreference.findUnique({
    where: { userId: user.id },
    select: { dashboardWidgets: true },
  });
  const widgets = Array.isArray(pref?.dashboardWidgets)
    ? (pref.dashboardWidgets as Array<
        | "kpis"
        | "piiDistribution"
        | "detectionTrends"
        | "recentActivity"
        | "categoryBreakdown"
        | "holographicShield"
      >)
    : [];

  return <DashboardClient initialWidgets={widgets} userName={user.name} />;
}
