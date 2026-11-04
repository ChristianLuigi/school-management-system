"use client";

import { PaginatedCollection } from "@/components/paginated-collection";
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
    return "bg-success-subtle text-success";
  }
  if (status === "REJECTED") return "bg-danger-subtle text-danger";
  return "bg-warning-subtle text-warning";
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
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-sm text-muted-foreground">Cash awaiting deposit</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {context.availableCashierSessions.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Closed cashier sessions with net cash collections
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-sm text-muted-foreground">Awaiting review</div>
          <div className="mt-2 text-2xl font-semibold text-warning">
            {
              context.deposits.filter(
                (deposit) => deposit.status === "PENDING_REVIEW",
              ).length
            }
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            The submitter cannot perform the review
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-sm text-muted-foreground">Closed periods</div>
          <div className="mt-2 text-2xl font-semibold text-success">
            {
              context.periods.filter((period) => period.status === "CLOSED")
                .length
            }
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Protected from invoice, payment, and correction writes
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-success/40 bg-success-subtle p-3 text-sm text-success">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap gap-2 border-b border-border p-2">
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
                  ? "bg-primary text-solid-foreground"
                  : "text-muted-foreground hover:bg-surface"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void loadContext()}
            className="ml-auto rounded-xl border border-input px-3 py-2 text-sm"
          >
            Refresh
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading controls…</div>
          ) : null}

          {tab === "deposits" ? (
            <div className="space-y-6">
              {context.capabilities.canManageReconciliation ? (
                <form
                  onSubmit={submitDeposit}
                  className="rounded-2xl border border-info/40 bg-info-subtle/40 p-5"
                >
                  <h2 className="text-lg font-semibold text-foreground">
                    Submit a cash deposit
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select closed cashier sessions. Opening floats are excluded;
                    the expected amount is calculated from confirmed cash
                    payments less completed cash refunds.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-foreground">
                      Bank destination
                      <select
                        required
                        value={bankAccountId}
                        onChange={(event) =>
                          setBankAccountId(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
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
                    <label className="text-sm font-medium text-foreground">
                      Deposit date
                      <input
                        required
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        value={depositDate}
                        onChange={(event) => setDepositDate(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                  </div>
                  <fieldset className="mt-4">
                    <legend className="text-sm font-medium text-foreground">
                      Cashier sessions
                    </legend>
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      {compatibleSessions.map((session) => (
                        <label
                          key={session.id}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3 text-sm"
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
                            <span className="font-medium text-foreground">
                              {session.cashierName} · {session.businessDate}
                            </span>
                            <span className="mt-1 block text-muted-foreground">
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
                      <div className="mt-2 text-sm text-muted-foreground">
                        No eligible closed cashier sessions for this currency.
                      </div>
                    ) : null}
                  </fieldset>
                  <div className="mt-4 rounded-xl bg-surface p-3 text-sm">
                    Expected from ledger:{" "}
                    <strong>
                      {money(
                        expectedDeposit,
                        selectedAccount?.currencyCode ?? "HTG",
                      )}
                    </strong>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-foreground">
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
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-foreground">
                      Deposit reference
                      <input
                        required
                        minLength={3}
                        maxLength={200}
                        value={depositReference}
                        onChange={(event) =>
                          setDepositReference(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                  </div>
                  <label className="mt-4 block text-sm font-medium text-foreground">
                    Evidence note
                    <textarea
                      value={evidenceNote}
                      onChange={(event) => setEvidenceNote(event.target.value)}
                      className="mt-1 min-h-20 w-full rounded-xl border border-input bg-surface px-3 py-2"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      actingId === "new-deposit" ||
                      !bankAccountId ||
                      !selectedSessions.length
                    }
                    className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Submit for review
                  </button>
                </form>
              ) : null}

              <div className="space-y-3">
                {<PaginatedCollection items={context.deposits}>{(deposit) => (
                  <article
                    key={deposit.id}
                    className="rounded-2xl border border-border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          {deposit.depositReference}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
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
                      <div className="rounded-xl bg-surface p-3 text-sm">
                        <div className="text-muted-foreground">Expected</div>
                        <div className="mt-1 font-semibold">
                          {money(deposit.expectedAmount, deposit.currencyCode)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-surface p-3 text-sm">
                        <div className="text-muted-foreground">Deposited</div>
                        <div className="mt-1 font-semibold">
                          {money(deposit.depositedAmount, deposit.currencyCode)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-surface p-3 text-sm">
                        <div className="text-muted-foreground">Variance</div>
                        <div
                          className={`mt-1 font-semibold ${
                            deposit.varianceAmount === 0
                              ? "text-success"
                              : "text-danger"
                          }`}
                        >
                          {money(deposit.varianceAmount, deposit.currencyCode)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Submitted by {deposit.requesterName} ·{" "}
                      {dateTime(deposit.requestedAt)} ·{" "}
                      {deposit.sessions.length} cashier session(s)
                    </div>
                    {deposit.reviewNote ? (
                      <div className="mt-3 rounded-xl bg-surface p-3 text-sm text-foreground">
                        {deposit.reviewNote}
                      </div>
                    ) : null}
                    {deposit.status === "PENDING_REVIEW" &&
                    context.capabilities.canManageReconciliation ? (
                      <div className="mt-4 border-t border-border pt-4">
                        {deposit.requestedByUserId === context.currentUserId ? (
                          <div className="text-sm font-medium text-warning">
                            Independent review required from another authorized
                            user.
                          </div>
                        ) : (
                          <>
                            <label className="block text-sm font-medium text-foreground">
                              Independent review note
                              <textarea
                                value={reviewNotes[deposit.id] ?? ""}
                                onChange={(event) =>
                                  setReviewNotes((current) => ({
                                    ...current,
                                    [deposit.id]: event.target.value,
                                  }))
                                }
                                className="mt-1 min-h-20 w-full rounded-xl border border-input px-3 py-2"
                              />
                            </label>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                disabled={actingId === deposit.id}
                                onClick={() =>
                                  void reviewDeposit(deposit, "reconcile")
                                }
                                className="rounded-xl bg-success px-4 py-2 text-sm font-semibold text-success-foreground disabled:opacity-50"
                              >
                                Reconcile
                              </button>
                              <button
                                type="button"
                                disabled={actingId === deposit.id}
                                onClick={() =>
                                  void reviewDeposit(deposit, "reject")
                                }
                                className="rounded-xl border border-danger/40 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-50"
                              >
                                Reject and release
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </article>
                )}</PaginatedCollection>}
                {!context.deposits.length && !loading ? (
                  <div className="text-sm text-muted-foreground">
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
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <h2 className="text-lg font-semibold text-foreground">
                    Create accounting period
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Periods cannot overlap. Closing checks cashier sessions,
                    deposits, corrections, and credit notes before locking the
                    ledger dates.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-sm font-medium text-foreground">
                      Period code
                      <input
                        required
                        value={periodCode}
                        onChange={(event) => setPeriodCode(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-foreground">
                      Display name
                      <input
                        required
                        value={periodName}
                        onChange={(event) => setPeriodName(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-foreground">
                      Start date
                      <input
                        required
                        type="date"
                        value={periodStart}
                        onChange={(event) => setPeriodStart(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-foreground">
                      End date
                      <input
                        required
                        type="date"
                        min={periodStart || undefined}
                        value={periodEnd}
                        onChange={(event) => setPeriodEnd(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={actingId === "new-period"}
                    className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Create open period
                  </button>
                </form>
              ) : null}

              <div className="space-y-3">
                {<PaginatedCollection items={context.periods}>{(period) => (
                  <article
                    key={period.id}
                    className="rounded-2xl border border-border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          {period.displayName} · {period.periodCode}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
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
                      <div className="mt-3 text-xs text-muted-foreground">
                        Closed {dateTime(period.closedAt)} · Reopened{" "}
                        {period.reopenCount} time(s)
                      </div>
                    ) : null}
                    {context.capabilities.canClosePeriods ? (
                      <div className="mt-4 border-t border-border pt-4">
                        <label className="block text-sm font-medium text-foreground">
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
                            className="mt-1 w-full rounded-xl border border-input px-3 py-2"
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
                          className={`mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-solid-foreground disabled:opacity-50 ${
                            period.status === "OPEN"
                              ? "bg-primary"
                              : "bg-warning"
                          }`}
                        >
                          {period.status === "OPEN"
                            ? "Run controls and close"
                            : "Reopen with audit trail"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                )}</PaginatedCollection>}
                {!context.periods.length && !loading ? (
                  <div className="text-sm text-muted-foreground">
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
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <h2 className="text-lg font-semibold text-foreground">
                    Add bank destination
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Store only a masked account reference. Never enter a full
                    bank account number or credential.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="text-sm font-medium text-foreground">
                      Account code
                      <input
                        required
                        value={accountCode}
                        onChange={(event) => setAccountCode(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-foreground">
                      Display name
                      <input
                        required
                        value={accountName}
                        onChange={(event) => setAccountName(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-foreground">
                      Currency
                      <select
                        value={accountCurrency}
                        onChange={(event) =>
                          setAccountCurrency(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      >
                        <option value="HTG">HTG</option>
                        <option value="USD">USD</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-foreground">
                      Institution
                      <input
                        value={institutionName}
                        onChange={(event) =>
                          setInstitutionName(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-medium text-foreground">
                      Masked reference
                      <input
                        placeholder="****4821"
                        value={maskedReference}
                        onChange={(event) =>
                          setMaskedReference(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-input bg-surface px-3 py-2"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={actingId === "new-account"}
                    className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Add destination
                  </button>
                </form>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                {<PaginatedCollection items={context.bankAccounts}>{(account) => (
                  <article
                    key={account.id}
                    className="rounded-2xl border border-border p-4"
                  >
                    <div className="font-semibold text-foreground">
                      {account.displayName}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {account.accountCode} · {account.currencyCode}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {[account.institutionName, account.accountReferenceMasked]
                        .filter(Boolean)
                        .join(" · ") || "No account details stored"}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          account.isActive
                            ? "bg-success-subtle text-success"
                            : "bg-surface-muted text-muted-foreground"
                        }`}
                      >
                        {account.isActive ? "ACTIVE" : "ARCHIVED"}
                      </span>
                      {context.capabilities.canManageReconciliation ? (
                        <button
                          type="button"
                          disabled={actingId === account.id}
                          onClick={() => void updateAccountStatus(account)}
                          className="rounded-xl border border-input px-3 py-1.5 text-xs font-medium"
                        >
                          {account.isActive ? "Archive" : "Reactivate"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                )}</PaginatedCollection>}
                {!context.bankAccounts.length && !loading ? (
                  <div className="text-sm text-muted-foreground">
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
