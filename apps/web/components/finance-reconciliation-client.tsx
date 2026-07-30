"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type BankAccount = {
  id: string;
  accountCode: string;
  displayName: string;
  currencyCode: string;
  institutionName: string | null;
  accountReferenceMasked: string | null;
  isActive: boolean;
};

type CashierSession = {
  id: string;
  cashierName: string;
  businessDate: string;
  currencyCode: string;
  expectedCollectionAmount: number;
};

type DepositSession = {
  cashierSessionId: string;
  cashierName: string;
  businessDate: string;
  expectedCollectionAmount: number;
  releasedAt: string | null;
};

type Deposit = {
  id: string;
  bankAccountName: string;
  bankAccountCode: string;
  currencyCode: string;
  depositDate: string;
  expectedAmount: number;
  depositedAmount: number;
  varianceAmount: number;
  depositReference: string;
  evidenceNote: string | null;
  status: "PENDING_REVIEW" | "RECONCILED" | "REJECTED";
  requestedByUserId: string;
  requesterName: string;
  requestedAt: string;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  sessions: DepositSession[];
};

type AccountingPeriod = {
  id: string;
  periodCode: string;
  displayName: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
  closeReason: string | null;
  reopenCount: number;
};

type Context = {
  bankAccounts: BankAccount[];
  availableCashierSessions: CashierSession[];
  deposits: Deposit[];
  periods: AccountingPeriod[];
  currentUserId: string;
  capabilities: {
    canManageReconciliation: boolean;
    canClosePeriods: boolean;
  };
};

const EMPTY_CONTEXT: Context = {
  bankAccounts: [],
  availableCashierSessions: [],
  deposits: [],
  periods: [],
  currentUserId: "",
  capabilities: {
    canManageReconciliation: false,
    canClosePeriods: false,
  },
};

