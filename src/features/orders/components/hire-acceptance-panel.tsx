"use client";

import { useState, useTransition } from "react";
import { recordHireAcceptanceAction } from "@/features/orders/hire-acceptance";
import { AcceptanceProofUploader } from "@/features/orders/components/acceptance-proof-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDateTimeAu } from "@/lib/format-date";

export function HireAcceptancePanel({
  orderId,
  acceptedAt,
  acceptedBy,
  acceptedMethod,
  status,
  proofs = [],
}: {
  orderId: string;
  acceptedAt: string | null;
  acceptedBy: string;
  acceptedMethod: string;
  status: string;
  proofs?: { id: string; storage_path: string; created_at: string }[];
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(acceptedBy || "");
  const [method, setMethod] = useState(acceptedMethod || "email_reply");

  if (acceptedAt) {
    return (
      <div className="space-y-2 rounded-xl border border-[#2f6f4e]/30 bg-[#2f6f4e]/10 px-3 py-3 text-sm">
        <div>
          <p className="font-semibold text-[#1f4a34]">Hire agreement accepted</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {acceptedBy || "Customer"} via {acceptedMethod.replaceAll("_", " ")}{" "}
            · {formatDateTimeAu(acceptedAt)}
          </p>
        </div>
        {proofs.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {proofs.map((p) => (
              <li key={p.id} className="font-mono break-all">
                Proof: {p.storage_path.split("/").pop()}
              </li>
            ))}
          </ul>
        ) : null}
        <AcceptanceProofUploader orderId={orderId} />
      </div>
    );
  }

  if (status !== "draft") {
    return (
      <div className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/10 px-3 py-3 text-sm">
        <p className="font-semibold text-[#8f1d14]">Acceptance not recorded</p>
        <p className="mt-1 text-xs">
          Record who accepted the hire T&amp;Cs for your audit trail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#e4e4e7] bg-white/70 p-3">
      <div>
        <p className="font-semibold">Customer accepted hire T&amp;Cs?</p>
        <p className="text-xs text-muted-foreground">
          Or use Confirm on Orders; it asks for this in one step.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 sm:[&>*]:min-w-0">
        <div className="grid gap-1">
          <Label>Accepted by (name)</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam from site"
          />
        </div>
        <div className="grid gap-1">
          <Label>How</Label>
          <select
            className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="email_reply">Email reply</option>
            <option value="phone">Phone</option>
            <option value="signed_pdf">Signed PDF</option>
            <option value="in_person">In person</option>
          </select>
        </div>
      </div>
      <AcceptanceProofUploader orderId={orderId} />
      <Button
        type="button"
        disabled={pending || !name.trim()}
        onClick={() =>
          start(async () => {
            const r = await recordHireAcceptanceAction({
              order_id: orderId,
              accepted_by: name.trim(),
              method,
            });
            if (!r.success) toast.error(r.error.message);
            else toast.success("Acceptance recorded. You can confirm next");
          })
        }
      >
        {pending ? "Saving…" : "Record acceptance"}
      </Button>
    </div>
  );
}
