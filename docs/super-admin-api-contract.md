# Super Admin API contract

The Super Admin panel (`/super-admin` in the Next.js app) was originally designed against this full contract. In practice it's now wired to the real **Rigg Rental Spring Boot API** for Organizations and Privileges (see `src/features/super-admin/api/http/rigg-rental-api.ts`, configured via `RIGG_RENTAL_API_URL`) — that backend doesn't implement this exact contract shape, so the adapter translates between them. Everything else below (Dashboard, Parameters, Notifications, Profile/MFA) still falls back to in-memory sample data (`src/features/super-admin/api/mock/`), since no backend implements those yet.

The TypeScript types in `src/features/super-admin/types.ts` are the source of truth for every JSON shape below; this doc remains useful as the target shape for whichever of these domains gets a real backend next.

## Conventions

- JSON in and out, `camelCase` field names. Dates are `YYYY-MM-DD`.
- `organizationId` (query parameter) selects **organization scope**. Leave it out for **platform scope**.
- Success: `200` with a body, or `204` with no body for writes that return nothing.
- Errors: a non-2xx status with body `{ "message": "…" }`. The message is shown to the user as is, so write it in plain language.

| Status | Meaning | Example message |
|---|---|---|
| 400 / 422 | Invalid input | `Use a full https:// address.` |
| 403 | Not allowed | — |
| 404 | Not found | `That organization no longer exists.` |
| 409 | Conflict | `Code KEN is already used by another organization.` |

- Authentication isn't wired yet. When it is, add the token in `authHeaders()` in `http-api.ts`. Every endpoint must require the `SUPER_ADMIN` role.

## What the Super Admin must never receive

Staff lists, roles, customers, orders, hire, invoices, revenue or any other figure belonging to an organization. Organizations are returned with **set-up details only**. Secret parameter values are **never** returned. Send `maskedValue` instead (`"••••••••" + last 4 characters`).

---

## Dashboard

### `GET /platform/dashboard` → `DashboardSummary`

```json
{
  "organizations": { "active": 4, "inactive": 1, "total": 5 },
  "privileges": { "active": 47, "inactive": 0 },
  "services": { "enabled": ["SharePoint", "AI", "Email"], "total": 3 },
  "parameterOverrides": { "total": 8, "organizations": 4 },
  "missingParameters": 1,
  "emails": { "on": 10, "total": 12, "customisedOrganizations": 2 }
}
```

- `missingParameters`: required parameters that are empty while their service is on. Count platform gaps, plus gaps in **active** organizations that aren't inherited from a platform gap.

### `GET /platform/nav-badges` → `{ "parameters": 1 }`

Same number as `missingParameters`. Called on every page for the menu badge, so keep it cheap.

## Organizations

`Organization`:

```json
{
  "id": "o_ken", "code": "KEN", "name": "Kenwick", "state": "WA",
  "address": "135 Logistics Boulevard, Kenwick WA 6107",
  "phone": "+61 8 9358 4099", "email": "perth@riggingrentals.com.au",
  "active": true, "createdAt": "2026-08-11",
  "admin": { "name": "Daniel Hayes", "email": "daniel.hayes@riggingrentals.com.au", "phone": "0412 555 019" }
}
```

- `state` is one of `WA NT SA QLD NSW ACT VIC TAS`. It sets the organization's time zone.
- `OrganizationSummary` adds `parameterOverrideCount` (parameters with an organization value) and `customEmailCount` (emails with an organization version).

| Method & path | Body | Returns |
|---|---|---|
| `GET /platform/organizations?q=&status=` | — | `OrganizationSummary[]` |
| `GET /platform/organizations/options` | — | `[{ id, code, name, active }]` |
| `GET /platform/organizations/{id}` | — | `OrganizationDetail` |
| `POST /platform/organizations` | `CreateOrganizationInput` | `OrganizationSummary` |
| `PUT /platform/organizations/{id}` | `OrganizationInput` | `OrganizationSummary` |
| `PATCH /platform/organizations/{id}/status` | `{ "active": false }` | `OrganizationSummary` |
| `POST /platform/organizations/{id}/admin/password-reset` | — | `{ "email": "…" }` |

**Query parameters and detail fields**
- `q` searches name, code, state, address, Admin name and Admin email.
- `status` is `active`, `inactive` or `all` (the default).
- `OrganizationDetail` adds `missingParameterCount` and `emailsOnCount` for that organization.

**Creating an organization** also creates its Admin:

