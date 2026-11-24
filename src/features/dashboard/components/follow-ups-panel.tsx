"use client";

import Link from "next/link";
import type { FollowUpItem } from "@/features/dashboard/get-follow-ups";
import { Badge } from "@/components/ui/badge";

const KIND_LABEL: Record<FollowUpItem["kind"], string> = {
  cert: "Certificate",
  off_hire: "Off-hire",
  overdue_invoice: "AR",
  quote_expiring: "Quote",
  account_stop: "Credit",
  lead: "Inquiry",
  delivery: "Logistics",
};

export function FollowUpsPanel({ items }: { items: FollowUpItem[] }) {
  return (
    <div className="anim-rise steel-panel rounded-2xl p-5">
      <div className="mb-3">
        <h3 className="font-display text-xl font-semibold">Do this next</h3>
        <p className="text-sm text-muted-foreground">
          Ranked by urgency. Tap a row to finish it.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d4d4d8] px-3 py-6 text-center text-sm text-muted-foreground">
          Nothing urgent. You&apos;re clear for now.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                prefetch
                className="flex items-start justify-between gap-3 rounded-xl border border-[#e4e4e7] bg-white/60 px-3 py-2.5 transition-colors hover:border-[#f5d400]/40 hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={
                      item.urgency === "now"
                        ? "border-[#b42318]/40 bg-[#b42318]/10 text-[#8f1d14]"
                        : ""
                    }
                  >
                    {item.urgency === "now" ? "Now" : "Soon"}
                  </Badge>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {KIND_LABEL[item.kind]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
