import { NextResponse, type NextRequest } from "next/server";
import { signOutSuperAdmin } from "@/features/super-admin/auth/sign-in";

/**
 * Ends the Super Admin session and goes back to the shared login page.
 * Also used when the backend rejects a session (see app/super-admin/layout.tsx),
 * because a Server Component can't delete cookies itself.
 */
export async function GET(request: NextRequest) {
  await signOutSuperAdmin();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}
