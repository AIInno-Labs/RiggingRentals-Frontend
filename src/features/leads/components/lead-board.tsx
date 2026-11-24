"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  convertLeadToClientAction,
  createLeadAction,
  updateLeadStatusAction,
} from "@/features/leads/actions";
import {
  companySimilarity,
  parseEmailLead,
  type LeadParseCatalogItem,
} from "@/features/leads/parse-email-lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/status-pill";
import { toast } from "sonner";

export type LeadRow = {
  id: string;
  source: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  notes: string;
  estimate_notes: string;
  estimated_value: number;
  status: string;
  client_id: string | null;
};

export type ClientMatch = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  order_count: number;
};

type LeadFormState = {
  source: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  notes: string;
  estimate_notes: string;
  estimated_value: string;
};

const EMPTY_FORM: LeadFormState = {
  source: "phone",
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  notes: "",
  estimate_notes: "",
  estimated_value: "0",
};

function digits(s: string) {
  return s.replace(/\D/g, "");
}

export function LeadIntakeForm({
  clients = [],
  catalog = [],
}: {
  clients?: ClientMatch[];
  catalog?: LeadParseCatalogItem[];
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState<LeadFormState>(EMPTY_FORM);
  const [paste, setPaste] = useState("");
  const [matched, setMatched] = useState<ClientMatch | null>(null);
  const [suggestions, setSuggestions] = useState<ClientMatch[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  function setField<K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function findMatches( partial: {
    company_name?: string;
    email?: string;
    phone?: string;
  }) {
    const company = (partial.company_name ?? "").trim().toLowerCase();
    const email = (partial.email ?? "").trim().toLowerCase();
    const phoneDigits = digits(partial.phone ?? "");
    if (!company && !email && phoneDigits.length < 4) {
      setSuggestions([]);
      return;
    }
    const hits = clients
      .filter((c) => {
        if (email && c.email.toLowerCase() === email) return true;
        if (phoneDigits.length >= 4 && digits(c.phone).includes(phoneDigits))
          return true;
        if (
          company.length >= 2 &&
          (c.company_name.toLowerCase().includes(company) ||
            companySimilarity(company, c.company_name) >= 0.84)
        )
          return true;
        return false;
      })
      .slice(0, 6);
    setSuggestions(hits);
  }

  function applyMatch(c: ClientMatch) {
    setForm((prev) => ({
      ...prev,
      company_name: c.company_name,
      contact_name: c.contact_name || prev.contact_name,
      email: c.email || prev.email,
      phone: c.phone || prev.phone,
    }));
    setMatched(c);
    setSuggestions([]);
    toast.success(
      c.order_count > 0
        ? `Repeat client — ${c.order_count} previous order${c.order_count === 1 ? "" : "s"}`
        : "Matched existing client",
    );
  }

  function applyEmailPaste(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const parsed = parseEmailLead(text, { clients, catalog });
    const next = {
      source: "email",
      company_name: parsed.company_name,
      contact_name: parsed.contact_name,
      email: parsed.email,
      phone: parsed.phone,
      notes: parsed.notes,
      estimate_notes: parsed.estimate_notes,
      estimated_value: String(parsed.estimated_value || 0),
    };
    setForm(next);
    findMatches(next);
    setDetailsOpen(true);
    const filled = [
      parsed.company_name && "company",
      parsed.contact_name && "contact",
      parsed.email && "email",
      parsed.phone && "phone",
      parsed.estimated_value > 0 && "value",
      parsed.estimate_notes && "estimate notes",
    ].filter(Boolean);
    toast.success(
      filled.length
        ? `Filled from email: ${filled.join(", ")}`
        : "Pasted into notes — review and complete fields",
    );
  }

  return (
    <form
      className="steel-panel grid gap-2 rounded-2xl p-4 md:grid-cols-3 md:[&>*]:min-w-0"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (!form.company_name.trim()) {
            setDetailsOpen(true);
            toast.error("Add a company name");
            return;
          }
          const result = await createLeadAction({
            source: form.source,
            company_name: form.company_name,
            contact_name: form.contact_name,
            email: form.email,
            phone: form.phone,
            notes: form.notes,
            estimate_notes: form.estimate_notes,
            estimated_value: Number(form.estimated_value || 0),
            status: "qualified",
          });
          if (!result.success) toast.error(result.error.message);
          else {
            toast.success("Qualified lead logged — ready for quote");
            setForm(EMPTY_FORM);
            setPaste("");
            setMatched(null);
            setSuggestions([]);
            setDetailsOpen(false);
          }
        });
      }}
    >
      <h3 className="font-display text-lg font-semibold md:col-span-3">
        Log inquiry
      </h3>

      <div className="grid gap-1 md:col-span-3">
        <Label htmlFor="email_paste">Paste email body</Label>
        <Textarea
          id="email_paste"
          value={paste}
          rows={3}
          placeholder="Paste inquiry email — contact, company, kit ask extracted below."
          onChange={(e) => setPaste(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text.trim().length > 40) {
              e.preventDefault();
              setPaste(text);
              applyEmailPaste(text);
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-[#111111] text-[#f5d400] hover:bg-black"
            disabled={!paste.trim()}
            onClick={() => applyEmailPaste(paste)}
          >
            Parse email into form
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setPaste("");
              setForm(EMPTY_FORM);
              setMatched(null);
              setSuggestions([]);
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="md:col-span-3">
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setDetailsOpen((v) => !v)}
        >
          {detailsOpen ? "Hide details" : "Enter details (phone / walk-in)"}
        </button>
      </div>

      {detailsOpen ? (
        <>
      <div className="grid min-w-0 gap-1">
        <Label>Source</Label>
        <select
          name="source"
          className="h-9 w-full max-w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          value={form.source}
          onChange={(e) => setField("source", e.target.value)}
        >
          <option value="phone">Phone</option>
          <option value="email">Email</option>
          <option value="walk_in">Walk-in</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="grid gap-1">
        <Label>Est. value</Label>
        <Input
          name="estimated_value"
          type="number"
          step="0.01"
          value={form.estimated_value}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || Number(raw) >= 0) setField("estimated_value", raw);
          }}
        />
      </div>
      <div className="relative grid min-w-0 gap-1 md:col-span-1">
        <Label>Company</Label>
        <Input
          name="company_name"
          value={form.company_name}
          onChange={(e) => {
            setMatched(null);
            setField("company_name", e.target.value);
            findMatches({
              company_name: e.target.value,
              email: form.email,
              phone: form.phone,
            });
          }}
          autoComplete="organization"
        />
        {matched ? (
          <p className="text-[11px] font-medium text-emerald-700">
            Repeat client
            {matched.order_count > 0
              ? ` — ${matched.order_count} previous order${matched.order_count === 1 ? "" : "s"}`
              : ""}
          </p>
        ) : null}
        {suggestions.length > 0 && !matched ? (
          <ul className="absolute top-full z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-white py-1 shadow-lg">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => applyMatch(c)}
                >
                  <span className="font-medium">{c.company_name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {c.contact_name || "—"}
                    {c.order_count > 0 ? ` · ${c.order_count} orders` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="grid gap-1">
        <Label>Contact</Label>
        <Input
          name="contact_name"
          value={form.contact_name}
          onChange={(e) => setField("contact_name", e.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label>Email</Label>
        <Input
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => {
            setMatched(null);
            setField("email", e.target.value);
            findMatches({
              company_name: form.company_name,
              email: e.target.value,
              phone: form.phone,
            });
          }}
        />
      </div>
      <div className="grid gap-1">
        <Label>Phone</Label>
        <Input
          name="phone"
          value={form.phone}
          onChange={(e) => {
            setMatched(null);
            setField("phone", e.target.value);
            findMatches({
              company_name: form.company_name,
              email: form.email,
              phone: e.target.value,
            });
          }}
        />
      </div>
      <div className="grid gap-1 md:col-span-3">
        <Label>Notes</Label>
        <Textarea
          name="notes"
          rows={2}
          placeholder="What they need, site, timing…"
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
        />
      </div>
      <div className="grid gap-1 md:col-span-3">
        <Label>Estimate notes</Label>
        <Textarea
          name="estimate_notes"
          rows={2}
          placeholder="Rough kit list / day rates / assumptions"
          value={form.estimate_notes}
          onChange={(e) => setField("estimate_notes", e.target.value)}
        />
      </div>
        </>
      ) : null}
      <Button type="submit" disabled={pending} className="md:col-span-3">
        {pending ? "Saving…" : "Qualify lead"}
      </Button>
    </form>
  );
}

function TruncatedText({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= 160) {
    return (
      <p className="text-sm text-muted-foreground">
        {label ? <span className="font-medium text-foreground">{label}: </span> : null}
        {text}
      </p>
    );
  }
  return (
    <div className="text-sm text-muted-foreground">
      {label ? <span className="font-medium text-foreground">{label}: </span> : null}
      {open ? text : `${text.slice(0, 160)}…`}{" "}
      <button
        type="button"
        className="font-medium text-foreground underline-offset-2 hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Show less" : "Show full inquiry"}
      </button>
    </div>
  );
}

