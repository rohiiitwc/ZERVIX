import { AuditReportsClient } from "@/components/audits/AuditReportsClient";

export default async function AuditReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const sp = await searchParams;
  return <AuditReportsClient initialSearch={sp.search ?? ""} />;
}
