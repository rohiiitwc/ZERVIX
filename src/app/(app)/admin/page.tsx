import { AdminClient } from "@/components/admin/AdminClient";
import { requireAdminPageUser } from "@/lib/security/auth";

export default async function AdminPage() {
  const user = await requireAdminPageUser();
  return <AdminClient currentAdminId={user.id} />;
}
