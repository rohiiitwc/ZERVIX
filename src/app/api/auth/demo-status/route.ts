import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  DEMO_COOKIE_NAME,
  MAX_DEMO_USES,
  readDemoUsesFromCookie,
} from "@/lib/security/demo-limit";

export async function GET() {
  const cookieStore = await cookies();
  const used = readDemoUsesFromCookie(cookieStore.get(DEMO_COOKIE_NAME)?.value);
  const remaining = Math.max(0, MAX_DEMO_USES - used);

  return NextResponse.json(
    {
      used,
      max: MAX_DEMO_USES,
      remaining,
      exhausted: used >= MAX_DEMO_USES,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
