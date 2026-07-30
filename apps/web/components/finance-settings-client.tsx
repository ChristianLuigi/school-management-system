"use client";

import { useEffect, useState } from "react";

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CHECK",
  "MOBILE_MONEY",
  "CARD",
  "OTHER",
];

type FinanceSettings = {
  schoolId: string;
  defaultCurrencyCode: string;
  defaultInvoiceDueDays: number;
  enabledPaymentMethods: string[];
  financeContactName: string | null;
  financeContactEmail: string | null;
  financeContactPhone: string | null;
  invoiceFooterI18n: Record<string, string>;
  receiptFooterI18n: Record<string, string>;
  defaultReceiptPrintFormat: "A4" | "THERMAL_80MM";
  defaultInvoicePrintFormat: "A4" | "THERMAL_80MM";
  autoOpenReceiptAfterPayment: boolean;
  canManage: boolean;
};

export function FinanceSettingsClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    defaultCurrencyCode: "USD",
    defaultInvoiceDueDays: "30",
    enabledPaymentMethods: PAYMENT_METHODS,
    financeContactName: "",
    financeContactEmail: "",
    financeContactPhone: "",
    invoiceFooterFr: "",
    invoiceFooterEn: "",
    receiptFooterFr: "",
    receiptFooterEn: "",
    defaultReceiptPrintFormat: "THERMAL_80MM" as "A4" | "THERMAL_80MM",
    defaultInvoicePrintFormat: "A4" as "A4" | "THERMAL_80MM",
    autoOpenReceiptAfterPayment: false,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState<boolean | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/finance/settings?schoolId=${schoolId}`, {
        cache: "no-store",
      });

      const body: FinanceSettings | { message?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error("message" in body ? body.message : "Failed to load finance settings.");
      }

      const settings = body as FinanceSettings;
      setCanManage(settings.canManage);

      setForm({
        defaultCurrencyCode: settings.defaultCurrencyCode ?? "USD",
        defaultInvoiceDueDays: String(settings.defaultInvoiceDueDays ?? 30),
        enabledPaymentMethods: settings.enabledPaymentMethods ?? PAYMENT_METHODS,
        financeContactName: settings.financeContactName ?? "",
        financeContactEmail: settings.financeContactEmail ?? "",
        financeContactPhone: settings.financeContactPhone ?? "",
        invoiceFooterFr: settings.invoiceFooterI18n?.fr ?? "",
        invoiceFooterEn: settings.invoiceFooterI18n?.en ?? "",
        receiptFooterFr: settings.receiptFooterI18n?.fr ?? "",
        receiptFooterEn: settings.receiptFooterI18n?.en ?? "",
        defaultReceiptPrintFormat:
          settings.defaultReceiptPrintFormat ?? "THERMAL_80MM",
        defaultInvoicePrintFormat:
          settings.defaultInvoicePrintFormat ?? "A4",
        autoOpenReceiptAfterPayment:
          settings.autoOpenReceiptAfterPayment ?? false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load finance settings.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const dueDays = Number(form.defaultInvoiceDueDays);

      if (!Number.isFinite(dueDays) || dueDays < 0) {
        throw new Error("Default invoice due days must be a valid number.");
      }

      const res = await fetch("/api/finance/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          defaultCurrencyCode: form.defaultCurrencyCode,
          defaultInvoiceDueDays: dueDays,
          enabledPaymentMethods: form.enabledPaymentMethods,
          financeContactName: form.financeContactName,
          financeContactEmail: form.financeContactEmail,
          financeContactPhone: form.financeContactPhone,
          invoiceFooterI18n: {
            fr: form.invoiceFooterFr,
            en: form.invoiceFooterEn,
          },
          receiptFooterI18n: {
            fr: form.receiptFooterFr,
            en: form.receiptFooterEn,
          },
          defaultReceiptPrintFormat: form.defaultReceiptPrintFormat,
          defaultInvoicePrintFormat: form.defaultInvoicePrintFormat,
          autoOpenReceiptAfterPayment: form.autoOpenReceiptAfterPayment,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to save finance settings.");
      }

      setMessage("Finance settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save finance settings.");
    } finally {
      setSaving(false);
    }
  }

  function togglePaymentMethod(method: string) {
    setForm((prev) => {
      const exists = prev.enabledPaymentMethods.includes(method);
      if (exists && prev.enabledPaymentMethods.length === 1) {
        setError("At least one payment method must remain enabled.");
        return prev;
      }
      setError("");

      return {
        ...prev,
        enabledPaymentMethods: exists
          ? prev.enabledPaymentMethods.filter((item) => item !== method)
          : [...prev.enabledPaymentMethods, method],
      };
    });
  }

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  if (canManage === false && !loading) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Finance Settings
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Configure invoice defaults, payment methods, and finance document notes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          {open ? "Close" : "Settings"}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
          Loading settings...
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

      {open ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <select
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={form.defaultCurrencyCode}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  defaultCurrencyCode: e.target.value,
                }))
              }
            >
              <option value="USD">USD</option>
              <option value="HTG">HTG</option>
            </select>

            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Default invoice due days"
              value={form.defaultInvoiceDueDays}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  defaultInvoiceDueDays: e.target.value,
                }))
              }
            />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <div className="font-semibold text-slate-900">Print Preferences</div>
              <p className="mt-1 text-sm text-slate-600">
                Configure the preferred print formats for cashier and finance workflows.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Default receipt print
                  </span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={form.defaultReceiptPrintFormat}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        defaultReceiptPrintFormat: event.target.value as
                          | "A4"
                          | "THERMAL_80MM",
                      }))
                    }
                  >
                    <option value="THERMAL_80MM">Thermal 80mm</option>
                    <option value="A4">A4 / PDF</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Default invoice print
                  </span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={form.defaultInvoicePrintFormat}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        defaultInvoicePrintFormat: event.target.value as
                          | "A4"
                          | "THERMAL_80MM",
                      }))
                    }
                  >
                    <option value="A4">A4 / PDF</option>
                    <option value="THERMAL_80MM">Thermal 80mm</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.autoOpenReceiptAfterPayment}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      autoOpenReceiptAfterPayment: event.target.checked,
                    }))
                  }
                />
                Automatically open receipt print view after payment
              </label>
            </div>
            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Finance contact name"
              value={form.financeContactName}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  financeContactName: e.target.value,
                }))
              }
            />

            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Finance contact phone"
              value={form.financeContactPhone}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  financeContactPhone: e.target.value,
                }))
              }
            />

            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Finance contact email"
              value={form.financeContactEmail}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  financeContactEmail: e.target.value,
                }))
              }
            />

            <textarea
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Invoice footer FR"
              value={form.invoiceFooterFr}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  invoiceFooterFr: e.target.value,
                }))
              }
            />

            <textarea
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Invoice footer EN"
              value={form.invoiceFooterEn}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  invoiceFooterEn: e.target.value,
                }))
              }
            />

            <textarea
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Receipt footer FR"
              value={form.receiptFooterFr}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  receiptFooterFr: e.target.value,
                }))
              }
            />

            <textarea
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Receipt footer EN"
              value={form.receiptFooterEn}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  receiptFooterEn: e.target.value,
                }))
              }
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-900">
              Enabled Payment Methods
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method}
                  className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.enabledPaymentMethods.includes(method)}
                    onChange={() => togglePaymentMethod(method)}
                  />
                  {method}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={saveSettings}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Finance Settings"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
