import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Page title block used at the top of every Super Admin page. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl leading-tight font-semibold">{title}</h2>
        {description ? <p className="mt-1 max-w-[680px] text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** White card with the app's steel-panel look. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("steel-panel anim-rise overflow-hidden rounded-2xl", className)}>{children}</section>;
}

export function PanelHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-zinc-200 px-4 pt-4 pb-3">
      {children ?? (
        <div>
          {title ? <h3 className="flex flex-wrap items-center gap-1.5 text-lg font-semibold">{title}</h3> : null}
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      )}
      {actions}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="p-7 text-center text-muted-foreground">{children}</div>;
}

/** Highlighted notice; `tone="muted"` for neutral information. */
export function Note({ tone = "brand", className, children }: { tone?: "brand" | "muted"; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-[13px]",
        tone === "brand" ? "border-brand/50 bg-brand/[0.08]" : "border-zinc-200 bg-zinc-50",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Heading inside forms and side panels. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h4 className={cn("mt-5 mb-3 border-b border-zinc-200 pb-1.5 text-lg font-semibold first:mt-0", className)}>{children}</h4>
  );
}

/** Two-column label/value list for side panels. */
export function DetailList({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13.5px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-words">{value || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Two-line cell: bold primary text over muted secondary text. */
export function StackedCell({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="whitespace-normal">
      <div className="font-medium">{primary}</div>
      {secondary ? <div className="text-[12.5px] text-muted-foreground">{secondary}</div> : null}
    </div>
  );
}
