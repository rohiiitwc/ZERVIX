import { PromptLogClient } from "@/components/prompt-log/PromptLogClient";
import { requirePageUser } from "@/lib/security/auth";

export default async function PromptLogPage() {
  const user = await requirePageUser();
  return <PromptLogClient isAdmin={user.role === "ADMIN"} />;
}
