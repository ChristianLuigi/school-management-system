"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";

export function SchoolLogo({ url }: { url?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white p-1.5 text-slate-700">
    {url && url !== failedUrl ? (
      /* Native image supports uploaded data URLs and external school logos. */
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setFailedUrl(url)} />
    ) : <GraduationCap size={24} aria-hidden="true" />}
  </span>;
}
