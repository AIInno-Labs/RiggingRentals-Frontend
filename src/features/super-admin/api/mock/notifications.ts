import "server-only";
import { ApiError, type SuperAdminApi } from "@/features/super-admin/api/contract";
import { notAvailable } from "@/features/super-admin/api/http/not-available";
import { EMAIL_TEMPLATES_SEED, type EmailTemplateRecord } from "@/features/super-admin/api/mock/email-templates-seed";
import type { EmailTemplate, UpdateEmailTemplateInput } from "@/features/super-admin/types";

/**
 * MOCK — in-memory Notifications API, used only because the backend has no
 * Notifications domain yet. Data lives in server memory and resets when the
 * dev server restarts.
 *
 * To switch to the backend: implement the same method in
 * http/notifications.ts (it overrides this one, see api/index.ts) and delete
 * it here. When every method is real, delete this folder.
 */

type EmailOverride = Partial<Pick<EmailTemplateRecord, "enabled" | "subject" | "body" | "recipients" | "mode">> &
  Pick<UpdateEmailTemplateInput, "days">;

type Store = {
  templates: EmailTemplateRecord[];
  /** Organization id → template id → fields that differ from the platform version. */
  organizationEmails: Record<string, Record<string, EmailOverride>>;
};

const globalStore = globalThis as typeof globalThis & { __superAdminMockEmails?: Store };
function store(): Store {
  globalStore.__superAdminMockEmails ??= { templates: structuredClone(EMAIL_TEMPLATES_SEED), organizationEmails: {} };
  return globalStore.__superAdminMockEmails;
}

const clone = <T>(value: T): T => structuredClone(value);
const overridesOf = (orgId?: string) => (orgId ? (store().organizationEmails[orgId] ?? {}) : {});

function findTemplate(id: string): EmailTemplateRecord {
  const found = store().templates.find((t) => t.id === id);
  if (!found) throw new ApiError("NOT_FOUND", "That email no longer exists.", 404);
  return found;
}

function effectiveTemplate(base: EmailTemplateRecord, orgId?: string): EmailTemplate {
  const own = overridesOf(orgId)[base.id];
  if (!own) return { ...clone(base), custom: false };
  const { days, ...rest } = own;
  return {
    ...clone(base),
    ...clone(rest),
    timing: base.timing && days !== undefined ? { ...base.timing, days } : clone(base.timing),
    custom: true,
  };
}

/** Stores only the fields that differ from the platform version. */
function saveOverride(orgId: string, id: string, patch: EmailOverride) {
  const base = findTemplate(id);
  const all = (store().organizationEmails[orgId] ??= {});
  const merged: EmailOverride = { ...all[id], ...patch };
  const sameAsBase = (key: keyof EmailOverride) =>
    key === "days"
      ? !!base.timing && merged.days === base.timing.days
      : key === "recipients"
        ? JSON.stringify(merged.recipients) === JSON.stringify(base.recipients)
        : merged[key] === base[key];
  (Object.keys(merged) as (keyof EmailOverride)[]).forEach((k) => {
    if (merged[k] === undefined || sameAsBase(k)) delete merged[k];
  });
  if (Object.keys(merged).length) all[id] = merged;
  else delete all[id];
  if (!Object.keys(all).length) delete store().organizationEmails[orgId];
}

/* ---------- figures other areas show (dashboard, organization panel) ---------- */

export function mockEmailSummary(organizationIds: string[]) {
  const { templates } = store();
  return {
    on: templates.filter((t) => t.enabled).length,
    total: templates.length,
    customisedOrganizations: organizationIds.filter((id) => Object.keys(overridesOf(id)).length).length,
  };
}

export function mockOrganizationEmailCounts(organizationId: string) {
  return {
    customEmailCount: Object.keys(overridesOf(organizationId)).length,
    emailsOnCount: store().templates.filter((t) => effectiveTemplate(t, organizationId).enabled).length,
  };
}

/* ---------- API ---------- */

export const mockNotificationsApi = {
  // TODO(backend): GET /admin/notifications?organizationId=
  async listEmailTemplates(scope = {}) {
    return store().templates.map((t) => effectiveTemplate(t, scope.organizationId));
  },

  // TODO(backend): PUT /admin/notifications/{id}?organizationId=
  async updateEmailTemplate(id, input, scope = {}) {
    const base = findTemplate(id);
    if (input.recipients.some((r) => !base.allowedRecipients.includes(r))) {
      throw new ApiError("VALIDATION", "One of the recipients can't receive this email.");
    }
    const patch: EmailOverride = {
      subject: input.subject,
      body: input.body,
      recipients: input.recipients,
      ...(base.timing && input.days !== undefined ? { days: input.days } : {}),
      ...(base.modeSelectable && input.mode ? { mode: input.mode } : {}),
    };
    if (scope.organizationId) {
      saveOverride(scope.organizationId, id, patch);
      return;
    }
    const { days, ...rest } = patch;
    Object.assign(base, rest);
    if (base.timing && days !== undefined) base.timing.days = days;
    if (input.adminCanTurnOff !== undefined) base.adminCanTurnOff = input.adminCanTurnOff;
  },

  // TODO(backend): PATCH /admin/notifications/{id}/enabled?organizationId=  { enabled }
  async setEmailEnabled(id, enabled, scope = {}) {
    const base = findTemplate(id);
    if (scope.organizationId) saveOverride(scope.organizationId, id, { enabled });
    else base.enabled = enabled;
  },

  // TODO(backend): DELETE /admin/notifications/{id}?organizationId=
  async resetEmailTemplate(id, organizationId) {
    findTemplate(id);
    const all = store().organizationEmails[organizationId];
    if (!all) return;
    delete all[id];
    if (!Object.keys(all).length) delete store().organizationEmails[organizationId];
  },

  // TODO(backend): POST /admin/notifications/{id}/test?organizationId=  → { sentTo }
  // Not mocked: pretending an email was sent would be misleading.
  async sendTestEmail() {
    return notAvailable("Sending a test email");
  },
} satisfies Pick<
  SuperAdminApi,
  "listEmailTemplates" | "updateEmailTemplate" | "setEmailEnabled" | "resetEmailTemplate" | "sendTestEmail"
>;
