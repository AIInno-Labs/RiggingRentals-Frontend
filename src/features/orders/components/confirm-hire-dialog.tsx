"use client";

import { useState, useTransition } from "react";
import { recordHireAcceptanceAction } from "@/features/orders/hire-acceptance";
import { updateOrderStatusAction } from "@/features/orders/actions";
import { AcceptanceProofUploader } from "@/features/orders/components/acceptance-proof-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTimeAu } from "@/lib/format-date";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  onConfirmed?: () => void;
};

export function ConfirmHireDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  acceptedAt = null,
  acceptedBy = null,
  onConfirmed,
}: Props) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(acceptedBy ?? "");
  const [method, setMethod] = useState("email_reply");
  const alreadyAccepted = !!acceptedAt;

  function submit() {
    start(async () => {
      if (!alreadyAccepted) {
        if (!name.trim()) {
          toast.error("Who accepted the hire T&Cs?");
          return;
        }
        const accept = await recordHireAcceptanceAction({
          order_id: orderId,
          accepted_by: name.trim(),
          method,
        });
        if (!accept.success) {
          toast.error(accept.error.message);
          return;
        }
      }

      const result = await updateOrderStatusAction({
        order_id: orderId,
        status: "confirmed",
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Confirmed — sent to workshop");
      onOpenChange(false);
      onConfirmed?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm {orderNumber}</DialogTitle>
          <DialogDescription>
            Record hire T&amp;Cs acceptance, then lock stock for the yard.
          </DialogDescription>
        </DialogHeader>

        {alreadyAccepted ? (
          <div className="rounded-xl border border-[#2f6f4e]/30 bg-[#2f6f4e]/10 px-3 py-2.5 text-sm">
            <p className="font-semibold text-[#1f4a34]">Already accepted</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {acceptedBy || "Customer"}
              {acceptedAt ? ` · ${formatDateTimeAu(acceptedAt)}` : ""}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="confirm_accepted_by">Accepted by (name)</Label>
              <Input
                id="confirm_accepted_by"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sam from site"
                autoComplete="name"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="confirm_method">How</Label>
              <select
                id="confirm_method"
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
            <AcceptanceProofUploader orderId={orderId} />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || (!alreadyAccepted && !name.trim())}
            onClick={submit}
            className="bg-[#f5d400] text-[#111111] hover:bg-[#e6c600]"
          >
            {pending ? "Confirming…" : "Confirm & send to workshop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
