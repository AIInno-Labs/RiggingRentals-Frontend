import { NextResponse } from "next/server";
import { getSessionToken } from "@/features/super-admin/auth/session";

/**
 * Hands the signed-in Super Admin's own backend JWT to the browser, so the
 * /super-admin tables can also call the backend directly (visible in the
 * browser's Network tab) — see features/super-admin/api/client/browser-api.ts.
 *
 * Only returns a token to a browser that already holds a valid Super Admin
 * session cookie. Note this does expose the JWT to page JavaScript, which the
 * httpOnly cookie otherwise prevents; remove this route (and browser-api.ts)
 * if direct browser calls are no longer needed.
 */
export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not signed in as Super Admin." }, { status: 401 });
  }
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
