"use client";

import { useState, useTransition } from "react";
import {
  createAssetAction,
  updateAssetCertAction,
  upsertCatalogAction,
} from "@/features/catalog/actions";
import { formatCatalogDimensions } from "@/features/catalog/dimensions-spec";
import { EQUIPMENT_CATEGORIES } from "@/features/catalog/equipment-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function CatalogForm() {
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3 md:grid-cols-3 md:[&>*]:min-w-0"
      action={(fd) => {
        start(async () => {
          const weight = String(fd.get("weight") ?? "").trim();
          const length = String(fd.get("length") ?? "").trim();
          const dimensions = formatCatalogDimensions(weight, length);
          const result = await upsertCatalogAction({
            sku: String(fd.get("sku") ?? ""),
            name: String(fd.get("name") ?? ""),
            category: String(fd.get("category") ?? ""),
            description: String(fd.get("description") ?? ""),
            dimensions,
            weight,
            length,
            tracks_meter: false,
            daily_rate: Number(fd.get("daily_rate") ?? 0),
            weekly_rate: Number(fd.get("weekly_rate") ?? 0),
            monthly_rate: Number(fd.get("monthly_rate") ?? 0),
            overage_rate_per_hour: 0,
            default_fuel_surcharge: Number(fd.get("default_fuel_surcharge") ?? 0),
            is_active: true,
          });
          if (!result.success) toast.error(result.error.message);
          else {
            toast.success("Catalog sub category saved");
          }
        });
      }}
    >
      <Field label="SKU" name="sku" required />
      <div className="grid min-w-0 gap-1">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          required
          disabled={pending}
          className="h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Select category…
          </option>
          {EQUIPMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <Field label="Name" name="name" required />
      <Field label="Description" name="description" />
      <Field label="Weight" name="weight" placeholder="e.g. 5t or 500kg" />
      <Field label="Length" name="length" placeholder="e.g. 2m (mainly for beams)" />
      <Field label="Daily rate" name="daily_rate" type="number" step="0.01" required />
      <Field label="Weekly rate" name="weekly_rate" type="number" step="0.01" required />
      <Field label="Monthly rate" name="monthly_rate" type="number" step="0.01" required />
      <Field label="Default fuel" name="default_fuel_surcharge" type="number" step="0.01" />
      <Button type="submit" disabled={pending} className="md:col-span-3">
        {pending ? "Saving…" : "Add catalog model"}
      </Button>
    </form>
  );
}

export function AssetForm({
  catalogOptions,
}: {
  catalogOptions: { id: string; label: string }[];
}) {
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3 md:grid-cols-3 md:[&>*]:min-w-0"
      action={(fd) => {
        start(async () => {
          const expires = String(fd.get("certificate_expires_at") ?? "");
          const nextInsp = String(fd.get("next_inspection_at") ?? "");
          const result = await createAssetAction({
            catalog_id: String(fd.get("catalog_id") ?? ""),
            serial_number: String(fd.get("serial_number") ?? ""),
            meter_hours: Number(fd.get("meter_hours") ?? 0),
            status: "available",
            notes: "",
            certificate_number: String(fd.get("certificate_number") ?? ""),
            certificate_type: String(fd.get("certificate_type") ?? "LOLER"),
            certificate_expires_at: expires || null,
            next_inspection_at: nextInsp || null,
          });
          if (!result.success) toast.error(result.error.message);
          else toast.success("Asset created");
        });
      }}
    >
      <div className="grid min-w-0 gap-1">
        <Label htmlFor="catalog_id">Catalog model</Label>
        <select
          id="catalog_id"
          name="catalog_id"
          required
          disabled={pending}
          className="h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="">Select…</option>
          {catalogOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <Field label="RRP Number" name="serial_number" placeholder="e.g. RRP-0104" required />
      <Field label="Certificate #" name="certificate_number" />
      <Field label="Cert type" name="certificate_type" />
      <Field label="Cert expiry" name="certificate_expires_at" type="date" />
      <Field label="Next inspection" name="next_inspection_at" type="date" />
      <Button type="submit" disabled={pending} className="md:col-span-3">
        {pending ? "Saving…" : "Add RRP unit"}
      </Button>
    </form>
  );
}

export function AssetCertEditor({
  asset,
}: {
  asset: {
    id: string;
    serial_number: string;
    certificate_number: string;
    certificate_type: string;
    certificate_expires_at: string | null;
    next_inspection_at: string | null;
  };
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-5 lg:[&>*]:min-w-0"
      action={(fd) => {
        start(async () => {
          const result = await updateAssetCertAction({
            id: asset.id,
            certificate_number: String(fd.get("certificate_number") ?? ""),
            certificate_type: String(fd.get("certificate_type") ?? "LOLER"),
            certificate_expires_at:
              String(fd.get("certificate_expires_at") ?? "") || null,
            next_inspection_at:
              String(fd.get("next_inspection_at") ?? "") || null,
          });
          if (!result.success) toast.error(result.error.message);
          else toast.success(`Cert updated for RRP ${asset.serial_number}`);
        });
      }}
    >
      <p className="font-mono text-sm sm:col-span-2 lg:col-span-5">RRP: {asset.serial_number}</p>
      <Input
        name="certificate_number"
        defaultValue={asset.certificate_number}
        placeholder="Cert #"
      />
      <Input
        name="certificate_type"
        defaultValue={asset.certificate_type || "LOLER"}
        placeholder="Type"
      />
      <Input
        name="certificate_expires_at"
        type="date"
        defaultValue={asset.certificate_expires_at ?? ""}
      />
      <Input
        name="next_inspection_at"
        type="date"
        defaultValue={asset.next_inspection_at ?? ""}
      />
      <Button type="submit" size="sm" disabled={pending}>
        Save cert
      </Button>
    </form>
  );
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        step={props.step}
        required={props.required}
        placeholder={props.placeholder}
        className="w-full min-w-0"
      />
    </div>
  );
}