```json
{
  "name": "Port Hedland", "code": "PHE", "state": "WA",
  "address": "2 Wilson Street, Port Hedland WA 6721", "phone": "", "email": "",
  "admin": { "name": "Aaron Walsh", "email": "aaron.walsh@…", "phone": "", "temporaryPassword": "TempPass1!" }
}
```

**Rules**
- `code` is 2–5 capital letters and unique; `409` if it's taken.
- `name` is unique, ignoring case; `409` if it's taken.
- The Admin's email must not belong to any other account; `409` if it does.
- The temporary password is at least 8 characters. The Admin must change it at first sign-in.
- There is no invite email.
- `PUT` changes organization details only. The Admin is fixed after creation.

**Deactivating** signs out everyone in the organization, including its Admin, and blocks sign-in. Data is kept. **Activating** restores access.

**Password reset** emails the Admin a reset link.

## Privileges

The Super Admin creates privileges; each organization's Admin combines them into roles.

`Privilege`:

```json
{ "code": "QUOTE_SEND", "label": "Send quotes", "type": "ACTION", "area": "Quotes & orders",
  "description": "", "active": true, "createdAt": "2026-08-11" }
```

`type` is `MENU` (shows a screen), `ACTION` (lets someone do something) or `FIELD` (lets someone see sensitive values).

| Method & path | Body | Returns |
|---|---|---|
| `GET /platform/privileges?q=&type=&status=` | — | `PrivilegeList` |
| `POST /platform/privileges` | `{ code, label, type, area, description }` | `204` |
| `PUT /platform/privileges/{code}` | `{ label, type, area, description }` | `204` |
| `PATCH /platform/privileges/{code}/status` | `{ "active": false }` | `204` |

`PrivilegeList`:
- `items` is filtered by `q`, `type` and `status`.
- `total`, `countsByType` (`{ MENU, ACTION, FIELD }`) and `areas` (distinct, for suggestions) always cover **all** privileges, not just the filtered ones.

**Rules**
- `code` matches `^[A-Z][A-Z0-9_]{2,39}$` and is unique; `409` if it's taken.
- `code` can't be changed, because the app checks access by it.
- There's no delete.
- Deactivating hides the privilege from Admins and removes it from every role in every organization straight away.

## Application parameters

Three services: `sharepoint`, `ai` and `email`. The first item of each group is its on/off switch.

| Method & path | Body | Returns |
|---|---|---|
| `GET /platform/parameters?organizationId=` | — | `ParameterGroupView[]` |
| `PUT /platform/parameters/{key}?organizationId=` | `{ "value": "<string>" }` | `204` |
| `DELETE /platform/parameters/{key}?organizationId={id}` | — | `204` (organization goes back to the platform value) |
| `POST /platform/parameters/{group}/test?organizationId=` | — | `{ "ok": false, "message": "Can't connect to SharePoint for Pinkenba: Site URL is empty." }` |

`ParameterGroupView`:

```json
{
  "id": "sharepoint", "name": "SharePoint", "description": "…",
  "enabled": true, "missingCount": 1,
  "items": [{
    "key": "SHAREPOINT_SITE_URL", "label": "Site URL", "type": "url", "required": true, "monospace": true,
    "hint": "…", "options": null, "min": null, "max": null, "zeroMeans": null,
    "value": "", "maskedValue": null, "hasValue": false,
    "source": "organization", "platformDisplay": "https://riggingrentals.sharepoint.com/sites/Operations",
    "overriddenBy": [], "missing": true
  }]
}
```

**Item fields**
- `type` is one of `boolean`, `text`, `secret`, `url`, `email`, `number` or `select`.
- `options` applies to `select`; `min` and `max` apply to `number`.
- `zeroMeans` is shown next to `0`, for example `"no limit"`.
- `source` is `organization` when that organization has its own value, otherwise `platform`.
- `platformDisplay` is the platform value, shown in organization scope. For secrets it's masked.
- `overriddenBy` lists the codes of organizations with their own value. It's filled in platform scope only.
- `missing` is true when the value is required, empty, and the service is on.
- **Secrets:** `value` is `null`, with `maskedValue` and `hasValue` set instead.

**`PUT` value is always a string**; the server converts and validates it:

| `type` | Rule |
|---|---|
| `boolean` | `"true"` or `"false"` |
| `number` | Whole number between `min` and `max` |
| `select` | One of `options` |
| `url` | Must start with `https://` |
| `email` | Valid email address |
| `secret` | Empty string keeps the current secret |
| `required` (any type) | Can't be empty |

**Saving in organization scope**
- If the value equals the platform value, remove the organization's own value; don't store a copy.

**Parameter keys**

