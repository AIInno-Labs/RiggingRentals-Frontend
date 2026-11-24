import { connection } from "next/server";
import { ApiError, type SuperAdminApi } from "@/features/super-admin/api/contract";
import { createSeed, type EmailOverride, type EmailTemplateRecord, type MockDatabase } from "@/features/super-admin/api/mock/seed";
import { VALIDATION } from "@/features/super-admin/constants/domain";
import type {
  EmailTemplate,
  MfaSetup,
  Organization,
  OrganizationDetail,
  OrganizationSummary,
  ParameterDefinition,
  ParameterGroupView,
  ParameterValue,
  PrivilegeType,
} from "@/features/super-admin/types";

/**
 * In-memory implementation of the Super Admin API.
 *
 * Data lives in server memory: it survives page loads and hot reloads, and
 * resets when the dev server restarts. It applies the same rules the real
 * backend must (unique codes, required values, etc.) so the UI can be tested
 * end to end before the backend exists.
 */

const LATENCY_MS = 120;

const globalStore = globalThis as typeof globalThis & { __superAdminMockDb?: MockDatabase };
function db(): MockDatabase {
  globalStore.__superAdminMockDb ??= structuredClone(createSeed());
  return globalStore.__superAdminMockDb;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = <T>(value: T): T => structuredClone(value);
const today = () => new Date().toISOString().slice(0, 10);
const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 9)}`;
const isEmpty = (v: ParameterValue | null | undefined) => v === "" || v === null || v === undefined;
const mask = (v: ParameterValue | null | undefined) => (isEmpty(v) ? null : `••••••••${String(v).slice(-4)}`);

/* ---------- lookups ---------- */

function findOrganization(id: string): Organization {
  const found = db().organizations.find((o) => o.id === id);
  if (!found) throw new ApiError("NOT_FOUND", "That organization no longer exists.", 404);
  return found;
}

function findTemplate(id: string): EmailTemplateRecord {
  const found = db().emailTemplates.find((t) => t.id === id);
  if (!found) throw new ApiError("NOT_FOUND", "That email no longer exists.", 404);
  return found;
}

function definitionFor(key: string): ParameterDefinition {
  for (const group of db().parameterGroups) {
    const def = group.items.find((i) => i.key === key);
    if (def) return def;
  }
  throw new ApiError("NOT_FOUND", "That parameter no longer exists.", 404);
}

/* ---------- parameters ---------- */

const overridesOf = (orgId?: string) => (orgId ? db().organizationParameters[orgId] ?? {} : {});
const paramValue = (key: string, orgId?: string): ParameterValue | null => {
  const own = overridesOf(orgId);
  return key in own ? own[key] : db().platformParameters[key] ?? null;
};
const hasOwnValue = (key: string, orgId?: string) => !!orgId && key in overridesOf(orgId);

/** Required values that are empty while their service is switched on. */
function missingKeys(orgId?: string): string[] {
  return db().parameterGroups.flatMap((g) =>
    paramValue(g.items[0].key, orgId)
      ? g.items.filter((i) => i.required && isEmpty(paramValue(i.key, orgId))).map((i) => i.key)
      : [],
  );
}

/** Platform gaps, plus organization gaps that aren't just inherited platform gaps. */
function totalMissingCount(): number {
  const platform = new Set(missingKeys());
  const orgGaps = db()
    .organizations.filter((o) => o.active)
    .reduce((n, o) => n + missingKeys(o.id).filter((k) => !platform.has(k)).length, 0);
  return platform.size + orgGaps;
}

function parseParameter(def: ParameterDefinition, raw: string, current: ParameterValue | null): ParameterValue {
  const value = raw.trim();
  const invalid = (message: string) => new ApiError("VALIDATION", message);
  switch (def.type) {
    case "boolean":
      return value === "true";
    case "secret":
      if (!value && isEmpty(current) && def.required) throw invalid(`${def.label} is required.`);
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

/* ---------- emails ---------- */

const emailOverridesOf = (orgId?: string) => (orgId ? db().organizationEmails[orgId] ?? {} : {});

function effectiveTemplate(base: EmailTemplateRecord, orgId?: string): EmailTemplate {
  const own = emailOverridesOf(orgId)[base.id];
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
function saveEmailOverride(orgId: string, id: string, patch: EmailOverride) {
  const base = findTemplate(id);
  const all = (db().organizationEmails[orgId] ??= {});
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
  if (!Object.keys(all).length) delete db().organizationEmails[orgId];
}

/* ---------- organizations ---------- */

function summarize(o: Organization): OrganizationSummary {
  return {
    ...clone(o),
    parameterOverrideCount: Object.keys(overridesOf(o.id)).length,
    customEmailCount: Object.keys(emailOverridesOf(o.id)).length,
  };
}

function assertUniqueOrganization(code: string, name: string, exceptId?: string) {
  const others = db().organizations.filter((o) => o.id !== exceptId);
  if (others.some((o) => o.code === code)) throw new ApiError("CONFLICT", `Code ${code} is already used by another organization.`, 409);
  if (others.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError("CONFLICT", `An organization called ${name} already exists.`, 409);
  }
}

function findPrivilege(code: string) {
  const found = db().privileges.find((x) => x.code === code);
  if (!found) throw new ApiError("NOT_FOUND", "That privilege no longer exists.", 404);
  return found;
}

/* ---------- implementation ---------- */

const baseMockApi: SuperAdminApi = {
  async getDashboardSummary() {
    await sleep(LATENCY_MS);
    const { organizations, privileges, parameterGroups, emailTemplates } = db();
    const active = organizations.filter((o) => o.active).length;
    const activePrivileges = privileges.filter((x) => x.active).length;
    return {
      organizations: { active, inactive: organizations.length - active, total: organizations.length },
      privileges: { active: activePrivileges, inactive: privileges.length - activePrivileges },
      services: {
        enabled: parameterGroups.filter((g) => paramValue(g.items[0].key)).map((g) => g.name),
        total: parameterGroups.length,
      },
      parameterOverrides: {
        total: organizations.reduce((n, o) => n + Object.keys(overridesOf(o.id)).length, 0),
        organizations: organizations.filter((o) => Object.keys(overridesOf(o.id)).length).length,
      },
      missingParameters: totalMissingCount(),
      emails: {
        on: emailTemplates.filter((t) => t.enabled).length,
        total: emailTemplates.length,
        customisedOrganizations: organizations.filter((o) => Object.keys(emailOverridesOf(o.id)).length).length,
      },
    };
  },

  async getNavBadges() {
    return { parameters: totalMissingCount() };
  },

  async listOrganizations(filters = {}) {
    await sleep(LATENCY_MS);
    const q = filters.q?.trim().toLowerCase() ?? "";
    const status = filters.status ?? "all";
    return db()
      .organizations.filter((o) => status === "all" || (status === "active") === o.active)
      .filter((o) =>
        !q || `${o.name} ${o.code} ${o.state} ${o.address} ${o.admin.name} ${o.admin.email}`.toLowerCase().includes(q),
      )
      .map(summarize);
  },

  async listOrganizationOptions() {
    return db().organizations.map(({ id, code, name, active }) => ({ id, code, name, active }));
  },

  async getOrganization(id) {
    await sleep(LATENCY_MS);
    const o = findOrganization(id);
    const detail: OrganizationDetail = {
      ...summarize(o),
      missingParameterCount: missingKeys(id).length,
      emailsOnCount: db().emailTemplates.filter((t) => effectiveTemplate(t, id).enabled).length,
    };
    return detail;
  },

  async createOrganization(input) {
    await sleep(LATENCY_MS);
    assertUniqueOrganization(input.code, input.name);
    const adminEmail = input.admin.email.toLowerCase();
    if (adminEmail === db().profile.email.toLowerCase() || db().organizations.some((o) => o.admin.email.toLowerCase() === adminEmail)) {
      throw new ApiError("CONFLICT", `${adminEmail} already has an account. Use a different email for this Admin.`, 409);
    }
    const { admin, ...details } = input;
    const created: Organization = {
      id: newId("o_"),
      ...details,
      active: true,
      createdAt: today(),
      admin: { name: admin.name, email: adminEmail, phone: admin.phone },
    };
    db().organizations.push(created);
    return summarize(created);
  },

  async updateOrganization(id, input) {
    await sleep(LATENCY_MS);
    const o = findOrganization(id);
    assertUniqueOrganization(input.code, input.name, id);
    Object.assign(o, input);
    return summarize(o);
  },

  async setOrganizationActive(id, active) {
    await sleep(LATENCY_MS);
    const o = findOrganization(id);
    o.active = active;
    return summarize(o);
  },

  async resetOrganizationAdminPassword(id) {
    await sleep(LATENCY_MS);
    return { email: findOrganization(id).admin.email };
  },

  async listPrivileges(filters = {}) {
    await sleep(LATENCY_MS);
    const all = db().privileges;
    const q = filters.q?.trim().toLowerCase() ?? "";
    const type = filters.type ?? "all";
    const status = filters.status ?? "all";
    const countsByType = { MENU: 0, ACTION: 0, FIELD: 0 } as Record<PrivilegeType, number>;
    all.forEach((x) => countsByType[x.type]++);
    return {
      items: clone(
        all
          .filter((x) => type === "all" || x.type === type)
          .filter((x) => status === "all" || (status === "active") === x.active)
          .filter((x) => !q || `${x.code} ${x.label} ${x.area} ${x.description}`.toLowerCase().includes(q)),
      ),
      total: all.length,
      countsByType,
      areas: [...new Set(all.map((x) => x.area))],
    };
  },

  async createPrivilege(input) {
    await sleep(LATENCY_MS);
    if (db().privileges.some((x) => x.code === input.code)) throw new ApiError("CONFLICT", `${input.code} already exists.`, 409);
    db().privileges.push({ ...input, active: true, createdAt: today() });
  },

  async updatePrivilege(code, input) {
    await sleep(LATENCY_MS);
    Object.assign(findPrivilege(code), input);
  },

  async setPrivilegeActive(code, active) {
    await sleep(LATENCY_MS);
    findPrivilege(code).active = active;
  },

  async getParameters(scope = {}) {
    await sleep(LATENCY_MS);
    const orgId = scope.organizationId;
    if (orgId) findOrganization(orgId);
    const missing = new Set(missingKeys(orgId));
    return db().parameterGroups.map((g): ParameterGroupView => ({
      id: g.id,
      name: g.name,
      description: g.description,
      enabled: !!paramValue(g.items[0].key, orgId),
      missingCount: g.items.filter((i) => missing.has(i.key)).length,
      items: g.items.map((def) => {
        const value = paramValue(def.key, orgId);
        const platform = db().platformParameters[def.key] ?? null;
        const secret = def.type === "secret";
        return {
          ...clone(def),
          value: secret ? null : value,
          maskedValue: secret ? mask(value) : null,
          hasValue: !isEmpty(value),
          source: hasOwnValue(def.key, orgId) ? "organization" : "platform",
          platformDisplay: secret ? mask(platform) : platform,
          overriddenBy: orgId ? [] : db().organizations.filter((o) => hasOwnValue(def.key, o.id)).map((o) => o.code),
          missing: missing.has(def.key),
        };
      }),
    }));
  },

  async updateParameter(key, rawValue, scope = {}) {
    await sleep(LATENCY_MS);
    const def = definitionFor(key);
    const orgId = scope.organizationId;
    if (orgId) findOrganization(orgId);
    const value = parseParameter(def, rawValue, paramValue(key, orgId));
    if (!orgId) {
      db().platformParameters[key] = value;
      return;
    }
    const own = (db().organizationParameters[orgId] ??= {});
    if (value === db().platformParameters[key]) delete own[key];
    else own[key] = value;
    if (!Object.keys(own).length) delete db().organizationParameters[orgId];
  },

  async resetParameter(key, organizationId) {
    await sleep(LATENCY_MS);
    definitionFor(key);
    const own = db().organizationParameters[organizationId];
    if (!own) return;
    delete own[key];
    if (!Object.keys(own).length) delete db().organizationParameters[organizationId];
  },

  async testParameterGroup(groupId, scope = {}) {
    await sleep(LATENCY_MS * 3);
    const group = db().parameterGroups.find((g) => g.id === groupId);
    if (!group) throw new ApiError("NOT_FOUND", "That service no longer exists.", 404);
    const orgId = scope.organizationId;
    const who = orgId ? ` for ${findOrganization(orgId).name}` : "";
    if (!paramValue(group.items[0].key, orgId)) return { ok: false, message: `${group.name} is off${who}. Turn it on first.` };
    const missing = new Set(missingKeys(orgId));
    const labels = group.items.filter((i) => missing.has(i.key)).map((i) => i.label);
    if (labels.length) {
      return { ok: false, message: `Can't connect to ${group.name}${who}: ${labels.join(", ")} ${labels.length > 1 ? "are" : "is"} empty.` };
    }
    return { ok: true, message: `Connected to ${group.name}${who}` };
  },

  async listEmailTemplates(scope = {}) {
    await sleep(LATENCY_MS);
    if (scope.organizationId) findOrganization(scope.organizationId);
    return db().emailTemplates.map((t) => effectiveTemplate(t, scope.organizationId));
  },

  async updateEmailTemplate(id, input, scope = {}) {
    await sleep(LATENCY_MS);
    const base = findTemplate(id);
    const orgId = scope.organizationId;
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
    if (orgId) {
      findOrganization(orgId);
      saveEmailOverride(orgId, id, patch);
      return;
    }
    const { days, ...rest } = patch;
    Object.assign(base, rest);
    if (base.timing && days !== undefined) base.timing.days = days;
    if (input.adminCanTurnOff !== undefined) base.adminCanTurnOff = input.adminCanTurnOff;
  },

  async setEmailEnabled(id, enabled, scope = {}) {
    await sleep(LATENCY_MS);
    const base = findTemplate(id);
    if (scope.organizationId) {
      findOrganization(scope.organizationId);
      saveEmailOverride(scope.organizationId, id, { enabled });
    } else {
      base.enabled = enabled;
    }
  },

  async resetEmailTemplate(id, organizationId) {
    await sleep(LATENCY_MS);
    findTemplate(id);
    const all = db().organizationEmails[organizationId];
    if (!all) return;
    delete all[id];
    if (!Object.keys(all).length) delete db().organizationEmails[organizationId];
  },

  async sendTestEmail(id) {
    await sleep(LATENCY_MS * 2);
    findTemplate(id);
    return { sentTo: db().profile.email };
  },

  async getEmailPreviewContext(scope = {}) {
    const orgId = scope.organizationId;
    const o = orgId ? findOrganization(orgId) : db().organizations.find((x) => x.active) ?? db().organizations[0];
    return {
      fromName: String(paramValue("EMAIL_FROM_NAME", orgId) ?? ""),
      fromAddress: String(paramValue("EMAIL_FROM_ADDRESS", orgId) ?? ""),
      replyTo: String(paramValue("EMAIL_REPLY_TO", orgId) ?? ""),
      organization: { name: o.name, code: o.code, address: o.address, phone: o.phone, email: o.email },
    };
  },

  async getProfile() {
    const { name, email, mobile, mfaEnabled } = db().profile;
    return { name, email, mobile, mfaEnabled };
  },

  async updateProfile(input) {
    await sleep(LATENCY_MS);
    Object.assign(db().profile, input);
  },

  async changePassword({ currentPassword, newPassword }) {
    await sleep(LATENCY_MS);
    if (currentPassword !== db().profile.password) throw new ApiError("VALIDATION", "Current password is incorrect.");
    db().profile.password = newPassword;
  },

  async startMfaSetup(): Promise<MfaSetup> {
    await sleep(LATENCY_MS);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const secret = Array.from({ length: 16 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    db().profile.pendingMfaSecret = secret;
    const label = encodeURIComponent(`Rigging Rentals:${db().profile.email}`);
    return { secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=Rigging%20Rentals` };
  },

  async confirmMfa(code) {
    await sleep(LATENCY_MS);
    if (!db().profile.pendingMfaSecret) throw new ApiError("VALIDATION", "Start the authenticator set-up first.");
    // Mock: any 6-digit code is accepted. The backend verifies the TOTP code.
    if (!VALIDATION.mfaCode.test(code)) throw new ApiError("VALIDATION", "Enter the 6-digit code from the app.");
    db().profile.mfaEnabled = true;
    db().profile.pendingMfaSecret = null;
  },

  async disableMfa() {
    await sleep(LATENCY_MS);
    db().profile.mfaEnabled = false;
  },
};

/**
 * In-memory reads don't go through fetch, so Next.js would otherwise
 * prerender pages at build time with frozen data. `connection()` makes every
 * call request-time, like the real API (which uses fetch with no-store).
 */
function atRequestTime(api: SuperAdminApi): SuperAdminApi {
  return Object.fromEntries(
    Object.entries(api).map(([name, fn]) => [
      name,
      async (...args: unknown[]) => {
        await connection();
        return (fn as (...a: unknown[]) => Promise<unknown>)(...args);
      },
    ]),
  ) as unknown as SuperAdminApi;
}

export const mockSuperAdminApi = atRequestTime(baseMockApi);
