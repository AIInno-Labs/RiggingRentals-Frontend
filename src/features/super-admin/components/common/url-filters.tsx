"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/features/super-admin/components/common/form-parts";
import { COPY } from "@/features/super-admin/constants/copy";
import { QUERY } from "@/features/super-admin/constants/routes";
import type { StatusFilter } from "@/features/super-admin/types";
import { cn } from "@/lib/utils";

/**
 * Reads and writes filters in the page address, so they survive a refresh
 * and can be shared as a link. Empty values are removed from the URL.
 */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(changes: Record<string, string | null | undefined>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return { params, update, pending };
}

const SEARCH_DEBOUNCE_MS = 300;

/** Search box that updates `?q=` shortly after typing stops. */
export function UrlSearchInput({ placeholder, ariaLabel, className }: { placeholder: string; ariaLabel: string; className?: string }) {
  const { params, update } = useUrlParams();
  const urlValue = params.get(QUERY.search) ?? "";
  const [value, setValue] = useState(urlValue);
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue);

  // Keep in step when the URL changes elsewhere (e.g. header search, back button).
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => {
    if (value === urlValue) return;
    const t = setTimeout(() => update({ [QUERY.search]: value.trim() || null }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // `update` is recreated each render; the value comparison guards repeats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, urlValue]);

  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn("h-9 max-w-96 min-w-0 flex-[1_1_220px] bg-white", className)}
    />
  );
}

/** All / Active / Inactive select bound to `?status=`. */
export function UrlStatusSelect() {
  const { params, update } = useUrlParams();
  const value = (params.get(QUERY.status) ?? "all") as StatusFilter;
  const options: [StatusFilter, string][] = [
    ["all", COPY.common.allStatuses],
    ["active", COPY.common.active],
    ["inactive", COPY.common.inactive],
  ];
  return (
    <NativeSelect
      aria-label={COPY.common.statusLabel}
      value={value}
      onChange={(e) => update({ [QUERY.status]: e.target.value === "all" ? null : e.target.value })}
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </NativeSelect>
  );
}