function money(value: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("fr-HT", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currencyCode}`;
  }
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-HT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function apiMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const message = (body as { message?: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join(" ");
  return fallback;
}

function statusClass(status: string) {
  if (status === "RECONCILED" || status === "CLOSED") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (status === "REJECTED") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

export function FinanceReconciliationClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const [context, setContext] = useState<Context>(EMPTY_CONTEXT);
  const [tab, setTab] = useState<"deposits" | "periods" | "accounts">(
    "deposits",
  );
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountCurrency, setAccountCurrency] = useState("HTG");
  const [institutionName, setInstitutionName] = useState("");
  const [maskedReference, setMaskedReference] = useState("");

  const [bankAccountId, setBankAccountId] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [depositDate, setDepositDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [depositedAmount, setDepositedAmount] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const [periodCode, setPeriodCode] = useState("");
  const [periodName, setPeriodName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [periodReasons, setPeriodReasons] = useState<Record<string, string>>(
    {},
  );

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const search = new URLSearchParams({ schoolId });
      const response = await fetch(
        `/api/finance/reconciliation/context?${search.toString()}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiMessage(body, "Unable to load reconciliation."));
      }
      setContext(body as Context);
      const firstActive = (body as Context).bankAccounts.find(
        (account) => account.isActive,
      );
      setBankAccountId((current) => current || firstActive?.id || "");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load reconciliation.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const selectedAccount = context.bankAccounts.find(
    (account) => account.id === bankAccountId,
  );
  const compatibleSessions = context.availableCashierSessions.filter(
    (session) =>
      !selectedAccount || session.currencyCode === selectedAccount.currencyCode,
  );
  const expectedDeposit = useMemo(
    () =>
      compatibleSessions
        .filter((session) => selectedSessions.includes(session.id))
        .reduce((sum, session) => sum + session.expectedCollectionAmount, 0),
    [compatibleSessions, selectedSessions],
  );

  useEffect(() => {
    setSelectedSessions((current) =>
      current.filter((id) =>
        compatibleSessions.some((session) => session.id === id),
      ),
    );
  }, [bankAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  function beginAction(id: string) {
    setActingId(id);
    setError("");
    setMessage("");
  }

  async function mutate(
    path: string,
    input: {
      method?: "POST" | "PATCH";
      body: Record<string, unknown>;
      idempotencyKey?: string;
      success: string;
    },
  ) {
    const response = await fetch(path, {
      method: input.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : {}),
      },
      body: JSON.stringify(input.body),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(apiMessage(body, "The finance action failed."));
    }
    setMessage(input.success);
    await loadContext();
    return body;
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    beginAction("new-account");
    try {
      await mutate("/api/finance/reconciliation/bank-accounts", {
        body: {
          schoolId,
          accountCode,
          displayName: accountName,
          currencyCode: accountCurrency,
          institutionName: institutionName.trim() || undefined,
          accountReferenceMasked: maskedReference.trim() || undefined,
        },
        success: "Bank destination created.",
      });
      setAccountCode("");
      setAccountName("");
      setInstitutionName("");
      setMaskedReference("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setActingId("");
    }
  }

  async function updateAccountStatus(account: BankAccount) {
    beginAction(account.id);
    try {
      await mutate(
        `/api/finance/reconciliation/bank-accounts/${account.id}/status`,
        {
          method: "PATCH",
          body: { schoolId, isActive: !account.isActive },
          success: account.isActive
            ? "Bank destination archived."
            : "Bank destination reactivated.",
        },
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setActingId("");
    }
  }

  async function submitDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    beginAction("new-deposit");
    try {
      await mutate("/api/finance/reconciliation/deposits", {
        body: {
          schoolId,
          bankAccountId,
          cashierSessionIds: selectedSessions,
          depositDate,
          depositedAmount: Number(depositedAmount),
          depositReference,
          evidenceNote: evidenceNote.trim() || undefined,
        },
        idempotencyKey: `deposit-${crypto.randomUUID()}`,
        success: "Deposit submitted for independent review.",
      });
      setSelectedSessions([]);
      setDepositedAmount("");
      setDepositReference("");
      setEvidenceNote("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setActingId("");
    }
  }

  async function reviewDeposit(
    deposit: Deposit,
    action: "reconcile" | "reject",
  ) {
    const reviewNote = reviewNotes[deposit.id]?.trim() || "";
    if (reviewNote.length < 10) {
      setError("Enter a review note of at least 10 characters.");
      return;
    }
    beginAction(deposit.id);
    try {
      await mutate(
        `/api/finance/reconciliation/deposits/${deposit.id}/${action}`,
        {
          body: { schoolId, reviewNote },
          success:
            action === "reconcile"
              ? "Deposit reconciled."
              : "Deposit rejected; cashier sessions were released.",
        },
      );
      setReviewNotes((current) => ({ ...current, [deposit.id]: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setActingId("");
    }
  }

  async function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    beginAction("new-period");
    try {
      await mutate("/api/finance/reconciliation/periods", {
        body: {
          schoolId,
          periodCode,
          displayName: periodName,
          startDate: periodStart,
          endDate: periodEnd,
        },
        success: "Financial period created.",
      });
      setPeriodCode("");
      setPeriodName("");
      setPeriodStart("");
      setPeriodEnd("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setActingId("");
    }
  }

  async function changePeriod(
    period: AccountingPeriod,
    action: "close" | "reopen",
  ) {
    const reason = periodReasons[period.id]?.trim() || "";
    if (reason.length < 10) {
      setError("Enter an operational reason of at least 10 characters.");
      return;
    }
    beginAction(period.id);
    try {
      await mutate(
        `/api/finance/reconciliation/periods/${period.id}/${action}`,
        {
          body: { schoolId, reason },
          success:
            action === "close"
              ? "Financial period closed. Ledger writes are now blocked."
              : "Financial period reopened with an audit trail.",
        },
      );
      setPeriodReasons((current) => ({ ...current, [period.id]: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setActingId("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Cash awaiting deposit</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {context.availableCashierSessions.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Closed cashier sessions with net cash collections
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Awaiting review</div>
          <div className="mt-2 text-2xl font-semibold text-amber-700">
            {
              context.deposits.filter(
                (deposit) => deposit.status === "PENDING_REVIEW",
              ).length
            }
          </div>
          <div className="mt-1 text-xs text-slate-500">
            The submitter cannot perform the review
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Closed periods</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-700">
            {
              context.periods.filter((period) => period.status === "CLOSED")
                .length
            }
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Protected from invoice, payment, and correction writes
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-2">
          {(
            [
              ["deposits", "Deposits"],
              ["periods", "Period close"],
              ["accounts", "Bank destinations"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                tab === value
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void loadContext()}
            className="ml-auto rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            Refresh
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-sm text-slate-500">Loading controls…</div>
          ) : null}

          {tab === "deposits" ? (
            <div className="space-y-6">
              {context.capabilities.canManageReconciliation ? (
                <form
                  onSubmit={submitDeposit}
                  className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5"
                >
                  <h2 className="text-lg font-semibold text-slate-950">
                    Submit a cash deposit
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Select closed cashier sessions. Opening floats are excluded;
                    the expected amount is calculated from confirmed cash
                    payments less completed cash refunds.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Bank destination
                      <select
                        required
                        value={bankAccountId}
                        onChange={(event) =>
                          setBankAccountId(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      >
                        <option value="">Select an account</option>
                        {context.bankAccounts
                          .filter((account) => account.isActive)
                          .map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.displayName} · {account.currencyCode}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Deposit date
                      <input
                        required
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        value={depositDate}
                        onChange={(event) => setDepositDate(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                  </div>
                  <fieldset className="mt-4">
                    <legend className="text-sm font-medium text-slate-700">
                      Cashier sessions
                    </legend>
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      {compatibleSessions.map((session) => (
                        <label
                          key={session.id}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSessions.includes(session.id)}
                            onChange={(event) =>
                              setSelectedSessions((current) =>
                                event.target.checked
                                  ? [...current, session.id]
                                  : current.filter((id) => id !== session.id),
                              )
                            }
                            className="mt-1"
                          />
                          <span>
                            <span className="font-medium text-slate-950">
                              {session.cashierName} · {session.businessDate}
                            </span>
                            <span className="mt-1 block text-slate-600">
                              {money(
                                session.expectedCollectionAmount,
                                session.currencyCode,
                              )}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {!compatibleSessions.length ? (
                      <div className="mt-2 text-sm text-slate-500">
                        No eligible closed cashier sessions for this currency.
                      </div>
                    ) : null}
                  </fieldset>
                  <div className="mt-4 rounded-xl bg-white p-3 text-sm">
                    Expected from ledger:{" "}
                    <strong>
                      {money(
                        expectedDeposit,
                        selectedAccount?.currencyCode ?? "HTG",
                      )}
                    </strong>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Amount deposited
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={depositedAmount}
                        onChange={(event) =>
                          setDepositedAmount(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Deposit reference
                      <input
                        required
                        minLength={3}
                        maxLength={200}
                        value={depositReference}
                        onChange={(event) =>
                          setDepositReference(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                  </div>
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Evidence note
                    <textarea
                      value={evidenceNote}
                      onChange={(event) => setEvidenceNote(event.target.value)}
                      className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      actingId === "new-deposit" ||
                      !bankAccountId ||
                      !selectedSessions.length
                    }
                    className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Submit for review
                  </button>
                </form>
              ) : null}

              <div className="space-y-3">
                {context.deposits.map((deposit) => (
                  <article
                    key={deposit.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">
                          {deposit.depositReference}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {deposit.bankAccountName} · {deposit.depositDate}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          deposit.status,
                        )}`}
                      >
                        {deposit.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3 text-sm">
                        <div className="text-slate-500">Expected</div>
                        <div className="mt-1 font-semibold">
                          {money(deposit.expectedAmount, deposit.currencyCode)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-sm">
                        <div className="text-slate-500">Deposited</div>
                        <div className="mt-1 font-semibold">
                          {money(deposit.depositedAmount, deposit.currencyCode)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-sm">
                        <div className="text-slate-500">Variance</div>
                        <div
                          className={`mt-1 font-semibold ${
                            deposit.varianceAmount === 0
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {money(deposit.varianceAmount, deposit.currencyCode)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Submitted by {deposit.requesterName} ·{" "}
                      {dateTime(deposit.requestedAt)} ·{" "}
                      {deposit.sessions.length} cashier session(s)
                    </div>
                    {deposit.reviewNote ? (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                        {deposit.reviewNote}
                      </div>
                    ) : null}
                    {deposit.status === "PENDING_REVIEW" &&
                    context.capabilities.canManageReconciliation ? (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        {deposit.requestedByUserId === context.currentUserId ? (
                          <div className="text-sm font-medium text-amber-700">
                            Independent review required from another authorized
                            user.
                          </div>
                        ) : (
                          <>
                            <label className="block text-sm font-medium text-slate-700">
                              Independent review note
                              <textarea
                                value={reviewNotes[deposit.id] ?? ""}
                                onChange={(event) =>
                                  setReviewNotes((current) => ({
                                    ...current,
                                    [deposit.id]: event.target.value,
                                  }))
                                }
                                className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2"
                              />
                            </label>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                disabled={actingId === deposit.id}
                                onClick={() =>
                                  void reviewDeposit(deposit, "reconcile")
                                }
                                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                Reconcile
                              </button>
                              <button
                                type="button"
                                disabled={actingId === deposit.id}
                                onClick={() =>
                                  void reviewDeposit(deposit, "reject")
                                }
                                className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                              >
                                Reject and release
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </article>
                ))}
                {!context.deposits.length && !loading ? (
                  <div className="text-sm text-slate-500">
                    No deposit records yet.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "periods" ? (
            <div className="space-y-6">
              {context.capabilities.canClosePeriods ? (
                <form
                  onSubmit={createPeriod}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <h2 className="text-lg font-semibold text-slate-950">
                    Create accounting period
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Periods cannot overlap. Closing checks cashier sessions,
                    deposits, corrections, and credit notes before locking the
                    ledger dates.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-sm font-medium text-slate-700">
                      Period code
                      <input
                        required
                        value={periodCode}
                        onChange={(event) => setPeriodCode(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Display name
                      <input
                        required
                        value={periodName}
                        onChange={(event) => setPeriodName(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Start date
                      <input
                        required
                        type="date"
                        value={periodStart}
                        onChange={(event) => setPeriodStart(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      End date
                      <input
                        required
                        type="date"
                        min={periodStart || undefined}
                        value={periodEnd}
                        onChange={(event) => setPeriodEnd(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={actingId === "new-period"}
                    className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Create open period
                  </button>
                </form>
              ) : null}

              <div className="space-y-3">
                {context.periods.map((period) => (
                  <article
                    key={period.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">
                          {period.displayName} · {period.periodCode}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {period.startDate} to {period.endDate}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          period.status,
                        )}`}
                      >
                        {period.status}
                      </span>
                    </div>
                    {period.status === "CLOSED" ? (
                      <div className="mt-3 text-xs text-slate-500">
                        Closed {dateTime(period.closedAt)} · Reopened{" "}
                        {period.reopenCount} time(s)
                      </div>
                    ) : null}
                    {context.capabilities.canClosePeriods ? (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <label className="block text-sm font-medium text-slate-700">
                          {period.status === "OPEN"
                            ? "Close reason"
                            : "Reopen reason"}
                          <input
                            value={periodReasons[period.id] ?? ""}
                            onChange={(event) =>
                              setPeriodReasons((current) => ({
                                ...current,
                                [period.id]: event.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={actingId === period.id}
                          onClick={() =>
                            void changePeriod(
                              period,
                              period.status === "OPEN" ? "close" : "reopen",
                            )
                          }
                          className={`mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                            period.status === "OPEN"
                              ? "bg-slate-950"
                              : "bg-amber-700"
                          }`}
                        >
                          {period.status === "OPEN"
                            ? "Run controls and close"
                            : "Reopen with audit trail"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {!context.periods.length && !loading ? (
                  <div className="text-sm text-slate-500">
                    No accounting periods configured.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "accounts" ? (
            <div className="space-y-6">
              {context.capabilities.canManageReconciliation ? (
                <form
                  onSubmit={createAccount}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <h2 className="text-lg font-semibold text-slate-950">
                    Add bank destination
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Store only a masked account reference. Never enter a full
                    bank account number or credential.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="text-sm font-medium text-slate-700">
                      Account code
                      <input
                        required
                        value={accountCode}
                        onChange={(event) => setAccountCode(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Display name
                      <input
                        required
                        value={accountName}
                        onChange={(event) => setAccountName(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Currency
                      <select
                        value={accountCurrency}
                        onChange={(event) =>
                          setAccountCurrency(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      >
                        <option value="HTG">HTG</option>
                        <option value="USD">USD</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Institution
                      <input
                        value={institutionName}
                        onChange={(event) =>
                          setInstitutionName(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Masked reference
                      <input
                        placeholder="****4821"
                        value={maskedReference}
                        onChange={(event) =>
                          setMaskedReference(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={actingId === "new-account"}
                    className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Add destination
                  </button>
                </form>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                {context.bankAccounts.map((account) => (
                  <article
                    key={account.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="font-semibold text-slate-950">
                      {account.displayName}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {account.accountCode} · {account.currencyCode}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {[account.institutionName, account.accountReferenceMasked]
                        .filter(Boolean)
                        .join(" · ") || "No account details stored"}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          account.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {account.isActive ? "ACTIVE" : "ARCHIVED"}
                      </span>
                      {context.capabilities.canManageReconciliation ? (
                        <button
                          type="button"
                          disabled={actingId === account.id}
                          onClick={() => void updateAccountStatus(account)}
                          className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium"
                        >
                          {account.isActive ? "Archive" : "Reactivate"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
                {!context.bankAccounts.length && !loading ? (
                  <div className="text-sm text-slate-500">
                    No bank destinations configured.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
