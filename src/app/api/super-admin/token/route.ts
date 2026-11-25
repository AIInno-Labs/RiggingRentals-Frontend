import { NextResponse } from "next/server";
import { getServiceToken } from "@/features/super-admin/api/service-token";
import { ApiError } from "@/features/super-admin/api/contract";

/**
 * Hands the browser a short-lived Rigg Rental Super Admin JWT so the
 * /super-admin panel can call the backend directly (visible in the browser's
 * Network tab), instead of only ever calling it server-side.
 *
 * SECURITY NOTE: this endpoint is unauthenticated, same as the rest of
 * /super-admin today (see docs/super-admin-api-contract.md: "No sign-in is
 * needed. The panel opens directly, for anyone, until the backend adds
 * login."). Anyone who can reach this deployment can fetch a token carrying
 * full platform Super Admin privileges on the Rigg Rental backend. The
 * Super Admin *password* never leaves the server — only this derived,
 * time-limited (~24h) token does — but the token itself is still
 * full-privilege. Gate this behind real authentication before this app
 * handles anything sensitive.
 */
export async function GET() {
  try {
    const token = await getServiceToken();
    return NextResponse.json({ token });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Could not obtain a token.";
    const status = error instanceof ApiError ? error.status : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
