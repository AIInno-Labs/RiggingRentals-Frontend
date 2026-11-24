"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendQuoteEmailAction } from "@/features/orders/email-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmHireDialog } from "@/features/orders/components/confirm-hire-dialog";
import { toast } from "sonner";

export function OrderDocumentsMenu({
  orderId,
  showPackingSlip,
  showReturnReceipt = false,
}: {
  orderId: string;
  showPackingSlip: boolean;
  showReturnReceipt?: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          Documents
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuItem asChild>
          <Link href={`/admin/orders/${orderId}/documents/quote`}>
            Quotation
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            start(async () => {
              const result = await sendQuoteEmailAction(orderId);
              if (!result.success) {
                toast.error(result.error.message);
                return;
              }
              if (result.data.sent) toast.success("Quotation emailed");
              else {
                toast.message("Email API not configured — opening mail client");
                window.location.href = result.data.mailto;
              }
            });
          }}
        >
          {pending ? "Emailing…" : "Email quotation"}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/orders/${orderId}/documents/hire-agreement`}>
            Hire agreement
          </Link>
        </DropdownMenuItem>
        {showPackingSlip ? (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/workshop/orders/${orderId}/picking-slip`}>
                Picking slip
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/workshop/orders/${orderId}/delivery-docket`}>
                Delivery docket
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        {showReturnReceipt ? (
          <DropdownMenuItem asChild>
            <Link href={`/workshop/orders/${orderId}/return-receipt`}>
              Return receipt
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OrderConfirmCta({
  orderId,
  orderNumber,
  acceptedAt,
  acceptedBy,
}: {
  orderId: string;
  orderNumber: string;
  acceptedAt: string | null;
  acceptedBy: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        className="bg-[#f5d400] text-[#111111] hover:bg-[#e6c600]"
        onClick={() => setOpen(true)}
      >
        Confirm & send to workshop
      </Button>
      <ConfirmHireDialog
        open={open}
        onOpenChange={setOpen}
        orderId={orderId}
        orderNumber={orderNumber}
        acceptedAt={acceptedAt}
        acceptedBy={acceptedBy}
        onConfirmed={() => router.refresh()}
      />
    </>
  );
}