export function LeadBoard({ leads }: { leads: LeadRow[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"newest" | "company_az">("newest");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (!q) return true;
      return (
        lead.company_name.toLowerCase().includes(q) ||
        lead.contact_name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        lead.notes.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sortKey === "company_az") {
        return a.company_name.localeCompare(b.company_name);
      }
      return 0;
    });
    return list;
  }, [leads, query, statusFilter, sortKey]);

  return (
    <div className="space-y-3">
      <div className="steel-panel flex flex-wrap items-end gap-3 rounded-2xl p-3">
        <div className="min-w-[200px] flex-1 grid gap-1">
          <Label className="text-xs font-medium">Search</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Company, contact, email, phone…"
            className="h-9"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs font-medium">Status</Label>
          <select
            className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="qualified">Qualified</option>
            <option value="quoted">Quoted</option>
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs font-medium">Sort</Label>
          <select
            className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
            value={sortKey}
            onChange={(e) =>
              setSortKey(e.target.value as "newest" | "company_az")
            }
          >
            <option value="newest">Newest first</option>
            <option value="company_az">Company A–Z</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No open leads match your search.
        </p>
      ) : (
        filtered.map((lead) => {
          const summaryBits = [
            lead.estimate_notes?.trim()
              ? lead.estimate_notes.trim().slice(0, 80)
              : null,
            lead.estimated_value > 0
              ? `Est $${lead.estimated_value.toFixed(0)}`
              : null,
          ].filter(Boolean);
          return (
            <article key={lead.id} className="steel-panel space-y-2 rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{lead.company_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {lead.source} · {lead.contact_name || "—"} ·{" "}
                    {lead.phone || lead.email}
                  </p>
                  {summaryBits.length > 0 ? (
                    <p className="mt-1 text-xs font-medium text-foreground">
                      {summaryBits.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <StatusPill status={lead.status} />
              </div>
              {lead.notes ? <TruncatedText text={lead.notes} /> : null}
              {lead.estimate_notes && lead.estimate_notes.length > 80 ? (
                <TruncatedText text={lead.estimate_notes} label="Estimate" />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await convertLeadToClientAction(lead.id);
                      if (!r.success) toast.error(r.error.message);
                      else {
                        toast.success("Client ready — opening new quote");
                        router.push(`/admin/orders/new?client=${r.data.client_id}`);
                      }
                    })
                  }
                >
                  Convert → New quote
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await updateLeadStatusAction({
                        id: lead.id,
                        status: "lost",
                      });
                      if (!r.success) toast.error(r.error.message);
                      else toast.success("Lead marked lost");
                    })
                  }
                >
                  Lost
                </Button>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
