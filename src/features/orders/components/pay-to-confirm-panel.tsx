"use client";

import { useState, useTransition } from "react";
import { recordOrderPaymentAction } from "@/features/orders/inventory-lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function PayToConfirmPanel({
  orderId,
  paymentRequired,
  paymentStatus,
}: {
  orderId: string;
  paymentRequired: boolean;
  paymentStatus: string;
}) {
  const [pending, start] = useTransition();
  const [ref, setRef] = useState("");

  if (!paymentRequired) return null;
  if (paymentStatus === "paid" || paymentStatus === "held") {
    return (
      <p className="rounded-lg border border-emerald-700/30 bg-emerald-700/10 px-3 py-2 text-sm">
        Payment {paymentStatus}. Confirm unlocked
        {ref ? ` (${ref})` : ""}.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-[#f5d400]/40 bg-[#f5d400]/10 p-3">
      <p className="text-sm font-semibold text-[#111111]">
        Non-credit customer. Pay or hold deposit before confirm
      </p>
      <p className="text-xs text-muted-foreground">
        Replaces “link to pay without credit”. Record card hold or deposit
        reference to unlock Confirm.
      </p>
      <div className="grid gap-1">
        <Label>Payment / hold reference</Label>
        <Input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Stripe link ref / EFT receipt / card auth"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await recordOrderPaymentAction({
                order_id: orderId,
                payment_hold_ref: ref,
                mark: "held",
              });
              if (!r.success) toast.error(r.error.message);
              else toast.success("Deposit held. You can confirm");
            })
          }
        >
          Mark deposit held
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await recordOrderPaymentAction({
                order_id: orderId,
                payment_hold_ref: ref,
                mark: "paid",
              });
              if (!r.success) toast.error(r.error.message);
              else toast.success("Payment recorded. You can confirm");
            })
          }
        >
          Mark paid
        </Button>
      </div>
    </div>
  );
}
