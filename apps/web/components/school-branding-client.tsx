"use client";

import { useEffect, useState } from "react";

type Branding = {
  schoolId: string;
  name: string;
  code: string;
  logoUrl: string | null;
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

export function SchoolBrandingClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const [form, setForm] = useState({
    logoUrl: "",
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

  async function loadBranding() {
    setLoading(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branding.");
    } finally {
      setLoading(false);
    }
  }

  async function saveBranding() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branding.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadBranding();
  }, [schoolId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          School Branding
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Configure the school identity used on printed report cards.
        </p>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
          Loading branding...
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          placeholder="Logo URL"
          value={form.logoUrl}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, logoUrl: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Address line 1"
          value={form.addressLine1}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, addressLine1: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Address line 2"
          value={form.addressLine2}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, addressLine2: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="City"
          value={form.city}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, city: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, phone: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Email"
          value={form.email}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, email: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Website"
          value={form.website}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, website: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          placeholder="Director name"
          value={form.directorName}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, directorName: e.target.value }))
          }
        />

        <input
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
          disabled={saving}
          onClick={saveBranding}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Branding"}
        </button>
      </div>
    </div>
  );
}
