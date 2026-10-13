"use client";

import { useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

/** Validate an external image without reading cross-origin bytes or proxying URLs. */
export function LogoLinkImportClient({ disabled, onImport, onBusyChange }: {
  disabled: boolean;
  onImport: (imageUrl: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function importImage() {
    if (busy || disabled) return;
    setError("");
    let target: URL;
    try {
      target = new URL(url.trim());
      if (target.protocol !== "https:" || target.username || target.password) throw new Error();
      // Drive sharing pages are HTML, not image bytes. Do not silently turn a
      // private document URL into a publicly shared resource.
      if (target.hostname === "drive.google.com" || target.hostname === "docs.google.com") throw new Error();
    } catch {
      setError(fr ? "Utilisez un lien HTTPS direct vers une image, pas une page de partage. Pour Drive, téléchargez le logo puis sélectionnez-le depuis votre ordinateur." : "Use a direct HTTPS image link, not a sharing page. For Drive, download the logo then select it from your computer.");
      return;
    }
    setBusy(true);
    onBusyChange(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.referrerPolicy = "no-referrer";
        const timer = window.setTimeout(() => { image.src = ""; reject(new Error()); }, 15000);
        image.onload = () => { window.clearTimeout(timer); image.onload = null; image.onerror = null; if (image.naturalWidth) resolve(); else reject(new Error()); };
        image.onerror = () => { window.clearTimeout(timer); image.onload = null; image.onerror = null; reject(new Error()); };
        image.src = target.href;
      });
      // Keep the external URL; no CORS read or unreliable "cloud upload" claim.
      onImport(target.href);
      setUrl("");
    } catch {
      setError(fr ? "Ce lien ne charge pas d’image publique. Téléchargez le logo puis sélectionnez le fichier sur votre ordinateur." : "This link does not load a public image. Download the logo and select the file from your computer.");
    } finally { setBusy(false); onBusyChange(false); }
  }

  return <div className="rounded-xl border border-border bg-surface-muted p-4">
    <label htmlFor="school-logo-cloud-url" className="flex items-center gap-2 text-sm font-medium"><LinkIcon size={16} aria-hidden="true" />{fr ? "Lien direct vers une image" : "Direct image link"}</label>
    <p className="mt-1 text-xs text-muted-foreground">{fr ? "Le logo restera hébergé à cette adresse. Pour Google Drive privé, téléchargez le fichier puis utilisez l’ajout local." : "The logo stays hosted at this address. For private Google Drive files, download the file and use local upload."}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <input id="school-logo-cloud-url" type="url" value={url} onChange={event => setUrl(event.target.value)} disabled={disabled || busy} placeholder="https://…" className="min-w-0 flex-1 rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground" />
      <button type="button" disabled={disabled || busy || !url.trim()} onClick={() => void importImage()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm disabled:opacity-60"><LinkIcon size={16} aria-hidden="true" />{busy ? (fr ? "Vérification…" : "Checking…") : (fr ? "Utiliser ce lien" : "Use this link")}</button>
    </div>
    {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
  </div>;
}