| Group | Keys |
|---|---|
| SharePoint | `SHAREPOINT_ENABLED`, `SHAREPOINT_TENANT_ID`\*, `SHAREPOINT_CLIENT_ID`\*, `SHAREPOINT_CLIENT_SECRET`\* (secret), `SHAREPOINT_SITE_URL`\*, `SHAREPOINT_LIBRARY`, `SHAREPOINT_FOLDER_PATTERN` |
| AI | `AI_ENABLED`, `AI_PROVIDER` (Anthropic / OpenAI / Azure OpenAI), `AI_MODEL`\*, `AI_API_KEY`\* (secret), `AI_MAX_TOKENS` (256–32000), `AI_MONTHLY_LIMIT` (0 = no limit) |
| Email | `EMAIL_ENABLED`, `EMAIL_PROVIDER` (Resend / SMTP), `EMAIL_API_KEY`\* (secret), `EMAIL_FROM_NAME`\*, `EMAIL_FROM_ADDRESS`\*, `EMAIL_REPLY_TO`, `EMAIL_DAILY_LIMIT` (0 = no limit) |

\* required

## Notification emails

Platform emails are the defaults. An organization can have its own version of any email.

| Method & path | Body | Returns |
|---|---|---|
| `GET /platform/notifications?organizationId=` | — | `EmailTemplate[]` (the organization's version where one exists) |
| `PUT /platform/notifications/{id}?organizationId=` | `UpdateEmailTemplateInput` | `204` |
| `PATCH /platform/notifications/{id}/enabled?organizationId=` | `{ "enabled": true }` | `204` |
| `DELETE /platform/notifications/{id}?organizationId={id}` | — | `204` (organization goes back to the platform version) |
| `POST /platform/notifications/{id}/test?organizationId=` | — | `{ "sentTo": "superadmin@…" }` |
| `GET /platform/notifications/preview-context?organizationId=` | — | `EmailPreviewContext` |

`EmailTemplate`:

```json
{
  "id": "hire_ending", "group": "logistics", "name": "Hire ending soon", "trigger": "Before the hire end date",
  "enabled": true, "mode": "auto", "modeSelectable": false,
  "timing": { "days": 3, "label": "before the hire end date" },
  "recipients": ["customer", "rep"],
  "allowedRecipients": ["customer", "accounts", "rep", "orgAdmin", "orgAccounts"],
  "attachment": "", "adminCanTurnOff": true,
  "subject": "Your hire {order_number} ends {hire_end}", "body": "Hi {contact_name},\n\n…",
  "custom": true
}
```

**Field values**
- `group` is one of `sales`, `logistics`, `finance` or `compliance`.
- `recipients` and `allowedRecipients` use `customer`, `accounts`, `rep`, `orgAdmin` and `orgAccounts`.
- `custom` is true when the selected organization has its own version.

**`UpdateEmailTemplateInput`**

```json
{ "subject": "…", "body": "…", "recipients": ["customer"], "days": 3, "mode": "manual", "adminCanTurnOff": true }
```

- `days` (1–90) only applies to emails that have `timing`.
- `mode` only applies when `modeSelectable` is true.
- `adminCanTurnOff` is platform scope only; ignore it for organizations.
- `recipients` must be within `allowedRecipients`.

**Storing organization versions**
- Store only the fields that differ from the platform email.
- If nothing differs, delete the organization's version.

**`EmailPreviewContext`** is used to render the preview:
- `fromName`, `fromAddress` and `replyTo` come from that scope's Email parameters.
- `organization` holds `{ name, code, address, phone, email }`. In platform scope, use the first active organization.

**Placeholders** are filled when the email is sent:

`{contact_name} {customer_name} {order_number} {invoice_number} {hire_start} {hire_end} {quote_valid_until} {jobsite} {customer_po} {offhire_date} {org_name} {org_phone} {cert_count} {amount_due} {due_date} {company_name} {accounts_email} {bsb} {account}`

## My profile

| Method & path | Body | Returns |
|---|---|---|
| `GET /me` | — | `{ name, email, mobile, mfaEnabled }` |
| `PUT /me` | `{ name, mobile }` | `204` |
| `POST /me/password` | `{ currentPassword, newPassword }` | `204`; `400 "Current password is incorrect."` |
| `POST /me/mfa/setup` | — | `{ secret, otpauthUri }` (TOTP) |
| `POST /me/mfa/confirm` | `{ code }` | `204`; `400` if the code is wrong |
| `DELETE /me/mfa` | — | `204` |

- The new password must be at least 8 characters.
- The email can't be changed here.
