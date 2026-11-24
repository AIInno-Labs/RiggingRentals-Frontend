"use client";

import { useState, useTransition } from "react";
import { upsertClientAction } from "@/features/catalog/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export function ClientForm({
  initial,
  onSaved,
}: {
  initial?: {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
    billing_address: string;
    notes: string;
    credit_account: boolean;
    credit_limit: number;
    payment_terms_days: number;
    on_stop: boolean;
    on_stop_reason: string;
  };
  onSaved?: () => void;
}) {
  const [pending, start] = useTransition();
  const [creditAccount, setCreditAccount] = useState(
    initial?.credit_account ?? true,
  );
  const [onStop, setOnStop] = useState(initial?.on_stop ?? false);

  return (
    <form
      className="grid gap-3 md:grid-cols-2 md:[&>*]:min-w-0"
      action={(fd) => {
        start(async () => {
          const result = await upsertClientAction(
            {
              company_name: String(fd.get("company_name") ?? ""),
              contact_name: String(fd.get("contact_name") ?? ""),
              email: String(fd.get("email") ?? ""),
              phone: String(fd.get("phone") ?? ""),
              billing_address: String(fd.get("billing_address") ?? ""),
              notes: String(fd.get("notes") ?? ""),
              credit_account: creditAccount,
              credit_limit: Number(fd.get("credit_limit") ?? 0),
              payment_terms_days: Number(fd.get("payment_terms_days") ?? 30),
              on_stop: onStop,
              on_stop_reason: String(fd.get("on_stop_reason") ?? ""),
            },
            initial?.id,
          );
          if (!result.success) toast.error(result.error.message);
          else {
            toast.success(initial ? "Client updated" : "Client saved");
            onSaved?.();
          }
        });
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="company_name">Company</Label>
        <Input
          id="company_name"
          name="company_name"
          required
          disabled={pending}
          defaultValue={initial?.company_name}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="contact_name">Contact</Label>
        <Input
          id="contact_name"
          name="contact_name"
          disabled={pending}
          defaultValue={initial?.contact_name}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          disabled={pending}
          defaultValue={initial?.email}
          placeholder="name@company.com.au"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="text"
          inputMode="tel"
          autoComplete="tel"
          disabled={pending}
          defaultValue={initial?.phone}
          placeholder="08 9358 4099"
        />
      </div>
      <div className="grid gap-1 md:col-span-2">
        <Label htmlFor="billing_address">Billing address</Label>
        <Textarea
          id="billing_address"
          name="billing_address"
          disabled={pending}
          defaultValue={initial?.billing_address}
        />
      </div>
      <div className="grid gap-1 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          disabled={pending}
          defaultValue={initial?.notes}
        />
      </div>

      <div className="md:col-span-2 rounded-xl border border-[#e4e4e7] bg-white/50 p-3 space-y-3">
        <p className="text-sm font-semibold">Credit &amp; payment</p>
        <div className="space-y-1.5">
          <Label>Payment type</Label>
          <div className="inline-flex rounded-lg border border-[#e4e4e7] p-0.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => setCreditAccount(false)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                !creditAccount
                  ? "bg-[#b42318] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cash
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setCreditAccount(true)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                creditAccount
                  ? "bg-[#027a48] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Credit
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cash = must pay / hold deposit before confirm. Credit = account terms.
          </p>
        </div>
        {creditAccount ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="credit_limit">Credit limit (0 = no limit)</Label>
              <Input
                id="credit_limit"
                name="credit_limit"
                type="number"
                step="1"
                min={0}
                disabled={pending}
                defaultValue={initial?.credit_limit ?? 0}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="payment_terms_days">Payment terms (days)</Label>
              <Input
                id="payment_terms_days"
                name="payment_terms_days"
                type="number"
                min={0}
                disabled={pending}
                defaultValue={initial?.payment_terms_days ?? 30}
              />
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="credit_limit" value={initial?.credit_limit ?? 0} />
            <input
              type="hidden"
              name="payment_terms_days"
              value={initial?.payment_terms_days ?? 30}
            />
          </>
        )}
        <div className="flex items-center gap-2">
          <Checkbox
            id="on_stop"
            checked={onStop}
            onCheckedChange={(v) => setOnStop(v === true)}
          />
          <Label htmlFor="on_stop">
            Account on stop (blocks confirm &amp; dispatch)
          </Label>
        </div>
        {onStop ? (
          <div className="grid gap-1">
            <Label htmlFor="on_stop_reason">Why on stop?</Label>
            <Input
              id="on_stop_reason"
              name="on_stop_reason"
              disabled={pending}
              defaultValue={initial?.on_stop_reason}
              placeholder="e.g. overdue invoices"
            />
          </div>
        ) : (
          <input type="hidden" name="on_stop_reason" value="" />
        )}
      </div>

      <Button type="submit" disabled={pending} className="md:col-span-2">
        {pending ? "Saving…" : initial ? "Update client" : "Add client"}
      </Button>
    </form>
  );
}
