"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  clearCertificateFileAction,
  getCertificateDownloadUrlAction,
  updateAssetCertAction,
} from "@/features/catalog/actions";
import {
  AssetForm,
  CatalogForm,
} from "@/features/catalog/components/catalog-forms";
import {
  certValidity,
  certValidityLabel,
  type CertValidity,
} from "@/features/catalog/cert-validity";
import { formatDateAu } from "@/lib/format-date";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type FleetCatalogRow = {
  id: string;
  sku: string;
  category: string | null;
  name: string;
  dimensions: string;
  weight: string;
  length: string;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  tracks_meter: boolean;
  is_active: boolean;
};

export type FleetAssetRow = {
  id: string;
  catalog_id: string;
  serial_number: string;
  status: string;
  certificate_number: string;
  certificate_type: string;
  certificate_expires_at: string | null;
  next_inspection_at: string | null;
  certificate_file_path: string;
  certificate_file_name: string;
  modelSku: string;
  modelName: string;
  modelCategory: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "on_hire", label: "On hire / reserved" },
  { value: "in_inspection", label: "In inspection" },
  { value: "maintenance", label: "Maintenance" },
  { value: "retired", label: "Retired" },
] as const;

const CERT_OPTIONS = [
  { value: "", label: "All certificates" },
  { value: "valid", label: "Valid" },
  { value: "expiring", label: "Expiring (30d)" },
  { value: "expired", label: "Expired" },
  { value: "missing", label: "No expiry date" },
] as const;

const FILE_OPTIONS = [
  { value: "", label: "Any file" },
  { value: "yes", label: "Has file" },
  { value: "no", label: "No file" },
] as const;

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function certBadgeClass(v: CertValidity): string {
  if (v === "expired") return "bg-[#fef3f2] text-[#b42318] border-[#fecdca]";
  if (v === "expiring") return "bg-[#fffaeb] text-[#b54708] border-[#fedf89]";
  if (v === "missing") return "bg-muted text-muted-foreground";
  return "bg-[#ecfdf3] text-[#027a48] border-[#abefc6]";
}

