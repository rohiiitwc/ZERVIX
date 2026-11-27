import { AuthenticatedAppLayout } from "@/components/layout/ServerPageWrapper";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>;
}
