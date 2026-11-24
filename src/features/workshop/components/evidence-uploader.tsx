"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveAttachmentAction } from "@/features/workshop/actions";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function EvidenceUploader({
  orderId,
  assignmentId,
  kind,
  required,
}: {
  orderId: string;
  assignmentId?: string;
  kind: "dispatch" | "return" | "damage";
  required?: boolean;
}) {
  const [pending, start] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const missing = required && !fileName;

  return (
    <div
      className={cn(
        "grid gap-2 rounded-lg p-2",
        missing && "ring-1 ring-amber-500/60",
      )}
    >
      <Label htmlFor={`photo-${kind}-${assignmentId ?? orderId}`}>
        Photo evidence ({kind})
        {required ? <span className="text-amber-700"> *</span> : null}
      </Label>
      <input
        id={`photo-${kind}-${assignmentId ?? orderId}`}
        type="file"
        accept="image/*"
        capture="environment"
        className="text-sm"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setFileName(file.name);
          start(async () => {
            const supabase = createClient();
            const path = `${orderId}/${kind}/${Date.now()}-${file.name}`;
            const { error } = await supabase.storage
              .from("rental-evidence")
              .upload(path, file, { upsert: false });
            if (error) {
              toast.error(error.message);
              setFileName(null);
              return;
            }
            const result = await saveAttachmentAction({
              order_id: orderId,
              assignment_id: assignmentId,
              kind,
              storage_path: path,
            });
            if (!result.success) {
              toast.error(result.error.message);
              setFileName(null);
            } else toast.success("Photo uploaded");
          });
        }}
      />
      {fileName ? (
        <p className="text-xs text-muted-foreground">{fileName}</p>
      ) : missing ? (
        <p className="text-xs text-amber-700">Dispatch photo required</p>
      ) : null}
    </div>
  );
}
