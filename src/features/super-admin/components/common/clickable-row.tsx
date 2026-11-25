"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Table row that opens something when clicked or when Enter/Space is pressed.
 * Clicks on buttons and links inside the row keep their own behaviour.
 */
export function ClickableRow({
  onOpen,
  dimmed,
  label,
  children,
}: {
  onOpen: () => void;
  dimmed?: boolean;
  /** Accessible name, e.g. "Open Kenwick". */
  label: string;
  children: ReactNode;
}) {
  const fromControl = (target: EventTarget) => (target as HTMLElement).closest("button, a, input, select, label");

  return (
    <TableRow
      tabIndex={0}
      aria-label={label}
      onClick={(e: MouseEvent) => {
        if (!fromControl(e.target)) onOpen();
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer border-zinc-200 focus-visible:bg-brand/[0.14] focus-visible:outline-none",
        dimmed && "[&>td]:opacity-55",
      )}
    >
      {children}
    </TableRow>
  );
}
