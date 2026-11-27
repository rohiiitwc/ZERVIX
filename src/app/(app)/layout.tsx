import { AuthenticatedAppLayout } from "@/components/layout/ServerPageWrapper";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>;
}
