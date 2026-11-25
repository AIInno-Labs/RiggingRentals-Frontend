import { ApiError } from "@/features/super-admin/api/contract";

/**
 * Stand-in for an action the backend doesn't support yet, with no mock
 * either. The user just sees a normal error toast when they try it.
 *
 * Every call site is marked `TODO(backend)` with the endpoint it's waiting
 * for. When the backend ships it, replace the `notAvailable(...)` call with a
 * `request(...)` (see client.ts); pages and components need no changes.
 *
 * Search the codebase for `TODO(backend)` to list everything still pending.
 */
export function notAvailable(action: string): never {
  throw new ApiError("NOT_AVAILABLE", `${action} isn't possible right now. Please try again later.`, 501);
}
