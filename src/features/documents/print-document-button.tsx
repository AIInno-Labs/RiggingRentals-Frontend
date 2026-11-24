"use client";

export function PrintDocumentButton({
  label = "Print / Save PDF",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-semibold text-[#f5d400]"
    >
      {label}
    </button>
  );
}
