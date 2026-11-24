"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FollowUpItem } from "@/features/dashboard/get-follow-ups";
import type { OpsAlert } from "@/features/dashboard/get-fleet-kpis";
import { cn } from "@/lib/utils";

type ActionItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "critical" | "high" | "medium" | "low";
  tab: "all" | "certs" | "logistics" | "maintenance" | "billing" | "sales";
  cta: string;
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
  { id: "maintenance", label: "Shop" },
  { id: "logistics", label: "Logistics" },
  { id: "billing", label: "Billing" },
  { id: "sales", label: "Sales" },
];

const VISIBLE_CAP = 8;

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

function ctaFor(tab: ActionItem["tab"], title: string): string {
  const t = title.toLowerCase();
  if (tab === "certs" || t.includes("cert")) return "Fleet";
  if (tab === "maintenance" || t.includes("parts") || t.includes("maintenance"))
    return "Repair";
  if (tab === "logistics") return "Logistics";
  if (tab === "billing" || t.includes("invoice")) return "Billing";
  if (tab === "sales") return "Orders";
  return "Open";
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

const HANDOFF: Record<ActionItem["tab"], { href: string; label: string }> = {
  all: { href: "/workshop", label: "Workshop" },
  certs: { href: "/admin/catalog", label: "Fleet catalog" },
  maintenance: { href: "/workshop/repairs", label: "Repair bay" },
  logistics: { href: "/admin/logistics", label: "Logistics" },
  billing: { href: "/billing", label: "Billing desk" },
  sales: { href: "/admin/pipeline", label: "Orders" },
};

export function OpsAttentionQueue({
  alerts,
  followUps,
  initialTab = "all",
}: {
  alerts: OpsAlert[];
  followUps: FollowUpItem[];
  initialTab?: ActionItem["tab"];
}) {
  const [tab, setTab] = useState<ActionItem["tab"]>(initialTab);

  const items = useMemo(() => {
    const map = new Map<string, ActionItem>();

    for (const a of alerts) {
      const severity = (
        ["critical", "high", "medium", "low"].includes(a.severity)
          ? a.severity
          : "medium"
      ) as ActionItem["severity"];
      const itemTab = tabForAlert(a);
      const item: ActionItem = {
        id: `alert-${dedupeKey(a.title, a.detail)}`,
        title: a.title,
        detail: a.detail,
        href: a.href,
        severity,
        tab: itemTab,
        cta: ctaFor(itemTab, a.title),
      };
      map.set(dedupeKey(a.title, a.detail), item);
    }

    for (const f of followUps) {
      const key = dedupeKey(f.title, f.detail);
      if (map.has(key)) continue;
      const token = f.detail.split("·")[0]?.trim().toLowerCase() ?? "";
      const already = [...map.values()].some(
        (x) => token && x.detail.toLowerCase().includes(token),
      );
      if (already) continue;
      const itemTab = tabForFollowUp(f);
      map.set(key, {
        id: f.id,
        title: f.title,
        detail: f.detail,
        href: f.href,
        severity: severityForFollowUp(f),
        tab: itemTab,
        cta: ctaFor(itemTab, f.title),
      });
    }

    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...map.values()].sort(
      (a, b) => rank[a.severity] - rank[b.severity],
    );
  }, [alerts, followUps]);

  const counts = useMemo(() => {
    const c: Record<ActionItem["tab"], number> = {
      all: items.length,
      certs: 0,
      logistics: 0,
      maintenance: 0,
      billing: 0,
      sales: 0,
    };
    for (const i of items) {
      if (i.tab !== "all") c[i.tab] += 1;
    }
    return c;
  }, [items]);

  const filtered =
    tab === "all" ? items : items.filter((i) => i.tab === tab);
  const visible = filtered.slice(0, VISIBLE_CAP);
  const handoff = HANDOFF[tab];

  return (
    <section
      id="needs-you"
      className="anim-rise steel-panel scroll-mt-4 rounded-2xl p-4 md:p-5"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-semibold">Needs you</h3>
          <p className="text-sm text-muted-foreground">
            Cert watch 30d · follow-ups 7d. One action per row.
          </p>
        </div>
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#111111] px-2 text-sm font-semibold tabular-nums text-[#f5d400]">
          {items.length}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              tab === t.id
                ? "bg-[#111111] text-[#f5d400]"
                : "bg-[#f4f4f5] text-muted-foreground hover:bg-[#e4e4e7] hover:text-foreground",
            )}
          >
            {t.label}
            <span className="ml-1 tabular-nums opacity-80">
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d4d4d8] px-3 py-8 text-center text-sm text-muted-foreground">
          Nothing in this queue. Check{" "}
          <Link href="/billing" className="brand-link font-medium">
            Billing
          </Link>{" "}
          or{" "}
          <Link href="/workshop" className="brand-link font-medium">
            Workshop
          </Link>
          .
        </p>
      ) : (
        <>
          <ul className="divide-y divide-[#e4e4e7] rounded-xl border border-[#e4e4e7] bg-white">
            {visible.map((item) => (
              <li key={item.id}>
                <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      SEVERITY_PILL[item.severity],
                    )}
                  >
                    {item.severity}
                  </span>
                  <Link
                    href={item.href}
                    prefetch
                    className="inline-flex h-9 w-[7.5rem] shrink-0 items-center justify-center rounded-lg bg-[#111111] px-2 text-xs font-semibold text-[#f5d400] transition-colors hover:bg-black"
                  >
                    {item.cta}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {filtered.length > VISIBLE_CAP || tab !== "all" ? (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {filtered.length > VISIBLE_CAP
                ? `Showing ${VISIBLE_CAP} of ${filtered.length}. `
                : null}
              <Link
                href={handoff.href}
                prefetch
                className="brand-link font-medium"
              >
                View all in {handoff.label}
              </Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