export function FleetConsole({
  manageFleet,
  catalog,
  assets,
  catalogOptions,
}: {
  manageFleet: boolean;
  catalog: FleetCatalogRow[];
  assets: FleetAssetRow[];
  catalogOptions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusFilter = searchParams.get("status")?.trim() ?? "";
  const certFilter = searchParams.get("cert")?.trim() ?? "";
  const qFilter = searchParams.get("q")?.trim() ?? "";
  const categoryFilter = searchParams.get("category")?.trim() ?? "";
  const fileFilter = searchParams.get("file")?.trim() ?? "";
  const tabParam = searchParams.get("tab")?.trim() ?? "";

  const defaultTab =
    tabParam === "models" || tabParam === "units"
      ? tabParam
      : statusFilter || certFilter || fileFilter
        ? "units"
        : "models";

  const [tab, setTab] = useState(defaultTab);
  const [searchDraft, setSearchDraft] = useState(qFilter);
  const [showAddModel, setShowAddModel] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [editing, setEditing] = useState<FleetAssetRow | null>(null);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    setSearchDraft(qFilter);
  }, [qFilter]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const soon = useMemo(
    () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    [],
  );

  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of catalog) {
      if (c.category) set.add(c.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  const counts = useMemo(() => {
    let expired = 0;
    let expiring = 0;
    let missingFile = 0;
    for (const a of assets) {
      const v = certValidity(a.certificate_expires_at, today, soon);
      if (v === "expired") expired += 1;
      if (v === "expiring") expiring += 1;
      if (!a.certificate_file_path) missingFile += 1;
    }
    const activeModels = catalog.filter((c) => c.is_active).length;
    return {
      models: catalog.length,
      activeModels,
      units: assets.length,
      expired,
      expiring,
      missingFile,
    };
  }, [assets, catalog, soon, today]);

  const filteredModels = useMemo(() => {
    const q = qFilter.toLowerCase();
    return catalog.filter((c) => {
      if (categoryFilter && (c.category ?? "") !== categoryFilter) return false;
      if (!q) return true;
      const hay = `${c.sku} ${c.name} ${c.category ?? ""} ${c.weight} ${c.length} ${c.dimensions}`.toLowerCase();
      return hay.includes(q);
    });
  }, [catalog, categoryFilter, qFilter]);

  const filteredAssets = useMemo(() => {
    const q = qFilter.toLowerCase();
    const statusSet =
      statusFilter === "on_hire"
        ? new Set(["on_hire", "reserved"])
        : statusFilter
          ? new Set([statusFilter])
          : null;

    return assets.filter((a) => {
      if (statusSet && !statusSet.has(a.status)) return false;
      if (categoryFilter && a.modelCategory !== categoryFilter) return false;
      const validity = certValidity(a.certificate_expires_at, today, soon);
      if (certFilter && validity !== certFilter) return false;
      if (fileFilter === "yes" && !a.certificate_file_path) return false;
      if (fileFilter === "no" && a.certificate_file_path) return false;
      if (!q) return true;
      const hay =
        `${a.serial_number} ${a.modelSku} ${a.modelName} ${a.certificate_number}`.toLowerCase();
      return hay.includes(q);
    });
  }, [
    assets,
    categoryFilter,
    certFilter,
    fileFilter,
    qFilter,
    soon,
    statusFilter,
    today,
  ]);

  const activeChips = [
    statusFilter
      ? {
          key: "status",
          label:
            statusFilter === "on_hire"
              ? "On hire / reserved"
              : statusFilter.replaceAll("_", " "),
        }
      : null,
    certFilter
      ? {
          key: "cert",
          label:
            CERT_OPTIONS.find((o) => o.value === certFilter)?.label ?? certFilter,
        }
      : null,
    categoryFilter ? { key: "category", label: categoryFilter } : null,
    fileFilter
      ? {
          key: "file",
          label: fileFilter === "yes" ? "Has file" : "No file",
        }
      : null,
    qFilter ? { key: "q", label: `“${qFilter}”` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
            <p className="text-sm text-muted-foreground">
              Yard models, RRP units, and validity certificates
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>
              {counts.activeModels}/{counts.models} models
            </span>
            <span>·</span>
            <span>{counts.units} units</span>
            <span>·</span>
            <span className="text-[#b42318]">{counts.expired} expired</span>
            <span>·</span>
            <span className="text-[#b54708]">{counts.expiring} expiring</span>
            <span>·</span>
            <span>{counts.missingFile} no file</span>
          </div>
        </div>

        {!manageFleet ? (
          <p className="text-sm text-muted-foreground">
            Rates & fleet identity are view-only for sales. Ask an administrator
            to change models, RRP units, or certificates. You can still download
            certificate files.
          </p>
        ) : null}

        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <Badge key={chip.key} variant="secondary" className="gap-1">
                {chip.label}
              </Badge>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setSearchDraft("");
                replaceParams({
                  status: null,
                  cert: null,
                  q: null,
                  category: null,
                  file: null,
                });
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          replaceParams({ tab: value === "models" ? null : value });
        }}
      >
        <TabsList>
          <TabsTrigger value="models">Models (SKU)</TabsTrigger>
          <TabsTrigger value="units">
            Units & certificates ({filteredAssets.length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid min-w-0 flex-1 gap-1">
            <Label htmlFor="fleet-q">Search</Label>
            <Input
              id="fleet-q"
              value={searchDraft}
              placeholder={
                tab === "models"
                  ? "SKU, name, category, weight, length…"
                  : "RRP #, SKU, name, cert #…"
              }
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  replaceParams({ q: searchDraft.trim() || null });
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => replaceParams({ q: searchDraft.trim() || null })}
          >
            Search
          </Button>
          {tab === "units" ? (
            <>
              <div className="grid gap-1">
                <Label htmlFor="fleet-status">Status</Label>
                <select
                  id="fleet-status"
                  className="h-8 min-w-[10rem] rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={statusFilter}
                  onChange={(e) =>
                    replaceParams({ status: e.target.value || null })
                  }
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="fleet-cert">Certificate</Label>
                <select
                  id="fleet-cert"
                  className="h-8 min-w-[10rem] rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={certFilter}
                  onChange={(e) =>
                    replaceParams({ cert: e.target.value || null })
                  }
                >
                  {CERT_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="fleet-file">File</Label>
                <select
                  id="fleet-file"
                  className="h-8 min-w-[8rem] rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={fileFilter}
                  onChange={(e) =>
                    replaceParams({ file: e.target.value || null })
                  }
                >
                  {FILE_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          <div className="grid gap-1">
            <Label htmlFor="fleet-category">Category</Label>
            <select
              id="fleet-category"
              className="h-8 min-w-[10rem] rounded-lg border border-input bg-transparent px-2 text-sm"
              value={categoryFilter}
              onChange={(e) =>
                replaceParams({ category: e.target.value || null })
              }
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <TabsContent value="models" className="mt-4 space-y-4">
          {manageFleet ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddModel((v) => !v)}
              >
                {showAddModel ? "Hide add model" : "Add model"}
              </Button>
              {showAddModel ? (
                <div className="rounded-xl border border-border p-4">
                  <CatalogForm />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Length</TableHead>
                  <TableHead>Daily</TableHead>
                  <TableHead>Weekly</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.sku}</TableCell>
                    <TableCell>{row.category ?? "—"}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="max-w-[8rem] truncate text-muted-foreground">
                      {row.weight || "—"}
                    </TableCell>
                    <TableCell className="max-w-[8rem] truncate text-muted-foreground">
                      {row.length || "—"}
                    </TableCell>
                    <TableCell>{asNumber(row.daily_rate).toFixed(2)}</TableCell>
                    <TableCell>{asNumber(row.weekly_rate).toFixed(2)}</TableCell>
                    <TableCell>
                      {asNumber(row.monthly_rate).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? "secondary" : "outline"}>
                        {row.is_active ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredModels.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground"
                    >
                      No models match.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="units" className="mt-4 space-y-4">
          {manageFleet ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddUnit((v) => !v)}
              >
                {showAddUnit ? "Hide add unit" : "Add unit"}
              </Button>
              {showAddUnit ? (
                <div className="rounded-xl border border-border p-4">
                  <AssetForm catalogOptions={catalogOptions} />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RRP Number</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cert #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Next insp.</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((row) => {
                  const validity = certValidity(
                    row.certificate_expires_at,
                    today,
                    soon,
                  );
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono">
                        {row.serial_number}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.modelSku}
                        </span>{" "}
                        {row.modelName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {row.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.certificate_number || "—"}
                      </TableCell>
                      <TableCell>{row.certificate_type || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium ${certBadgeClass(validity)}`}
                        >
                          {row.certificate_expires_at
                            ? formatDateAu(row.certificate_expires_at)
                            : certValidityLabel(validity)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.next_inspection_at
                          ? formatDateAu(row.next_inspection_at)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {row.certificate_file_path ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            title={row.certificate_file_name || "Certificate file"}
                          >
                            <Paperclip className="size-3.5" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(row)}
                        >
                          {manageFleet ? "Edit cert" : "View cert"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground"
                    >
                      No units match.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {editing ? (
        <CertDialog
          key={editing.id}
          asset={editing}
          manageFleet={manageFleet}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CertDialog({
  asset,
  manageFleet,
  open,
  onOpenChange,
}: {
  asset: FleetAssetRow;
  manageFleet: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [certNumber, setCertNumber] = useState(asset.certificate_number);
  const [certType, setCertType] = useState(asset.certificate_type || "LOLER");
  const [expires, setExpires] = useState(asset.certificate_expires_at ?? "");
  const [nextInsp, setNextInsp] = useState(asset.next_inspection_at ?? "");
  const [filePath, setFilePath] = useState(asset.certificate_file_path);
  const [fileName, setFileName] = useState(asset.certificate_file_name);

  function openSigned(mode: "open" | "download") {
    start(async () => {
      const result = await getCertificateDownloadUrlAction(asset.id);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      if (mode === "open") {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
        return;
      }
      const a = document.createElement("a");
      a.href = result.data.url;
      a.download = result.data.fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">RRP {asset.serial_number}</DialogTitle>
          <DialogDescription>
            {asset.modelSku} {asset.modelName} — certificate details
            {manageFleet ? "" : " (view / download)"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="cert-number">Certificate #</Label>
            <Input
              id="cert-number"
              value={certNumber}
              disabled={!manageFleet || pending}
              onChange={(e) => setCertNumber(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cert-type">Type</Label>
            <Input
              id="cert-type"
              value={certType}
              disabled={!manageFleet || pending}
              onChange={(e) => setCertType(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="cert-expires">Expires</Label>
              <Input
                id="cert-expires"
                type="date"
                value={expires}
                disabled={!manageFleet || pending}
                onChange={(e) => setExpires(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="cert-next">Next inspection</Label>
              <Input
                id="cert-next"
                type="date"
                value={nextInsp}
                disabled={!manageFleet || pending}
                onChange={(e) => setNextInsp(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4" />
              Certificate file
            </div>
            {filePath ? (
              <p className="truncate text-xs text-muted-foreground">
                {fileName || filePath}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No file uploaded</p>
            )}
            <div className="flex flex-wrap gap-2">
              {filePath ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => openSigned("download")}
                  >
                    Download
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => openSigned("open")}
                  >
                    Open
                  </Button>
                </>
              ) : null}
              {manageFleet ? (
                <>
                  <Label
                    htmlFor="cert-upload"
                    className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-input px-3 text-sm hover:bg-muted"
                  >
                    {filePath ? "Replace file" : "Upload PDF / image"}
                  </Label>
                  <input
                    id="cert-upload"
                    type="file"
                    accept=".pdf,image/*"
                    className="sr-only"
                    disabled={pending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      start(async () => {
                        const supabase = createClient();
                        const safe = file.name.replace(/[^\w.\-]+/g, "_");
                        const path = `certificates/${asset.id}/${Date.now()}-${safe}`;
                        const { error } = await supabase.storage
                          .from("rental-certificates")
                          .upload(path, file, { upsert: false });
                        if (error) {
                          toast.error(error.message);
                          return;
                        }
                        if (filePath && filePath !== path) {
                          await supabase.storage
                            .from("rental-certificates")
                            .remove([filePath]);
                        }
                        const result = await updateAssetCertAction({
                          id: asset.id,
                          certificate_number: certNumber,
                          certificate_type: certType,
                          certificate_expires_at: expires || null,
                          next_inspection_at: nextInsp || null,
                          certificate_file_path: path,
                          certificate_file_name: file.name,
                        });
                        if (!result.success) {
                          toast.error(result.error.message);
                          return;
                        }
                        setFilePath(path);
                        setFileName(file.name);
                        toast.success("Certificate file saved");
                        router.refresh();
                      });
                    }}
                  />
                  {filePath ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        start(async () => {
                          const result = await clearCertificateFileAction(
                            asset.id,
                          );
                          if (!result.success) {
                            toast.error(result.error.message);
                            return;
                          }
                          setFilePath("");
                          setFileName("");
                          toast.success("Certificate file removed");
                          router.refresh();
                        });
                      }}
                    >
                      Remove file
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {manageFleet ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  const result = await updateAssetCertAction({
                    id: asset.id,
                    certificate_number: certNumber,
                    certificate_type: certType,
                    certificate_expires_at: expires || null,
                    next_inspection_at: nextInsp || null,
                  });
                  if (!result.success) {
                    toast.error(result.error.message);
                    return;
                  }
                  toast.success(`Cert updated for RRP ${asset.serial_number}`);
                  router.refresh();
                  onOpenChange(false);
                });
              }}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
