import { WorkspaceClient } from "@/components/workspace/WorkspaceClient";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/security/auth";
import { ALL_PII_CATEGORIES, PiiCategory, RedactionMode } from "@/lib/pii/types";

export default async function WorkspacePage() {
  const user = await requirePageUser();
  const pref = await prisma.userPreference.findUnique({
    where: { userId: user.id },
    select: { defaultRedactionMode: true, enabledCategories: true },
  });
  const defaultMode = (pref?.defaultRedactionMode ?? "PARTIAL_MASK") as RedactionMode;
  const defaultCategories =
    pref?.enabledCategories && pref.enabledCategories.length > 0
      ? (pref.enabledCategories as PiiCategory[])
      : ALL_PII_CATEGORIES;

  return (
    <WorkspaceClient
      defaultMode={defaultMode}
      defaultCategories={defaultCategories}
    />
  );
}
