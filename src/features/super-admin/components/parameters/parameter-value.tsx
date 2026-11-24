import { OnOffBadge } from "@/features/super-admin/components/common/badges";
import { COPY } from "@/features/super-admin/constants/copy";
import type { ParameterDefinition, ParameterValue as Value } from "@/features/super-admin/types";
import { cn } from "@/lib/utils";

/**
 * Shows a parameter value the way the table and dialogs display it.
 * For secrets pass the masked value; the real value never reaches the browser.
 */
export function ParameterValue({ definition, value }: { definition: ParameterDefinition; value: Value | null }) {
  if (definition.type === "boolean") return <OnOffBadge on={value === true} />;
  if (value === null || value === "") return <span className="text-muted-foreground">{COPY.common.notSet}</span>;
  if (definition.type === "secret") return <span className="font-mono text-[12.5px] tracking-wide">{String(value)}</span>;
  if (definition.type === "number") {
    const n = Number(value);
    return (
      <>
        {n.toLocaleString("en-AU")}
        {n === 0 && definition.zeroMeans ? <span className="text-[12.5px] text-muted-foreground"> ({definition.zeroMeans})</span> : null}
      </>
    );
  }
  return <span className={cn("break-all whitespace-normal", definition.monospace && "font-mono text-[12.5px]")}>{String(value)}</span>;
}
