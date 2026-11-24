"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClientForm } from "@/features/catalog/components/client-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ClientListRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  credit_account: boolean;
  on_stop: boolean;
};

export function ClientsDirectory({
  clients,
  initialQuery = "",
}: {
  clients: ClientListRow[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [payFilter, setPayFilter] = useState<"all" | "cash" | "credit">("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (payFilter === "cash" && c.credit_account) return false;
      if (payFilter === "credit" && !c.credit_account) return false;
      if (!q) return true;
      return (
        c.company_name.toLowerCase().includes(q) ||
        c.contact_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
      );
    });
  }, [clients, query, payFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Customers</h2>
          <p className="text-sm text-muted-foreground">
            Search an account, then quote. Add only when they are new.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add client</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add client</DialogTitle>
            </DialogHeader>
            <ClientForm
              onSaved={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Clients ({filtered.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Company, contact, email, phone…"
              className="h-9 max-w-sm"
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "cash", label: "Cash" },
                  { id: "credit", label: "Credit" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPayFilter(t.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    payFilter === t.id
                      ? "bg-[#111111] text-[#f5d400]"
                      : "bg-[#f4f4f5] text-muted-foreground hover:bg-[#e4e4e7] hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/clients/${row.id}`}
                      className="brand-link"
                    >
                      {row.company_name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.contact_name}</TableCell>
                  <TableCell>
                    {row.on_stop ? (
                      <Badge className="bg-[#b42318] text-white hover:bg-[#b42318]">
                        On stop
                      </Badge>
                    ) : row.credit_account ? (
                      <Badge className="bg-[#027a48] text-white hover:bg-[#027a48]">
                        Credit
                      </Badge>
                    ) : (
                      <Badge className="bg-[#b42318] text-white hover:bg-[#b42318]">
                        Cash
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link
                      href={`/admin/orders/new?client=${row.id}`}
                      className="text-xs font-medium brand-link"
                    >
                      New quote
                    </Link>
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <Link
                      href={`/admin/clients/${row.id}`}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
