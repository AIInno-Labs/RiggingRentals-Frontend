import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { COPY } from "@/features/super-admin/constants/copy";
import { PRIVILEGE_TYPES } from "@/features/super-admin/constants/domain";
import type { PrivilegeType } from "@/features/super-admin/types";
import { cn } from "@/lib/utils";

const TONES = {
  ok: "border-emerald-700/40 bg-emerald-100 text-emerald-950",
  off: "border-border bg-white text-zinc-500",
  warn: "border-amber-700/50 bg-amber-100 text-amber-950",
  bad: "border-destructive bg-destructive text-white",
  brand: "border-transparent bg-brand text-brand-ink",
  dark: "border-brand-ink bg-brand-ink text-brand",
  neutral: "border-border bg-white text-foreground",
} as const;

export type Tone = keyof typeof TONES;

export function ToneBadge({ tone, className, children, title }: { tone: Tone; className?: string; children: ReactNode; title?: string }) {
  return (
    <Badge variant="outline" title={title} className={cn("my-0.5 mr-1 font-medium", TONES[tone], className)}>
      {children}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <ToneBadge tone={active ? "ok" : "off"}>{active ? COPY.common.active : COPY.common.inactive}</ToneBadge>;
}

export function OnOffBadge({ on }: { on: boolean }) {
  return <ToneBadge tone={on ? "ok" : "off"}>{on ? COPY.common.on : COPY.common.off}</ToneBadge>;
}

export function PrivilegeTypeBadge({ type }: { type: PrivilegeType }) {
  return (
    <Badge variant="outline" className={cn("font-medium lowercase", PRIVILEGE_TYPES[type].className)}>
      {PRIVILEGE_TYPES[type].label}
    </Badge>
  );
}

/** Small yellow count bubble used in the navigation. */
export function CountBubble({ count, inverted }: { count: number; inverted?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
        inverted ? "bg-brand-ink text-brand" : "bg-brand text-brand-ink",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
