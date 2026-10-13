"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { LogoLinkImportClient } from "@/components/logo-link-import-client";
import { Building2, ImagePlus, Palette, Contact, FileText, Save, Trash2 } from "lucide-react";

type Branding = {
  schoolId: string;
  name: string;
  code: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  defaultTheme: "light" | "dark" | "system";
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  directorName: string | null;
  reportCardTitleI18n: Record<string, string>;
  reportCardFooterI18n: Record<string, string>;
  brandingUpdatedAt: string | null;
};

export function SchoolBrandingClient({ schoolId }: { schoolId: string }) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [form, setForm] = useState({
    logoUrl: "",
    primaryColor: "#1d4ed8",
    accentColor: "#0f766e",
    defaultTheme: "light",
    addressLine1: "",
    addressLine2: "",
    city: "",
    phone: "",
    email: "",
    website: "",
    directorName: "",
    reportCardTitleFr: "Bulletin scolaire",
    reportCardTitleEn: "Student Report Card",
    reportCardFooterFr: "",
    reportCardFooterEn: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [readingLogo, setReadingLogo] = useState(false);

  const loadBranding = useCallback(async () => {
    setLoading(true);
    setLoaded(false);
    setError("");

    try {
      const res = await fetch(`/api/school-branding?schoolId=${schoolId}`, {
        cache: "no-store",
      });

      const body: Branding | { message?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          "message" in body ? body.message : "Failed to load branding.",
        );
      }

      const branding = body as Branding;

      setForm({
        logoUrl: branding.logoUrl ?? "",
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        defaultTheme: branding.defaultTheme,
        addressLine1: branding.addressLine1 ?? "",
        addressLine2: branding.addressLine2 ?? "",
        city: branding.city ?? "",
        phone: branding.phone ?? "",
        email: branding.email ?? "",
        website: branding.website ?? "",
        directorName: branding.directorName ?? "",
        reportCardTitleFr:
          branding.reportCardTitleI18n?.fr ?? "Bulletin scolaire",
        reportCardTitleEn:
          branding.reportCardTitleI18n?.en ?? "Student Report Card",
        reportCardFooterFr: branding.reportCardFooterI18n?.fr ?? "",
        reportCardFooterEn: branding.reportCardFooterI18n?.en ?? "",
      });
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branding.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  async function saveBranding() {
    if (!loaded || saving) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/school-branding", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          logoUrl: form.logoUrl,
          primaryColor: form.primaryColor,
          accentColor: form.accentColor,
          defaultTheme: form.defaultTheme,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          phone: form.phone,
          email: form.email,
          website: form.website,
          directorName: form.directorName,
          reportCardTitleI18n: {
            fr: form.reportCardTitleFr,
            en: form.reportCardTitleEn,
          },
          reportCardFooterI18n: {
            fr: form.reportCardFooterFr,
            en: form.reportCardFooterEn,
          },
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to save branding.");
      }

      setMessage(fr ? "Paramètres de l’école enregistrés." : "School settings saved.");
      window.dispatchEvent(new Event("almac:branding-change"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branding.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  return (
    <form onSubmit={event => { event.preventDefault(); void saveBranding(); }} className="rounded-2xl border border-border bg-surface text-foreground p-5 sm:p-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Building2 size={20} aria-hidden="true" />
          {fr ? "Identité et apparence de l’école" : "School identity and appearance"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {fr ? "Personnalisez l’espace scolaire et les documents imprimés." : "Customize the school workspace and printed documents."}
        </p>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">
          {fr ? "Chargement…" : "Loading…"}
        </div>
      ) : null}

      {message ? (
        <div role="status" className="mt-4 rounded-xl border border-success/40 bg-success-subtle p-3 text-sm text-success">
          {message}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <fieldset disabled={!loaded || saving || readingLogo} className="mt-6 space-y-6">
      <section className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-2">
        <h4 className="flex items-center gap-2 font-semibold md:col-span-2"><ImagePlus size={18} aria-hidden="true" />Logo</h4>
        <label className="rounded-xl border border-dashed border-input bg-surface-muted p-4 text-sm">
          {fr ? "Depuis votre ordinateur (PNG, JPG, WEBP · 256 Ko maximum)" : "From your computer (PNG, JPG, WEBP · 256 KB maximum)"}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!loaded || saving || readingLogo} className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground" onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 256 * 1024) {
              setError(fr ? "PNG, JPG ou WEBP uniquement, 256 Ko maximum." : "PNG, JPG or WEBP only, 256 KB maximum."); return;
            }
            try {
              setReadingLogo(true);
              const logoUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error("Lecture du logo impossible."));
                reader.readAsDataURL(file);
              });
              setForm(previous => ({ ...previous, logoUrl }));
              setError("");
            } catch { setError(fr ? "Lecture du logo impossible." : "Unable to read the logo."); }
            finally { setReadingLogo(false); }
          }} />
        </label>
        <LogoLinkImportClient disabled={!loaded || saving || readingLogo} onBusyChange={setReadingLogo} onImport={logoUrl => { setForm(previous => ({ ...previous, logoUrl })); setMessage(""); }} />
        {form.logoUrl ? <div className="flex items-center gap-4 rounded-xl bg-surface-muted p-4 md:col-span-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.logoUrl} alt="Logo" className="h-20 max-w-48 object-contain" />
          <div><p className="mb-2 text-xs text-muted-foreground">{fr ? "Aperçu — enregistrez pour appliquer" : "Preview — save to apply"}</p><button type="button" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm" onClick={() => setForm(previous => ({ ...previous, logoUrl: "" }))}><Trash2 size={15} aria-hidden="true" />{fr ? "Retirer" : "Remove"}</button></div>
        </div> : null}
      </section>
      <section className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-2">
        <h4 className="flex items-center gap-2 font-semibold md:col-span-2"><Palette size={18} aria-hidden="true" />{fr ? "Couleurs et thème de l’école" : "School colors and theme"}</h4>
        <label className="text-sm">{fr ? "Couleur principale" : "Primary color"}
          <input aria-label="Primary color" type="color" value={form.primaryColor} onChange={event => setForm(previous => ({ ...previous, primaryColor: event.target.value }))} className="ml-3" />
        </label>
        <label className="text-sm">{fr ? "Couleur secondaire" : "Accent color"}
          <input aria-label="Accent color" type="color" value={form.accentColor} onChange={event => setForm(previous => ({ ...previous, accentColor: event.target.value }))} className="ml-3" />
        </label>
        <label className="text-sm">{fr ? "Thème par défaut" : "Default theme"}
          <select value={form.defaultTheme} onChange={event => setForm(previous => ({ ...previous, defaultTheme: event.target.value }))} className="ml-3 rounded border border-input bg-surface text-foreground p-2">
            <option value="light">{fr ? "Clair" : "Light"}</option><option value="dark">{fr ? "Sombre" : "Dark"}</option><option value="system">{fr ? "Système" : "System"}</option>
          </select>
        </label>
      </section>
      <section className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-2">
        <h4 className="flex items-center gap-2 font-semibold md:col-span-2"><Contact size={18} aria-hidden="true" />{fr ? "Coordonnées de l’école" : "School contact details"}</h4>
        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Adresse" : "Address line 1"}</span><input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Adresse" : "Address line 1"}
          value={form.addressLine1}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, addressLine1: e.target.value }))
          }
        /></label>

        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Complément d’adresse" : "Address line 2"}</span><input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Complément d’adresse" : "Address line 2"}
          value={form.addressLine2}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, addressLine2: e.target.value }))
          }
        /></label>

        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Ville" : "City"}</span><input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Ville" : "City"}
          value={form.city}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, city: e.target.value }))
          }
        /></label>

        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Téléphone" : "Phone"}</span><input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Téléphone" : "Phone"}
          value={form.phone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, phone: e.target.value }))
          }
        /></label>

        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Adresse électronique" : "Email"}</span><input type="email"
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Adresse électronique" : "Email"}
          value={form.email}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, email: e.target.value }))
          }
        /></label>

        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Site web" : "Website"}</span><input type="url"
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Site web" : "Website"}
          value={form.website}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, website: e.target.value }))
          }
        /></label>

        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Nom de la direction" : "Director name"}</span><input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm md:col-span-2"
          placeholder={fr ? "Nom de la direction" : "Director name"}
          value={form.directorName}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, directorName: e.target.value }))
          }
        /></label>
      </section>
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer font-semibold"><FileText size={18} aria-hidden="true" className="mr-2 inline-block" />{fr ? "Documents et bulletins" : "Documents and report cards"}</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Titre du bulletin — français" : "Report card title — French"}</span><input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Titre du bulletin — français" : "Report card title — French"}
          value={form.reportCardTitleFr}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              reportCardTitleFr: e.target.value,
            }))
          }
        /></label>

        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Titre du bulletin — anglais" : "Report card title — English"}</span><input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Titre du bulletin — anglais" : "Report card title — English"}
          value={form.reportCardTitleEn}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              reportCardTitleEn: e.target.value,
            }))
          }
        /></label>

        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Pied de page — français" : "Footer note — French"}</span><textarea
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Pied de page — français" : "Footer note — French"}
          value={form.reportCardFooterFr}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              reportCardFooterFr: e.target.value,
            }))
          }
        /></label>

        <label className="block text-sm"><span className="mb-2 block font-medium">{fr ? "Pied de page — anglais" : "Footer note — English"}</span><textarea
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder={fr ? "Pied de page — anglais" : "Footer note — English"}
          value={form.reportCardFooterEn}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              reportCardFooterEn: e.target.value,
            }))
          }
        /></label>
      </div>
      </details>
      </fieldset>

      <div className="mt-5">
        <button
          type="submit"
          disabled={saving || loading || !loaded || readingLogo}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          <Save size={17} aria-hidden="true" />
          {saving ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Enregistrer" : "Save branding")}
        </button>
      </div>
    </form>
  );
}
