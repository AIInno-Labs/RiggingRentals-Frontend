"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + control + optional hint, with consistent spacing. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mb-3.5 grid gap-2", className)}>
      <Label htmlFor={htmlFor} className="leading-none">
        {label}
        {required ? " *" : null}
      </Label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

/** Form-level error, announced to screen readers. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-3 text-sm text-destructive">
      {message}
    </p>
  );
}

/** Segmented control (pill buttons). Pass `name` to submit the value with a form. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  name,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  name?: string;
  ariaLabel?: string;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label={ariaLabel} className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px]">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 rounded-md border border-transparent px-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors",
              value === o.value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}

/** Bordered checkbox tile, highlighted when ticked. */
export function CheckTile({
  name,
  value,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-lg border bg-white px-2.5 py-2 transition-colors",
        checked ? "border-brand/80 bg-brand/[0.08]" : "border-zinc-200 hover:border-border",
      )}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] size-[15px] accent-brand"
      />
      <span>
        <span className="font-medium">{title}</span>
        {description ? <small className="block text-[11.5px] text-muted-foreground">{description}</small> : null}
      </span>
    </label>
  );
}

/** Native select styled like the app's inputs (used where shadcn Select is overkill). */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
