import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Linked summary tile (same look as the ops dashboard pulse tiles). */
export function StatTile({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  href: string;
  tone?: "alert" | "warn";
}) {
  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "group block rounded-2xl border border-zinc-200 bg-white p-4 transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-brand/70 hover:shadow-md",
        tone === "alert" && "border-destructive/30",
        tone === "warn" && "border-brand/50",
      )}
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl leading-tight font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground">{hint}</p>
    </Link>
  );
}
