"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, Ellipsis } from "lucide-react";

export type RecordAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

/** A portalled disclosure avoids clipping inside scrollable directory tables. */
export function RecordActions({ label, actions, compact = false, disabled = false }: {
  label: string;
  actions: RecordAction[];
  compact?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { close(); trigger.current?.focus(); }
    };
    panel.current?.querySelector<HTMLElement>("a,button:not(:disabled)")?.focus();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [position]);
  const itemClass = "block w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
  return <>
    <button ref={trigger} type="button" disabled={disabled || !actions.length} aria-label={label} aria-expanded={!!position} aria-controls={position ? id : undefined}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
      onClick={() => {
        if (position) return setPosition(null);
        const rect = trigger.current!.getBoundingClientRect();
        setPosition({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - Math.min(actions.length * 40 + 16, 320))), left: Math.max(8, Math.min(rect.right - 256, window.innerWidth - 264)) });
      }}>
      {compact ? <Ellipsis aria-hidden="true" className="h-4 w-4" /> : <>{label}<ChevronDown aria-hidden="true" className="h-4 w-4" /></>}
    </button>
    {position && createPortal(<div id={id} ref={panel} style={position} className="fixed z-50 max-h-80 w-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setPosition(null); }}>
      {actions.map((action) => action.href && !action.disabled ? <Link key={action.label} href={action.href} className={itemClass} onClick={() => setPosition(null)}>{action.label}</Link> :
        <button key={action.label} type="button" disabled={action.disabled} className={itemClass} onClick={() => { setPosition(null); trigger.current?.focus(); action.onClick?.(); }}>{action.label}</button>)}
    </div>, document.body)}
  </>;
}
