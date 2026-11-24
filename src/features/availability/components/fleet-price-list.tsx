"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RateRow = {
  id: string;
  sku: string;
  name: string;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
};

export function FleetPriceList({ rows }: { rows: RateRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search SKU or name…"
        className="h-9 max-w-sm bg-white"
        autoComplete="off"
      />
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Daily</TableHead>
              <TableHead>Weekly</TableHead>
              <TableHead>Monthly</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  No models match “{query.trim()}”.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.sku}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>${row.daily_rate.toFixed(0)}</TableCell>
                  <TableCell>${row.weekly_rate.toFixed(0)}</TableCell>
                  <TableCell>${row.monthly_rate.toFixed(0)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
