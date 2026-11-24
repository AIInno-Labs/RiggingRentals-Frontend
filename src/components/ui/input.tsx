import * as React from "react"

import { cn } from "@/lib/utils"

const BLOCKED_NUMBER_KEYS = new Set(["-", "+", "e", "E"])

function Input({
  className,
  type,
  min,
  onKeyDown,
  onPaste,
  ...props
}: React.ComponentProps<"input">) {
  const numeric = type === "number"
  return (
    <input
      type={type}
      data-slot="input"
      min={min ?? (numeric ? 0 : undefined)}
      onKeyDown={(e) => {
        if (numeric && BLOCKED_NUMBER_KEYS.has(e.key)) {
          e.preventDefault()
        }
        onKeyDown?.(e)
      }}
      onPaste={(e) => {
        if (numeric && /[eE+\-]/.test(e.clipboardData.getData("text"))) {
          e.preventDefault()
        }
        onPaste?.(e)
      }}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
