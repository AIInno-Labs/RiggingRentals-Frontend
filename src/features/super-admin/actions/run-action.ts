import "server-only";
import { revalidatePath } from "next/cache";
import { ZodError, type z } from "zod";
import { ApiError } from "@/features/super-admin/api";
import { SUPER_ADMIN_BASE } from "@/features/super-admin/constants/routes";
import { COPY } from "@/features/super-admin/constants/copy";
import { firstIssue } from "@/features/super-admin/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

/**
 * Runs a Super Admin mutation:
 * validates input → calls the API → refreshes every Super Admin page
 * (so nav badges and lists stay in sync) → returns an ActionResult.
 * API errors become user-facing messages; anything unexpected is logged.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  mutate: (data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", firstIssue(parsed.error));
  return execute(() => mutate(parsed.data));
}

/** Same as runAction, for mutations whose only input is ids/flags. */
export async function execute<T>(mutate: () => Promise<T>): Promise<ActionResult<T>> {
  return call(mutate, true);
}

/** Read-only call from a Client Component (e.g. loading a side panel); no page refresh. */
export async function query<T>(read: () => Promise<T>): Promise<ActionResult<T>> {
  return call(read, false);
}

async function call<T>(fn: () => Promise<T>, refresh: boolean): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (refresh) revalidatePath(SUPER_ADMIN_BASE, "layout");
    return ok(data);
  } catch (error) {
    if (error instanceof ApiError) return fail(error.code, error.message);
    if (error instanceof ZodError) return fail("VALIDATION", firstIssue(error));
    console.error("[super-admin] unexpected action error", error);
    return fail("UNKNOWN", COPY.common.unexpectedError);
  }
}
