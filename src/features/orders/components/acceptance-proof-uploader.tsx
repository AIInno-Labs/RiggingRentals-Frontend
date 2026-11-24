"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveAttachmentAction } from "@/features/workshop/actions";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/** Upload email screenshot / signed PDF as T&Cs acceptance proof. */
export function AcceptanceProofUploader({
  orderId,
  onUploaded,
}: {
  orderId: string;
  onUploaded?: (path: string) => void;
}) {
  const [pending, start] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="grid gap-1">
      <Label htmlFor={`acceptance-proof-${orderId}`}>
        Attach proof (optional)
      </Label>
      <input
        id={`acceptance-proof-${orderId}`}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="text-sm"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setFileName(file.name);
          start(async () => {
            const supabase = createClient();
            const path = `${orderId}/acceptance/${Date.now()}-${file.name}`;
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
              kind: "acceptance",
              storage_path: path,
            });
            if (!result.success) {
              toast.error(result.error.message);
              setFileName(null);
              return;
            }
            toast.success("Proof attached");
            onUploaded?.(path);
          });
        }}
      />
      {fileName ? (
        <p className="text-xs text-muted-foreground">{fileName}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Email screenshot or signed PDF
        </p>
      )}
    </div>
  );
}
