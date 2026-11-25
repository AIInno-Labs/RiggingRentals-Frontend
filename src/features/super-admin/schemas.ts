import { z } from "zod";
import { AUSTRALIAN_STATES, VALIDATION } from "@/features/super-admin/constants/domain";

/**
 * Input validation for every Super Admin form. Server Actions validate with
 * these before calling the API, so the backend never receives malformed input.
 */

const text = z.string().trim();
const optionalEmail = text.refine((v) => v === "" || z.email().safeParse(v).success, {
  error: "Check the email address.",
});

/* ---------- organizations ---------- */

export const organizationSchema = z.object({
  name: text.min(1, { error: "Name is required." }),
  code: text
    .toUpperCase()
    .regex(VALIDATION.organizationCode, { error: "Code must be 2–5 letters." }),
  state: z.enum(AUSTRALIAN_STATES, { error: "Pick a state." }),
  address: text.min(1, { error: "Address is required." }),
  phone: text,
  email: optionalEmail,
});

export const createOrganizationSchema = organizationSchema.extend({
  admin: z.object({
    name: text.min(1, { error: "Admin name is required." }),
    email: text.toLowerCase().pipe(z.email({ error: "Admin email doesn't look right." })),
    phone: text,
    temporaryPassword: z
      .string()
      .min(VALIDATION.minPasswordLength, {
        error: `Temporary password must be at least ${VALIDATION.minPasswordLength} characters.`,
      }),
  }),
});

/* ---------- privileges ---------- */

const privilegeFields = {
  label: text.min(1, { error: "Say what this privilege allows." }),
  type: z.enum(["MENU", "ACTION", "FIELD"], { error: "Pick a type." }),
  area: text.min(1, { error: "Area is required." }),
  description: text,
};

export const createPrivilegeSchema = z.object({
  code: text.toUpperCase().regex(VALIDATION.privilegeCode, {
    error: "Code must start with a letter and use only capital letters, numbers and _ (3–40 characters).",
  }),
  ...privilegeFields,
});

export const updatePrivilegeSchema = z.object(privilegeFields);

/* ---------- parameters ---------- */

export const parameterUpdateSchema = z.object({
  key: text.min(1),
  organizationId: text.optional(),
  /** Raw form value; typed and range-checked against the definition by the API. */
  value: z.string(),
});

/* ---------- notification emails ---------- */

export const emailTemplateUpdateSchema = z.object({
  subject: text.min(1, { error: "Subject is required." }),
  body: text.min(1, { error: "Body is required." }),
  recipients: z
    .array(z.enum(["customer", "accounts", "rep", "orgAdmin", "orgAccounts"]))
    .min(1, { error: "Pick at least one person to send to." }),
  days: z
    .number({ error: "Days must be a whole number." })
    .int({ error: "Days must be a whole number." })
    .min(VALIDATION.emailDaysMin, { error: `Days must be from ${VALIDATION.emailDaysMin} to ${VALIDATION.emailDaysMax}.` })
    .max(VALIDATION.emailDaysMax, { error: `Days must be from ${VALIDATION.emailDaysMin} to ${VALIDATION.emailDaysMax}.` })
    .optional(),
  mode: z.enum(["auto", "manual"]).optional(),
  adminCanTurnOff: z.boolean().optional(),
});

/* ---------- profile ---------- */

export const profileSchema = z.object({
  name: text.min(1, { error: "Display name is required." }),
  mobile: text,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Enter your current password." }),
    newPassword: z.string().min(VALIDATION.minPasswordLength, {
      error: `New password must be at least ${VALIDATION.minPasswordLength} characters.`,
    }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "New passwords don't match.",
    path: ["confirmPassword"],
  });

export const mfaCodeSchema = z.object({
  code: text.regex(VALIDATION.mfaCode, { error: "Enter the 6-digit code from the app." }),
});

/** First validation message, for showing one error at the top of a form. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}
