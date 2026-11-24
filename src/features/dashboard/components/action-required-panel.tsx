"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FollowUpItem } from "@/features/dashboard/get-follow-ups";
import type { OpsAlert } from "@/features/dashboard/get-fleet-kpis";
import { Badge } from "@/components/ui/badge";

type ActionItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "critical" | "high" | "medium" | "low";
  tab: "all" | "certs" | "logistics" | "maintenance" | "billing" | "sales";
};

const SEVERITY_PILL: Record<ActionItem["severity"], string> = {
  critical: "border-[#b42318]/40 bg-[#b42318] text-white",
  high: "border-[#f5d400]/50 bg-[#f5d400] text-[#111111]",
  medium: "border-[#71717a]/40 bg-[#f4f4f5] text-[#3f3f46]",
  low: "border-[#d4d4d8] bg-white text-[#52525b]",
};

const TABS: { id: ActionItem["tab"]; label: string }[] = [
  { id: "all", label: "All" },
  { id: "certs", label: "Certs" },
  { id: "logistics", label: "Logistics" },
  { id: "maintenance", label: "Shop" },
  { id: "billing", label: "Billing" },
  { id: "sales", label: "Sales" },
];

function tabForAlert(a: OpsAlert): ActionItem["tab"] {
  const t = `${a.title} ${a.detail}`.toLowerCase();
  if (t.includes("cert")) return "certs";
  if (t.includes("off-rent") || t.includes("pickup") || t.includes("delivery"))
    return "logistics";
  if (t.includes("maintenance") || t.includes("parts") || t.includes("inspection"))
    return "maintenance";
  if (t.includes("invoice")) return "billing";
  return "all";
}

function tabForFollowUp(f: FollowUpItem): ActionItem["tab"] {
  switch (f.kind) {
    case "cert":
      return "certs";
    case "off_hire":
    case "delivery":
      return "logistics";
    case "overdue_invoice":
    case "account_stop":
      return "billing";
    case "quote_expiring":
    case "lead":
      return "sales";
  }
}

function severityForFollowUp(f: FollowUpItem): ActionItem["severity"] {
  return f.urgency === "now" ? "critical" : "high";
}

function dedupeKey(title: string, detail: string) {
  return `${title}|${detail}`.toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

export function ActionRequiredPanel({
  alerts,
  followUps,
}: {
  alerts: OpsAlert[];
  followUps: FollowUpItem[];
}) {
  const [tab, setTab] = useState<ActionItem["tab"]>("all");

  const items = useMemo(() => {
    const map = new Map<string, ActionItem>();

    for (const a of alerts) {
      const severity = (["critical", "high", "medium", "low"].includes(a.severity)
        ? a.severity
        : "medium") as ActionItem["severity"];
      const item: ActionItem = {
        id: `alert-${dedupeKey(a.title, a.detail)}`,
        title: a.title,
        detail: a.detail,
        href: a.href,
        severity,
        tab: tabForAlert(a),
      };
      map.set(dedupeKey(a.title, a.detail), item);
    }

    for (const f of followUps) {
      const key = dedupeKey(f.title, f.detail);
      if (map.has(key)) continue;
      // Soft dedupe: same serial / order number already in alerts
      const token = f.detail.split("·")[0]?.trim().toLowerCase() ?? "";
      const already = [...map.values()].some(
        (x) => token && x.detail.toLowerCase().includes(token),
      );
      if (already) continue;
      map.set(key, {
        id: f.id,
        title: f.title,
        detail: f.detail,
        href: f.href,
        severity: severityForFollowUp(f),
        tab: tabForFollowUp(f),
      });
    }

    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...map.values()].sort(
      (a, b) => rank[a.severity] - rank[b.severity],
    );
  }, [alerts, followUps]);

  const filtered =
    tab === "all" ? items : items.filter((i) => i.tab === tab || i.tab === "all");

  return (
    <div className="anim-rise steel-panel rounded-2xl p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-semibold">Action required</h3>
          <p className="text-sm text-muted-foreground">
            Exceptions and follow-ups in one queue.
          </p>
        </div>
        <Badge className="bg-[#111111] text-[#f5d400] hover:bg-[#111111]">
          {items.length}
        </Badge>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-[#111111] text-[#f5d400]"
                : "bg-[#f4f4f5] text-muted-foreground hover:bg-[#e4e4e7] hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d4d4d8] px-3 py-6 text-center text-sm text-muted-foreground">
          Nothing urgent. Yard is clear.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                prefetch
                className="flex items-start justify-between gap-3 rounded-xl border border-[#e4e4e7] bg-white/70 px-3 py-2.5 transition-colors hover:border-[#f5d400]/50 hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_PILL[item.severity]}`}
                >
                  {item.severity}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
