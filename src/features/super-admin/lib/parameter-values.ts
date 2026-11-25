import { ApiError } from "@/features/super-admin/api/contract";
import { VALIDATION } from "@/features/super-admin/constants/domain";
import type { ParameterDefinition, ParameterValue, ParameterValueType } from "@/features/super-admin/types";

/** Converting parameter values between the backend's strings and the panel's typed values. */

export const isEmptyValue = (v: ParameterValue | null | undefined) => v === "" || v === null || v === undefined;

/** Secrets never reach the browser in full. */
export const maskValue = (v: ParameterValue | null | undefined) => (isEmptyValue(v) ? null : `••••••••${String(v).slice(-4)}`);

/** Backend string → typed value. Null when the backend has no value. */
export function decodeValue(def: ParameterDefinition, raw: string | null | undefined): ParameterValue | null {
  if (raw === null || raw === undefined) return null;
  switch (def.type) {
    case "boolean":
      return raw.trim().toLowerCase() === "true";
    case "number": {
      if (raw.trim() === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    default:
      return raw;
  }
}

export const encodeValue = (value: ParameterValue): string => String(value);

/** Stored in the backend's `paramType` column. */
export const BACKEND_PARAM_TYPE: Record<ParameterValueType, string> = {
  boolean: "Boolean",
  number: "Integer",
  secret: "Secret",
  text: "String",
  url: "String",
  email: "String",
  select: "String",
};

/**
 * Validates what the user typed and turns it into a typed value.
 * A blank secret keeps the current value.
 */
export function parseInput(def: ParameterDefinition, raw: string, current: ParameterValue | null): ParameterValue {
  const value = raw.trim();
  const invalid = (message: string) => new ApiError("VALIDATION", message);
  switch (def.type) {
    case "boolean":
      return value === "true";
    case "secret":
      if (!value && isEmptyValue(current) && def.required) throw invalid(`${def.label} is required.`);
      return value || current || "";
    case "number": {
      const n = Number(value);
      const min = def.min ?? 0;
      const max = def.max ?? Number.MAX_SAFE_INTEGER;
      if (value === "" || !Number.isInteger(n) || n < min || n > max) {
        throw invalid(`Enter a whole number from ${min.toLocaleString("en-AU")} to ${max.toLocaleString("en-AU")}.`);
      }
      return n;
    }
    case "select":
      if (!def.options?.includes(value)) throw invalid(`Pick a ${def.label.toLowerCase()}.`);
      return value;
    default:
      if (def.required && !value) throw invalid(`${def.label} is required.`);
      if (def.type === "url" && value && !VALIDATION.httpsUrl.test(value)) throw invalid("Use a full https:// address.");
      if (def.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw invalid("That email address doesn't look right.");
      }
      return value;
  }
}
