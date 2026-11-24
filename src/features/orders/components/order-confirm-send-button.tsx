"use client";

import { useTransition } from "react";
import { sendOrderConfirmEmailAction, sendQuoteEmailAction } from "@/features/orders/email-actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function OrderConfirmSendButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await sendOrderConfirmEmailAction(orderId);
          if (!result.success) {
            toast.error(result.error.message);
            return;
          }
          if (result.data.sent) toast.success("Confirm + TnC emailed");
          else {
            toast.message("Email API not configured. Opening mail client");
            window.location.href = result.data.mailto;
          }
        })
      }
    >
      {pending ? "Sending…" : "Send confirm + TnC"}
    </Button>
  );
}

export function SendQuoteEmailButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await sendQuoteEmailAction(orderId);
          if (!result.success) {
            toast.error(result.error.message);
            return;
          }
          if (result.data.sent) toast.success("Quotation emailed");
          else {
            toast.message("Email API not configured. Opening mail client");
            window.location.href = result.data.mailto;
          }
        })
      }
    >
      {pending ? "Sending…" : "Email quotation"}
    </Button>
  );
}
