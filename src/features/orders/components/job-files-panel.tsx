"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveAttachmentAction } from "@/features/workshop/actions";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDateTimeAu } from "@/lib/format-date";

const FILE_KINDS = [
  {
    kind: "dispatch" as const,
    label: "Job photo (pre-hire / dispatch)",
    accept: "image/*",
  },
  {
    kind: "return" as const,
    label: "Job photo (post-hire / return)",
    accept: "image/*",
  },
  {
    kind: "picking_slip" as const,
    label: "Picking slip",
    accept: "image/*,application/pdf",
  },
  {
    kind: "return_notes" as const,
    label: "Return notes",
    accept: "image/*,application/pdf,.txt,.doc,.docx",
  },
  {
    kind: "acceptance" as const,
    label: "Signed acceptance / contract PDF",
    accept: "image/*,application/pdf",
  },
];

export type JobFileRow = {
  id: string;
  kind: string;
  storage_path: string;
  created_at: string;
};

export function JobFilesPanel({
  orderId,
  files,
}: {
  orderId: string;
  files: JobFileRow[];
}) {
  const [pending, start] = useTransition();
  const [localFiles, setLocalFiles] = useState(files);

  function upload(kind: (typeof FILE_KINDS)[number]["kind"], file: File) {
    start(async () => {
      const supabase = createClient();
      const path = `${orderId}/${kind}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("rental-evidence")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error(error.message);
        return;
      }
      const result = await saveAttachmentAction({
        order_id: orderId,
        kind,
        storage_path: path,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("File uploaded");
      setLocalFiles((prev) => [
        {
          id: result.data.id,
          kind,
          storage_path: path,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FILE_KINDS.map((k) => (
          <div key={k.kind} className="grid gap-1 rounded-lg border border-[#e4e4e7] p-3">
            <Label htmlFor={`job-file-${k.kind}`} className="text-xs">
              {k.label}
            </Label>
            <input
              id={`job-file-${k.kind}`}
              type="file"
              accept={k.accept}
              disabled={pending}
              className="text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(k.kind, file);
                e.target.value = "";
              }}
            />
          </div>
        ))}
      </div>
      {localFiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No job files yet — upload photos, picking slips, return notes, or signed PDFs.
        </p>
      ) : (
        <ul className="space-y-2">
          {localFiles.map((row) => (
            <li
              key={row.id}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{row.kind.replaceAll("_", " ")}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateTimeAu(row.created_at)}
                </span>
              </div>
              <p className="mt-1 break-all font-mono text-xs">{row.storage_path}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
