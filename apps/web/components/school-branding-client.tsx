"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

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

      setMessage("School branding saved successfully.");
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
    <div className="rounded-2xl border border-border bg-surface text-foreground p-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
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
        <div className="mt-4 rounded-xl border border-success/40 bg-success-subtle p-3 text-sm text-success">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm md:col-span-2">
          {fr ? "Logo (PNG, JPG, WEBP · 256 Ko maximum)" : "Logo (PNG, JPG, WEBP · 256 KB maximum)"}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!loaded || saving} className="mt-2 block w-full" onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 256 * 1024) {
              setError("PNG, JPG ou WEBP uniquement, 256 KB maximum."); return;
            }
            try {
              const logoUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error("Lecture du logo impossible."));
                reader.readAsDataURL(file);
              });
              setForm(previous => ({ ...previous, logoUrl }));
              setError("");
            } catch { setError("Lecture du logo impossible."); }
          }} />
        </label>
        {form.logoUrl ? <div className="md:col-span-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.logoUrl} alt="Logo" className="h-20 max-w-48 object-contain" />
          <button type="button" onClick={() => setForm(previous => ({ ...previous, logoUrl: "" }))}>{fr ? "Retirer le logo" : "Remove logo"}</button>
        </div> : null}
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
        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm md:col-span-2"
          placeholder="Logo URL"
          value={form.logoUrl}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, logoUrl: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="Address line 1"
          value={form.addressLine1}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, addressLine1: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="Address line 2"
          value={form.addressLine2}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, addressLine2: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="City"
          value={form.city}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, city: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, phone: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="Email"
          value={form.email}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, email: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="Website"
          value={form.website}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, website: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm md:col-span-2"
          placeholder="Director name"
          value={form.directorName}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, directorName: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="Report card title FR"
          value={form.reportCardTitleFr}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              reportCardTitleFr: e.target.value,
            }))
          }
        />

        <input
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="Report card title EN"
          value={form.reportCardTitleEn}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              reportCardTitleEn: e.target.value,
            }))
          }
        />

        <textarea
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="Footer note FR"
          value={form.reportCardFooterFr}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              reportCardFooterFr: e.target.value,
            }))
          }
        />

        <textarea
          className="rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2 text-sm"
          placeholder="Footer note EN"
          value={form.reportCardFooterEn}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              reportCardFooterEn: e.target.value,
            }))
          }
        />
      </div>

      <div className="mt-5">
        <button
          type="button"
          disabled={saving || loading || !loaded}
          onClick={saveBranding}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Enregistrer" : "Save branding")}
        </button>
      </div>
    </div>
  );
}
