"use client";

import { useState } from "react";
import Link from "next/link";
import { LIFECYCLE_STEPS } from "@/features/rbac/portal-nav";

export function LifecycleStrip({
  highlight,
  defaultOpen = false,
}: {
  highlight?: (typeof LIFECYCLE_STEPS)[number]["key"];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const active = LIFECYCLE_STEPS.find((s) => s.key === highlight);

  return (
    <div className="mb-4 rounded-xl border border-border bg-white/80 px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left text-xs"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-muted-foreground">
          Rental lifecycle
          {active ? (
            <>
              {" · "}
              <span className="font-semibold text-foreground">{active.label}</span>
            </>
          ) : null}
        </span>
        <span className="font-medium text-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <ol className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {LIFECYCLE_STEPS.map((step) => {
            const isActive = highlight === step.key;
            return (
              <li key={step.key} className="shrink-0">
                <Link
                  href={step.href}
                  prefetch
                  title={`${step.label} · ${step.owner}`}
                  className={`block rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
                    isActive
                      ? "border-[#111111] bg-[#f5d400] text-[#111111]"
                      : "border-border bg-white text-muted-foreground hover:border-[#111111]/30 hover:text-foreground"
                  }`}
                >
                  <span className="font-semibold text-foreground">{step.label}</span>
                  <span className="mt-0.5 block text-[10px] opacity-80">{step.owner}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
