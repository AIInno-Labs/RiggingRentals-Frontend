"use client";

import { useState, useTransition } from "react";
import { updateOrderNotesAction } from "@/features/orders/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function OrderNotesEditor({
  orderId,
  quoteNotes,
  notes,
}: {
  orderId: string;
  quoteNotes: string;
  notes: string;
}) {
  const [pending, start] = useTransition();
  const [quote, setQuote] = useState(quoteNotes);
  const [job, setJob] = useState(notes);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await updateOrderNotesAction({
            order_id: orderId,
            quote_notes: quote,
            notes: job,
          });
          if (!result.success) toast.error(result.error.message);
          else toast.success("Notes saved");
        });
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="quote_notes">Quote notes</Label>
        <p className="text-xs text-muted-foreground">
          Shown on the quotation PDF (and picking slip if set).
        </p>
        <Textarea
          id="quote_notes"
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={3}
          placeholder="Delivery window, cert requirements, site access…"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="job_notes">Workshop / job notes</Label>
        <p className="text-xs text-muted-foreground">
          Internal notes for yard and picking slip.
        </p>
        <Textarea
          id="job_notes"
          value={job}
          onChange={(e) => setJob(e.target.value)}
          rows={2}
          placeholder="Pack notes, special handling…"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save notes"}
      </Button>
    </form>
  );
}
