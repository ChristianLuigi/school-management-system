"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ListPagination, useListPage } from "@/components/list-pagination";
import { LIST_PAGE_SIZE } from "@/lib/list-pagination";

/** Display-only paging: source arrays remain intact for totals, exports and saves. */
export function PaginatedCollection<T>({ items, children, rows = false, columns = 1, keepMounted = false }: {
  items: readonly T[] | null | undefined;
  children: (item: T, index: number) => ReactNode;
  rows?: boolean;
  columns?: number;
  keepMounted?: boolean;
}) {
  const page = useListPage(items ?? []);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
  const controls = !printing && page.pages > 1 ? <ListPagination {...page} /> : null;
  const visible = printing || keepMounted ? items ?? [] : page.items;
  return <>
    {visible.map((item, index) => {
      const absoluteIndex = printing || keepMounted ? index : page.page * LIST_PAGE_SIZE + index;
      // Inline compensation editors keep their drafts when changing pages.
      if (keepMounted && !rows) return <div key={absoluteIndex} className={!printing && (index < page.page * LIST_PAGE_SIZE || index >= (page.page + 1) * LIST_PAGE_SIZE) ? 'hidden' : undefined}>{children(item, absoluteIndex)}</div>;
      return <Fragment key={absoluteIndex}>{children(item, absoluteIndex)}</Fragment>;
    })}
    {controls ? rows ? <tr><td colSpan={columns}>{controls}</td></tr> : <div className="col-span-full">{controls}</div> : null}
  </>;
}
