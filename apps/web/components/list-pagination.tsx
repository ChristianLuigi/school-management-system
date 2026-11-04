"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePlatformCopy } from "@/components/use-platform-copy";
import { paginateItems } from "@/lib/list-pagination";

export function useListPage<T>(items: readonly T[], resetKey: unknown = items) {
  const [selection, setSelection] = useState({ key: resetKey, page: 0 });
  const result = paginateItems(items, selection.key === resetKey ? selection.page : 0);
  return { ...result, onPageChange: (page: number) => setSelection({ key: resetKey, page }) };
}

export function ListPagination({ page, start, end, total, hasNext, disabled = false, onPageChange }: {
  page: number; start: number; end: number; total?: number; hasNext: boolean; disabled?: boolean; onPageChange: (page: number) => void;
}) {
  const pt = usePlatformCopy();
  return <nav aria-label={pt("List pagination")} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
    <span role="status" aria-live="polite" className="text-xs text-muted-foreground">{total === undefined ? pt("Items {start}–{end}", { start, end }) : pt("Items {start}–{end} of {total}", { start, end, total })}</span>
    <div className="flex gap-2">
      <button type="button" disabled={disabled || page === 0} onClick={() => onPageChange(page - 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-sm disabled:opacity-40"><ChevronLeft size={16} aria-hidden="true" />{pt("Previous")}</button>
      <button type="button" disabled={disabled || !hasNext} onClick={() => onPageChange(page + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-sm disabled:opacity-40">{pt("Next")}<ChevronRight size={16} aria-hidden="true" /></button>
    </div>
  </nav>;
}
