"use client";

import { useCallback, useEffect, useState } from "react";

type CompensationLine = {
  code: string;
  description: string;
  amount: string;
};

type CompensationVersion = {
  id: string;
  effectiveFrom: string;
  compensationType: string;
  baseAmount: number;
  currencyCode: string;
  payFrequency: string;
  standardAllowances: Array<{
    code: string;
    description: string;
    amount: number;
  }>;
  standardDeductions: Array<{
    code: string;
    description: string;
    amount: number;
  }>;
  changeReason: string;
  createdAt: string;
};

type PayrollCompensationEditorProps = {
  schoolId: string;
  profile: {
    id: string;
    fullName: string;
    baseSalary: number;
    currencyCode: string;
    payFrequency: string;
    effectiveFrom?: string | null;
  };
  onUpdated: () => void | Promise<void>;
};

const emptyLine = (): CompensationLine => ({
  code: "",
  description: "",
  amount: "",
});

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

async function json(response: Response) {
  return response.json().catch(() => null);
}

export function PayrollCompensationEditor({
  schoolId,
  profile,
  onUpdated,
}: PayrollCompensationEditorProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<CompensationVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [baseAmount, setBaseAmount] = useState(String(profile.baseSalary));
  const [currencyCode, setCurrencyCode] = useState(profile.currencyCode);
  const [payFrequency, setPayFrequency] = useState(profile.payFrequency || "MONTHLY");
  const [changeReason, setChangeReason] = useState("");
  const [allowances, setAllowances] = useState<CompensationLine[]>([]);
  const [deductions, setDeductions] = useState<CompensationLine[]>([]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ schoolId }).toString();
      const response = await fetch(
        `/api/finance/payroll/profiles/${encodeURIComponent(profile.id)}` +
          `/compensation-versions?${query}`,
        { cache: "no-store" },
      );
      const body = await json(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to load compensation history.");
      }
      setHistory(Array.isArray(body) ? body : []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load compensation history.",
      );
    } finally {
      setLoading(false);
    }
  }, [profile.id, schoolId]);

  useEffect(() => {
    if (open) void loadHistory();
  }, [loadHistory, open]);

  function updateLine(
    type: "allowance" | "deduction",
    index: number,
    field: keyof CompensationLine,
    value: string,
  ) {
    const setter = type === "allowance" ? setAllowances : setDeductions;
    setter((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  }

  function removeLine(type: "allowance" | "deduction", index: number) {
    const setter = type === "allowance" ? setAllowances : setDeductions;
    setter((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  function normalizeLines(lines: CompensationLine[], label: string) {
    const normalized = lines.map((line) => ({
      code: line.code.trim().toUpperCase(),
      description: line.description.trim(),
      amount: Number(line.amount),
    }));
    const codes = new Set<string>();
    for (const line of normalized) {
      if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(line.code)) {
        throw new Error(`${label} codes may contain letters, numbers, _ and -.`);
      }
      if (!line.description) throw new Error(`${label} descriptions are required.`);
      if (!Number.isFinite(line.amount) || line.amount <= 0) {
        throw new Error(`${label} amounts must be greater than zero.`);
      }
      if (codes.has(line.code)) throw new Error(`Duplicate ${label.toLowerCase()} code.`);
      codes.add(line.code);
    }
    return normalized;
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const amount = Number(baseAmount);
      if (!effectiveFrom) throw new Error("An effective date is required.");
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Base salary must be zero or greater.");
      }
      if (changeReason.trim().length < 3) {
        throw new Error("Enter a clear reason for this compensation change.");
      }
      const response = await fetch(
        `/api/finance/payroll/profiles/${encodeURIComponent(profile.id)}` +
          "/compensation-versions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            schoolId,
            effectiveFrom,
            compensationType: "SALARY",
            baseAmount: amount,
            currencyCode,
            payFrequency,
            standardAllowances: normalizeLines(allowances, "Allowance"),
            standardDeductions: normalizeLines(deductions, "Deduction"),
            changeReason: changeReason.trim(),
          }),
        },
      );
      const body = await json(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to save compensation change.");
      }
      setMessage("Compensation version scheduled and approved.");
      setChangeReason("");
      setAllowances([]);
      setDeductions([]);
      await Promise.all([loadHistory(), Promise.resolve(onUpdated())]);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save compensation change.",
      );
    } finally {
      setSaving(false);
    }
  }

  function linesEditor(
    title: string,
    type: "allowance" | "deduction",
    lines: CompensationLine[],
  ) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-900">{title}</div>
          <button
            type="button"
            onClick={() =>
              (type === "allowance" ? setAllowances : setDeductions)((current) => [
                ...current,
                emptyLine(),
              ])
            }
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
          >
            Add line
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {lines.map((line, index) => (
            <div key={`${type}-${index}`} className="grid gap-2 md:grid-cols-12">
              <input
                aria-label={`${title} code`}
                placeholder="Code"
                value={line.code}
                onChange={(event) => updateLine(type, index, "code", event.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs md:col-span-3"
              />
              <input
                aria-label={`${title} description`}
                placeholder="Description"
                value={line.description}
                onChange={(event) =>
                  updateLine(type, index, "description", event.target.value)
                }
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs md:col-span-5"
              />
              <input
                aria-label={`${title} amount`}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Amount"
                value={line.amount}
                onChange={(event) => updateLine(type, index, "amount", event.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs md:col-span-3"
              />
              <button
                type="button"
                onClick={() => removeLine(type, index)}
                className="rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-700 md:col-span-1"
              >
                ×
              </button>
            </div>
          ))}
          {!lines.length ? (
            <div className="text-xs text-slate-500">No standard lines.</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
      >
        {open ? "Close compensation history" : "Compensation history"}
      </button>
      {open ? (
        <div className="mt-4 space-y-4">
          {message ? (
            <div className="rounded-lg bg-green-50 p-2 text-xs text-green-700">{message}</div>
          ) : null}
          {error ? (
            <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>
          ) : null}
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Schedule approved salary terms
            </div>
            <p className="mt-1 text-xs text-slate-600">
              A new version never rewrites payroll runs that already exist.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-xs">
                <span className="font-medium">Effective from</span>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                />
              </label>
              <label className="text-xs">
                <span className="font-medium">Base salary per pay period</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseAmount}
                  onChange={(event) => setBaseAmount(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                />
              </label>
              <label className="text-xs">
                <span className="font-medium">Currency</span>
                <select
                  value={currencyCode}
                  onChange={(event) => setCurrencyCode(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  <option value="HTG">HTG</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="font-medium">Pay frequency</span>
                <select
                  value={payFrequency}
                  onChange={(event) => setPayFrequency(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="SEMI_MONTHLY">Semi-monthly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {linesEditor("Standard allowances", "allowance", allowances)}
              {linesEditor("Standard deductions", "deduction", deductions)}
            </div>
            <label className="mt-3 block text-xs">
              <span className="font-medium">Change reason</span>
              <textarea
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
                placeholder="Why are these terms changing?"
                className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Approve and schedule version"}
            </button>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Immutable history
            </div>
            {history.map((version) => (
              <div key={version.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatMoney(version.baseAmount, version.currencyCode)} ·{" "}
                      {version.payFrequency.replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Effective {version.effectiveFrom} · {version.compensationType}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {version.standardAllowances.length} allowance(s) ·{" "}
                    {version.standardDeductions.length} deduction(s)
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-600">{version.changeReason}</div>
              </div>
            ))}
            {!history.length && !loading ? (
              <div className="text-xs text-slate-500">No compensation history found.</div>
            ) : null}
            {loading ? <div className="text-xs text-slate-500">Loading history...</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
