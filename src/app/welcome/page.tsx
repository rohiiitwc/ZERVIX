import { WelcomeClient } from "@/components/auth/WelcomeClient";
import { requirePageUser } from "@/lib/security/auth";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const candidate = sp.next ?? "";
  // Prevent open redirects; only allow safe internal relative paths
  const nextHref =
    candidate.startsWith("/") && !candidate.startsWith("//") && candidate !== "/welcome"
      ? candidate
      : "/dashboard";

  return (
    <WelcomeClient
      userName={user.name}
      role={user.role}
      nextHref={nextHref}
    />
  );
}
