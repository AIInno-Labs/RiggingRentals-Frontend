import type { ParameterDefinition, ParameterGroupId } from "@/features/super-admin/types";

/**
 * Which application parameters the panel shows, and how to edit them.
 *
 * The backend (/admin/parameters) stores only name → value pairs, keyed by
 * `key` below. Labels, input types, validation and grouping are UI concerns
 * and live here. Add a parameter by adding a line; it reads and writes the
 * backend row with the same `key`.
 */

export type ParameterGroupDefinition = {
  id: ParameterGroupId;
  name: string;
  description: string;
  /** The first item is the group's on/off switch. */
  items: ParameterDefinition[];
};

const p = (def: Partial<ParameterDefinition> & Pick<ParameterDefinition, "key" | "label" | "type">): ParameterDefinition => ({
  required: false,
  monospace: false,
  ...def,
});

export const PARAMETER_GROUPS: readonly ParameterGroupDefinition[] = [
  {
    id: "sharepoint",
    name: "SharePoint",
    description: "Where order documents, job photos and signed dockets are filed.",
    items: [
      p({ key: "SHAREPOINT_ENABLED", label: "File documents to SharePoint", type: "boolean" }),
      p({ key: "SHAREPOINT_TENANT_ID", label: "Tenant ID", type: "text", required: true, monospace: true, hint: "Microsoft 365 directory (tenant) ID." }),
      p({ key: "SHAREPOINT_CLIENT_ID", label: "App (client) ID", type: "text", required: true, monospace: true, hint: "From the app registration in Microsoft Entra." }),
      p({ key: "SHAREPOINT_CLIENT_SECRET", label: "Client secret", type: "secret", required: true }),
      p({ key: "SHAREPOINT_SITE_URL", label: "Site URL", type: "url", required: true, monospace: true, hint: "e.g. https://riggingrentals.sharepoint.com/sites/Operations" }),
      p({ key: "SHAREPOINT_LIBRARY", label: "Document library", type: "text" }),
      p({ key: "SHAREPOINT_FOLDER_PATTERN", label: "Folder pattern", type: "text", monospace: true, hint: "You can use {org_code}, {year} and {order_number}." }),
    ],
  },
  {
    id: "ai",
    name: "AI",
    description: "AI assistant that drafts quotes, emails and job notes.",
    items: [
      p({ key: "AI_ENABLED", label: "AI assistant", type: "boolean" }),
      p({ key: "AI_PROVIDER", label: "Provider", type: "select", options: ["Anthropic", "OpenAI", "Azure OpenAI"] }),
      p({ key: "AI_MODEL", label: "Model", type: "text", required: true, monospace: true }),
      p({ key: "AI_API_KEY", label: "API key", type: "secret", required: true }),
      p({ key: "AI_MAX_TOKENS", label: "Max response length (tokens)", type: "number", min: 256, max: 32000 }),
      p({ key: "AI_MONTHLY_LIMIT", label: "Monthly request limit", type: "number", min: 0, max: 1_000_000, zeroMeans: "no limit", hint: "0 means no limit." }),
    ],
  },
  {
    id: "email",
    name: "Email",
    description: "Service that sends quotes, invoices and reminders.",
    items: [
      p({ key: "EMAIL_ENABLED", label: "Send emails", type: "boolean", hint: "When off, staff get an “open in your email app” link instead." }),
      p({ key: "EMAIL_PROVIDER", label: "Provider", type: "select", options: ["Resend", "SMTP"] }),
      p({ key: "EMAIL_API_KEY", label: "API key", type: "secret", required: true }),
      p({ key: "EMAIL_FROM_NAME", label: "From name", type: "text", required: true }),
      p({ key: "EMAIL_FROM_ADDRESS", label: "From address", type: "email", required: true, hint: "Must be on a domain verified with the email service." }),
      p({ key: "EMAIL_REPLY_TO", label: "Reply-to address", type: "email", hint: "Leave empty to send replies to the From address." }),
      p({ key: "EMAIL_DAILY_LIMIT", label: "Daily send limit", type: "number", min: 0, max: 100_000, zeroMeans: "no limit", hint: "0 means no limit." }),
    ],
  },
];

export function parameterDefinition(key: string): ParameterDefinition | undefined {
  for (const group of PARAMETER_GROUPS) {
    const def = group.items.find((i) => i.key === key);
    if (def) return def;
  }
  return undefined;
}
