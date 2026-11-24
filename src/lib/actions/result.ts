export type ActionError = {
  code: string;
  message: string;
};

export type ActionResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data, error: null };
}

export function fail<T = never>(
  code: string,
  message: string,
): ActionResult<T> {
  return { success: false, data: null, error: { code, message } };
}
