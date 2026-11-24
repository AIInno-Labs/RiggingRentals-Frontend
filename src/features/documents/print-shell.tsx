"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { COMPANY } from "@/features/documents/company-profile";

export function PrintShell({
  title,
  children,
  docLabel,
}: {
  title: string;
  docLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="print-doc mx-auto max-w-[900px] bg-white p-6 text-[#1a1f24] print:max-w-none print:p-0">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-doc, .print-doc * { visibility: visible !important; }
          .print-doc { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        .print-doc table { width: 100%; border-collapse: collapse; }
        .print-doc th, .print-doc td { border: 1px solid #d4d4d8; padding: 6px 8px; font-size: 12px; }
        .print-doc th { background: #f5f5f5; text-align: left; }
      `}</style>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#1a1a1a] pb-4">
        <div className="min-w-0">
          <BrandLogo variant="print" priority />
          <p className="mt-2 text-xs font-semibold text-[#1a1a1a]">
            {COMPANY.legalName}
          </p>
          <p className="mt-1 text-xs text-[#5c6570]">
            ABN: {COMPANY.abn}
            <br />
            {COMPANY.addressLine1}, {COMPANY.addressLine2}
            <br />
            P: {COMPANY.phone} · {COMPANY.email}
            <br />
            {COMPANY.website.replace(/^https?:\/\//, "")}
          </p>
        </div>
        <div className="text-right">
          <p className="inline-block rounded-sm bg-[#f5d400] px-2 py-0.5 text-xs font-bold tracking-wide text-[#111111]">
            {docLabel}
          </p>
          <p className="mt-1 text-xl font-bold">{title}</p>
        </div>
      </header>
      {children}
      <div className="no-print mt-8 flex gap-2">
        <button
          type="button"
          onClick={() => typeof window !== "undefined" && window.print()}
          className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-semibold text-[#f5d400]"
        >
          Print / Save PDF
        </button>
      </div>
    </div>
  );
}
