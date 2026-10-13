"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SchoolBadge, schoolActionClass } from "@/components/school-ui";
import {
  Search,
  CheckCircle2,
  CreditCard,
  Printer,
  ArrowRight,
} from "lucide-react";
import { validatePaymentReview } from "@/lib/payment-review";
import { cashierCopy } from "@/lib/cashier-copy";
import { useI18n } from "@/components/i18n-provider";

type StudentSearchResult = {
  id: string;
  studentCode: string | null;
  firstName: string | null;
  lastName: string | null;
  gradeLevelCode: string | null;
  sectionCode: string | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  invoiceStatus: string;
  issueDate: string | null;
  dueDate: string | null;
  currencyCode: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
};

type StudentSummary = {
  student: {
    id: string;
    studentCode: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  invoices: Invoice[];
};

type CollectionMethod = {
  paymentMethod: string;
  paymentCount: number;
  collectionAmount: number;
  refundCount: number;
  refundAmount: number;
  totalAmount: number;
};

type CashierSession = {
  id: string;
  cashierUserId: string;
  businessDate: string;
  currencyCode: string;
  status: "OPEN" | "CLOSED";
  openingCashAmount: number;
  expectedCashAmount: number;
  closingCashAmount: number | null;
  varianceAmount: number | null;
  openedAt: string;
  closedAt: string | null;
  reopenedCount: number;
  cashier: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  collectionsByMethod: CollectionMethod[];
  collectionCount: number;
  refundCount: number;
  grossCollectionTotal: number;
  refundTotal: number;
  collectionTotal: number;
};

type SessionEnvelope = {
  businessDate: string;
  canSupervise: boolean;
  session: CashierSession | null;
};

type PaymentSuccess = {
  paymentId: string;
  paymentNumber: string;
  receiptNumber: string;
  currencyCode: string;
  amount: number;
  invoice: {
    balanceDue: number;
    invoiceStatus: string;
  };
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CHECK: "Check",
  MOBILE_MONEY: "Mobile money",
  CARD: "Card",
  OTHER: "Other",
};

function studentName(student: {
  firstName: string | null;
  lastName: string | null;
}) {
  return (
    [student.firstName, student.lastName].filter(Boolean).join(" ") ||
    "Unnamed student"
  );
}

function money(
  value: number,
  currencyCode: string,
  locale: "fr" | "en" = "en",
) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-HT" : "en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function invoiceCanReceivePayment(invoice: Invoice) {
  return (
    invoice.balanceDue > 0 &&
    ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.invoiceStatus)
  );
}

export function FinanceCashierClient({
  schoolId,
  initialStudentId,
  initialInvoiceId,
}: {
  schoolId: string;
  initialStudentId?: string;
  initialInvoiceId?: string;
}) {
  const { locale } = useI18n();
  const copy = cashierCopy[locale];
  const PAYMENT_METHOD_LABELS = copy.methods;
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<string[]>([
    "CASH",
  ]);
  const [sessionEnvelope, setSessionEnvelope] =
    useState<SessionEnvelope | null>(null);
  const [dailySessions, setDailySessions] = useState<CashierSession[]>([]);
  const [openingCashAmount, setOpeningCashAmount] = useState("0");
  const [closingCashAmount, setClosingCashAmount] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [success, setSuccess] = useState<PaymentSuccess | null>(null);
  const [reopenSessionId, setReopenSessionId] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef("");
  const idempotencyPayloadRef = useRef("");
  const paymentPendingRef = useRef(false);
  const studentRequestRef = useRef<AbortController | null>(null);
  const sessionRequestRef = useRef<AbortController | null>(null);
  const [sessionReadyCurrency, setSessionReadyCurrency] = useState("");
  const [paymentUncertain, setPaymentUncertain] = useState(false);

  const selectedInvoice = useMemo(
    () =>
      summary?.invoices.find((invoice) => invoice.id === selectedInvoiceId) ??
      null,
    [selectedInvoiceId, summary],
  );
  const openSession =
    sessionEnvelope?.session?.status === "OPEN" &&
    sessionEnvelope.session.currencyCode === selectedInvoice?.currencyCode &&
    sessionReadyCurrency === selectedInvoice?.currencyCode
      ? sessionEnvelope.session
      : null;
  const numericAmount = Number(amount);
  const resultingBalance = selectedInvoice
    ? Number((selectedInvoice.balanceDue - (numericAmount || 0)).toFixed(2))
    : 0;

  const loadDailySessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ schoolId });
      const response = await fetch(
        `/api/finance/cashier/sessions?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (response.ok) {
        setDailySessions(body.sessions ?? []);
        setSessionEnvelope((current) =>
          current
            ? { ...current, canSupervise: Boolean(body.canSupervise) }
            : current,
        );
      }
    } catch {
      // The primary workflow remains usable if the supervisor list fails.
    }
  }, [schoolId]);

  const loadSession = useCallback(
    async (currencyCode: string) => {
      sessionRequestRef.current?.abort();
      const controller = new AbortController();
      sessionRequestRef.current = controller;
      setSessionReadyCurrency("");
      setSessionEnvelope(null);
      setBusy("session");
      setError("");
      try {
        const params = new URLSearchParams({ schoolId, currencyCode });
        const response = await fetch(
          `/api/finance/cashier/session?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load cashier session.");
        }
        if (controller.signal.aborted) return;
        if (
          !body ||
          (body.session && body.session.currencyCode !== currencyCode)
        )
          throw new Error(
            "The cash drawer currency does not match the invoice. Reload the session.",
          );
        setSessionEnvelope(body);
        setSessionReadyCurrency(currencyCode);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load cashier session.",
        );
      } finally {
        if (sessionRequestRef.current === controller) setBusy("");
      }
    },
    [schoolId],
  );

  const loadStudent = useCallback(
    async (studentId: string, preferredInvoiceId?: string) => {
      if (paymentPendingRef.current) return;
      studentRequestRef.current?.abort();
      sessionRequestRef.current?.abort();
      const controller = new AbortController();
      studentRequestRef.current = controller;
      setSummary(null);
      setSelectedInvoiceId("");
      setSessionEnvelope(null);
      setSessionReadyCurrency("");
      setReviewing(false);
      setReference("");
      setNotes("");
      setAmount("");
      setBusy("student");
      setError("");
      setMessage("");
      setSuccess(null);
      try {
        const params = new URLSearchParams({ schoolId });
        const response = await fetch(
          `/api/finance/students/${encodeURIComponent(studentId)}/summary?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load student balances.");
        }
        if (controller.signal.aborted) return;
        if (body?.student?.id !== studentId || !Array.isArray(body?.invoices))
          throw new Error("Unable to load student balances.");
        const nextSummary = body as StudentSummary;
        setSummary(nextSummary);
        const receivableInvoices = nextSummary.invoices.filter(
          invoiceCanReceivePayment,
        );
        const preferred = receivableInvoices.find(
          (invoice) => invoice.id === preferredInvoiceId,
        );
        const nextInvoice = preferred ?? receivableInvoices[0] ?? null;
        setSelectedInvoiceId(nextInvoice?.id ?? "");
        setAmount(nextInvoice ? String(nextInvoice.balanceDue) : "");
        if (nextInvoice) {
          await loadSession(nextInvoice.currencyCode);
        } else {
          setSessionEnvelope(null);
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load student balances.",
        );
      } finally {
        if (studentRequestRef.current === controller) setBusy("");
      }
    },
    [loadSession, schoolId],
  );

  useEffect(() => {
    void Promise.all([
      fetch(`/api/finance/settings?schoolId=${encodeURIComponent(schoolId)}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const body = await response.json().catch(() => null);
          if (
            response.ok &&
            Array.isArray(body?.enabledPaymentMethods) &&
            body.enabledPaymentMethods.length
          ) {
            setEnabledPaymentMethods(body.enabledPaymentMethods);
            setMethod(body.enabledPaymentMethods[0]);
          }
        })
        .catch(() => undefined),
      loadDailySessions(),
    ]);
  }, [loadDailySessions, schoolId]);

  useEffect(() => {
    if (initialStudentId) {
      void loadStudent(initialStudentId, initialInvoiceId);
    }
  }, [initialInvoiceId, initialStudentId, loadStudent]);

  useEffect(
    () => () => {
      studentRequestRef.current?.abort();
      sessionRequestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!reviewing) return;
    function confirmWithKeyboard(event: KeyboardEvent) {
      if (
        !event.isComposing &&
        !event.repeat &&
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter"
      ) {
        event.preventDefault();
        const button = document.querySelector<HTMLButtonElement>(
          '[data-cashier-confirm="true"]',
        );
        button?.click();
      }
    }
    window.addEventListener("keydown", confirmWithKeyboard);
    return () => window.removeEventListener("keydown", confirmWithKeyboard);
  }, [reviewing]);

  useEffect(() => {
    if (!paymentUncertain && busy !== "payment") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const followLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      )
        return;
      if (
        paymentPendingRef.current ||
        !window.confirm(
          locale === "fr"
            ? "Quitter avec un résultat de paiement incertain ? Vérifiez le registre avant de saisir un nouveau paiement."
            : "Leave with an uncertain payment result? Check the ledger before entering another payment.",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", followLink, true);
    };
  }, [paymentUncertain, busy, locale]);

  async function searchStudents(event: FormEvent) {
    event.preventDefault();
    if (busy || reviewing || paymentPendingRef.current || !search.trim())
      return;
    setResults([]);
    setBusy("search");
    setError("");
    setMessage("");
    try {
      const params = new URLSearchParams({ schoolId, search: search.trim() });
      const response = await fetch(
        `/api/finance/students/search?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to search students.");
      }
      setResults(body);
      if (!body.length) {
        setMessage("No matching students were found.");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to search students.",
      );
    } finally {
      setBusy("");
    }
  }

  async function selectInvoice(invoice: Invoice) {
    if (busy || reviewing || paymentPendingRef.current) return;
    setSelectedInvoiceId(invoice.id);
    setAmount(String(invoice.balanceDue));
    setReference("");
    setNotes("");
    setReviewing(false);
    setSuccess(null);
    await loadSession(invoice.currencyCode);
  }

  async function openCashierSession() {
    if (!selectedInvoice) return;
    setBusy("open-session");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/finance/cashier/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          currencyCode: selectedInvoice.currencyCode,
          openingCashAmount: Number(openingCashAmount),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to open cashier session.");
      }
      setSessionEnvelope((current) => ({
        businessDate: body.businessDate,
        canSupervise: current?.canSupervise ?? false,
        session: body,
      }));
      setMessage(
        `${body.currencyCode} cashier session opened for ${body.businessDate}.`,
      );
      await loadDailySessions();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to open cashier session.",
      );
    } finally {
      setBusy("");
    }
  }

  function reviewPayment() {
    if (busy || success || paymentPendingRef.current) return;
    setError("");
    setMessage("");
    if (!selectedInvoice || !summary || !openSession) {
      setError(copy.contextError);
      return;
    }
    const validation = validatePaymentReview({
      amount,
      balanceDue: selectedInvoice.balanceDue,
      invoiceCurrency: selectedInvoice.currencyCode,
      sessionCurrency: openSession.currencyCode,
      method,
      enabledMethods: enabledPaymentMethods,
      reference,
    });
    if (validation === "amount") {
      setError(copy.amountError);
      return;
    }
    if (validation === "overpayment") {
      setError(copy.overpaymentError);
      return;
    }
    if (validation === "method") {
      setError(copy.methodError);
      return;
    }
    if (validation === "reference") {
      setError(copy.referenceError);
      return;
    }
    if (validation === "currency") {
      setError(copy.currencyError);
      return;
    }
    setReviewing(true);
  }

  async function confirmPayment() {
    if (
      paymentPendingRef.current ||
      busy ||
      !reviewing ||
      success ||
      !selectedInvoice ||
      !summary ||
      !openSession
    )
      return;
    paymentPendingRef.current = true;
    setBusy("payment");
    setError("");
    try {
      const payload = JSON.stringify({
        schoolId,
        invoiceId: selectedInvoice.id,
        cashierSessionId: openSession.id,
        amount: numericAmount,
        paymentDate: openSession.businessDate,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (idempotencyPayloadRef.current !== payload) {
        idempotencyKeyRef.current = crypto.randomUUID();
        idempotencyPayloadRef.current = payload;
      }
      const response = await fetch("/api/finance/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: payload,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setPaymentUncertain(response.status >= 500);
        throw new Error(body?.message ?? "Unable to record payment.");
      }
      if (
        typeof body?.paymentId !== "string" ||
        typeof body?.receiptNumber !== "string" ||
        body.currencyCode !== selectedInvoice.currencyCode ||
        !Number.isFinite(body.amount) ||
        !Number.isFinite(body.invoice?.balanceDue)
      ) {
        setPaymentUncertain(true);
        throw new Error(copy.uncertain);
      }
      setSuccess(body);
      setPaymentUncertain(false);
      setReviewing(false);
      setMessage(
        `Payment ${body.paymentNumber} recorded. Receipt ${body.receiptNumber} is ready.`,
      );
      idempotencyKeyRef.current = "";
      idempotencyPayloadRef.current = "";
      setSummary((current) =>
        current
          ? {
              ...current,
              invoices: current.invoices.map((invoice) =>
                invoice.id === selectedInvoice.id
                  ? {
                      ...invoice,
                      invoiceStatus: body.invoice.invoiceStatus,
                      paidAmount:
                        body.invoice.amountPaid ?? body.invoice.paidAmount,
                      balanceDue: body.invoice.balanceDue,
                    }
                  : invoice,
              ),
            }
          : current,
      );
      await Promise.all([
        loadSession(selectedInvoice.currencyCode),
        loadDailySessions(),
      ]);
    } catch (caught) {
      if (caught instanceof TypeError) setPaymentUncertain(true);
      setError(
        caught instanceof Error ? caught.message : "Unable to record payment.",
      );
    } finally {
      paymentPendingRef.current = false;
      setBusy("");
    }
  }

  function printReceipt(format: "A4" | "THERMAL_80MM") {
    if (!success) return;
    const path =
      format === "THERMAL_80MM"
        ? `/finance/payments/${success.paymentId}/receipt/thermal?autoprint=1`
        : `/finance/payments/${success.paymentId}/receipt?autoprint=1`;
    window.open(path, "_blank", "noopener,noreferrer");
  }

  async function closeSession() {
    if (!openSession) return;
    setBusy("close-session");
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/finance/cashier/sessions/${encodeURIComponent(openSession.id)}/close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            closingCashAmount: Number(closingCashAmount),
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to close cashier session.");
      }
      setSessionEnvelope((current) => ({
        businessDate: body.businessDate,
        canSupervise: current?.canSupervise ?? false,
        session: body,
      }));
      setMessage(
        `Session closed. Variance: ${money(body.varianceAmount, body.currencyCode)}.`,
      );
      setClosingCashAmount("");
      await loadDailySessions();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to close cashier session.",
      );
    } finally {
      setBusy("");
    }
  }

  async function reopenSession(sessionId: string) {
    setBusy(`reopen-${sessionId}`);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/finance/cashier/sessions/${encodeURIComponent(sessionId)}/reopen`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId, reason: reopenReason }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to reopen cashier session.");
      }
      setMessage("Cashier session reopened with supervisor approval.");
      setReopenSessionId("");
      setReopenReason("");
      await loadDailySessions();
      if (selectedInvoice?.currencyCode === body.currencyCode) {
        await loadSession(body.currencyCode);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to reopen cashier session.",
      );
    } finally {
      setBusy("");
    }
  }

  function resetForNextStudent() {
    if (paymentPendingRef.current || paymentUncertain) return;
    setSummary(null);
    setResults([]);
    setSearch("");
    setSelectedInvoiceId("");
    setAmount("");
    setReference("");
    setNotes("");
    setReviewing(false);
    setSuccess(null);
    setMessage("");
    setError("");
  }

  return (
    <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-6">
      {message ? (
        <div
          role="status"
          className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              1
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {copy.findStudent}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{copy.searchHint}</p>
          </div>
          {summary ? (
            <button
              type="button"
              onClick={resetForNextStudent}
              disabled={reviewing}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {copy.nextStudent}
            </button>
          ) : null}
        </div>
        <form onSubmit={searchStudents} className="mt-4 flex gap-2">
          <input
            autoFocus
            aria-label={copy.studentPlaceholder}
            disabled={reviewing}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.studentPlaceholder}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3"
          />
          <button
            type="submit"
            disabled={Boolean(busy) || reviewing || !search.trim()}
            className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Search aria-hidden="true" className="mr-2 inline h-4 w-4" />
            {busy === "search" ? copy.searching : copy.search}
          </button>
        </form>
        {results.length ? (
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {results.map((student) => (
              <button
                key={student.id}
                type="button"
                disabled={reviewing}
                onClick={() => void loadStudent(student.id)}
                className="flex w-full items-center justify-between gap-4 p-3 text-left hover:bg-slate-50"
              >
                <span>
                  <span className="block font-medium text-slate-950">
                    {studentName(student)}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {student.studentCode ?? "Code pending"}
                    {student.gradeLevelCode
                      ? ` · ${student.gradeLevelCode}`
                      : ""}
                    {student.sectionCode ? ` · ${student.sectionCode}` : ""}
                  </span>
                </span>
                <span className="text-sm font-medium text-blue-700">
                  {copy.select}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {summary ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            2
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {copy.selectInvoice}
          </h2>
          <div className="mt-1 text-sm text-slate-600">
            {studentName(summary.student)} ·{" "}
            {summary.student.studentCode ?? "Code pending"}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {summary.invoices
              .filter(invoiceCanReceivePayment)
              .map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => void selectInvoice(invoice)}
                  disabled={reviewing}
                  aria-pressed={selectedInvoiceId === invoice.id}
                  className={`rounded-2xl border p-4 text-left ${
                    selectedInvoiceId === invoice.id
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-slate-950">
                      {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                    </span>
                    <SchoolBadge>{invoice.invoiceStatus}</SchoolBadge>
                  </div>
                  <div className="mt-3 text-2xl font-bold text-slate-950">
                    {money(invoice.balanceDue, invoice.currencyCode)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Total {money(invoice.totalAmount, invoice.currencyCode)} ·
                    Due {invoice.dueDate ?? "not set"}
                  </div>
                </button>
              ))}
          </div>
          {!summary.invoices.some(invoiceCanReceivePayment) ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              {copy.noInvoices}
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedInvoice ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            3
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {copy.verifyDrawer}
          </h2>
          {busy === "session" ? (
            <div className="mt-4 text-sm text-slate-500">Loading session…</div>
          ) : sessionEnvelope?.session ? (
            <SessionSummary session={sessionEnvelope.session} />
          ) : sessionReadyCurrency === selectedInvoice.currencyCode ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-medium text-amber-950">
                Open the {selectedInvoice.currencyCode} cash drawer
              </div>
              <p className="mt-1 text-sm text-amber-800">
                Count the physical cash already in the drawer before recording
                today’s first payment.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingCashAmount}
                  onChange={(event) => setOpeningCashAmount(event.target.value)}
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2"
                  aria-label="Opening cash amount"
                />
                <button
                  type="button"
                  onClick={() => void openCashierSession()}
                  disabled={busy === "open-session"}
                  className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy === "open-session" ? "Opening…" : "Open session"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-amber-800">
                {copy.currencyUnavailable}
              </p>
              <button
                type="button"
                onClick={() => void loadSession(selectedInvoice.currencyCode)}
                className={schoolActionClass()}
              >
                {locale === "fr" ? "Réessayer" : "Try again"}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {selectedInvoice && openSession && summary && !reviewing && !success ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            4
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {copy.enterPayment}
          </h2>
          <div className="mt-3 flex flex-wrap gap-4 rounded-xl bg-slate-50 p-3 text-sm">
            <span>
              {copy.balance}:{" "}
              <strong>
                {money(
                  selectedInvoice.balanceDue,
                  selectedInvoice.currencyCode,
                  locale,
                )}
              </strong>
            </span>
            <span>
              {copy.afterPayment}:{" "}
              <strong>
                {money(resultingBalance, selectedInvoice.currencyCode, locale)}
              </strong>
            </span>
            <span className="font-semibold">
              {selectedInvoice.currencyCode}
            </span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              {copy.amount} ({selectedInvoice.currencyCode})
              <input
                type="number"
                min="0.01"
                max={selectedInvoice.balanceDue}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    reviewPayment();
                  }
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {copy.method}
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                {enabledPaymentMethods.map((paymentMethod) => (
                  <option key={paymentMethod} value={paymentMethod}>
                    {PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              {copy.reference} (
              {method === "CASH" ? copy.optional : copy.required})
              <input
                maxLength={200}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {copy.notes} ({copy.optional})
              <input
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={reviewPayment}
            className={"mt-5 " + schoolActionClass("primary")}
          >
            <CreditCard aria-hidden="true" className="h-4 w-4" />
            {copy.review}
          </button>
        </section>
      ) : null}

      {reviewing && selectedInvoice && summary && openSession ? (
        <section className="rounded-2xl border-2 border-blue-500 bg-blue-50 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            5 · {copy.confirmation}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {copy.confirmTitle}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ReviewItem
              label={copy.student}
              value={studentName(summary.student)}
            />
            <ReviewItem
              label={copy.studentCode}
              value={summary.student.studentCode ?? "Code pending"}
            />
            <ReviewItem
              label={copy.invoice}
              value={selectedInvoice.invoiceNumber ?? selectedInvoice.id}
            />
            <ReviewItem
              label={copy.payment}
              value={money(numericAmount, selectedInvoice.currencyCode, locale)}
            />
            <ReviewItem
              label={copy.method}
              value={PAYMENT_METHOD_LABELS[method] ?? method}
            />
            <ReviewItem
              label={copy.afterPayment}
              value={money(
                resultingBalance,
                selectedInvoice.currencyCode,
                locale,
              )}
            />
            <ReviewItem
              label={copy.currency}
              value={selectedInvoice.currencyCode}
            />
            <ReviewItem
              label={copy.paymentDate}
              value={openSession.businessDate}
            />
            <ReviewItem
              label={copy.reference}
              value={reference.trim() || "—"}
            />
            <ReviewItem label={copy.notes} value={notes.trim() || "—"} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              data-cashier-confirm="true"
              onClick={() => void confirmPayment()}
              disabled={busy === "payment"}
              className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "payment" ? copy.posting : copy.confirm}
            </button>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={paymentUncertain}
              className="rounded-xl border border-blue-300 bg-white px-5 py-3 text-sm font-medium"
            >
              {copy.back}
            </button>
          </div>
          <p className="mt-3 text-xs text-blue-800">{copy.shortcut}</p>
          {paymentUncertain ? (
            <p role="status" className="mt-3 text-sm text-amber-900">
              {copy.uncertain}
            </p>
          ) : null}
        </section>
      ) : null}

      {success ? (
        <section className="rounded-2xl border border-green-300 bg-green-50 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-green-700">
            6 · {copy.complete}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-green-950">
            Receipt {success.receiptNumber} is ready
          </h2>
          <p className="mt-2 text-sm text-green-800">
            <CheckCircle2 aria-hidden="true" className="mr-1 inline h-4 w-4" />
            {money(success.amount, success.currencyCode)} recorded. Remaining
            balance: {money(success.invoice.balanceDue, success.currencyCode)}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void printReceipt("THERMAL_80MM")}
              disabled={busy === "print"}
              className="rounded-xl bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Printer aria-hidden="true" className="mr-1 inline h-4 w-4" />
              {copy.printThermal}
            </button>
            <button
              type="button"
              onClick={() => void printReceipt("A4")}
              disabled={busy === "print"}
              className="rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-900"
            >
              {copy.printA4}
            </button>
            <Link
              href={`/finance/payments/${success.paymentId}/receipt`}
              className="rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-900"
            >
              {copy.openReceipt}
            </Link>
            <button
              type="button"
              onClick={resetForNextStudent}
              className="rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-900"
            >
              {copy.nextStudent}
            </button>
            {success.invoice.balanceDue > 0 && summary ? (
              <button
                type="button"
                onClick={() =>
                  void loadStudent(summary.student.id, selectedInvoiceId)
                }
                className={schoolActionClass()}
              >
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
                {copy.anotherPayment}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {openSession && !reviewing ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white">
          <h2 className="text-lg font-semibold">Close this cash drawer</h2>
          <p className="mt-1 text-sm text-slate-300">
            Expected cash is{" "}
            {money(openSession.expectedCashAmount, openSession.currencyCode)}.
            Count the drawer and enter the physical amount below.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={closingCashAmount}
              onChange={(event) => setClosingCashAmount(event.target.value)}
              placeholder="Counted cash"
              className="rounded-xl border border-slate-600 bg-white px-3 py-2 text-slate-950"
            />
            {closingCashAmount ? (
              <span className="text-sm text-slate-300">
                Variance preview:{" "}
                {money(
                  Number(closingCashAmount) - openSession.expectedCashAmount,
                  openSession.currencyCode,
                )}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void closeSession()}
              disabled={!closingCashAmount || busy === "close-session"}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy === "close-session" ? "Closing…" : "Close and reconcile"}
            </button>
          </div>
        </section>
      ) : null}

      {sessionEnvelope?.canSupervise && dailySessions.length && !reviewing ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Supervisor · today’s cashier sessions
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Closed sessions can only be reopened here with an audited reason.
          </p>
          <div className="mt-4 space-y-3">
            {dailySessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-950">
                      {studentName(session.cashier)} · {session.currencyCode}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {session.collectionCount} payment(s) · net{" "}
                      {money(session.collectionTotal, session.currencyCode)}
                      {session.refundCount > 0 ? (
                        <>
                          {" "}
                          · {session.refundCount} refund(s) totaling{" "}
                          {money(session.refundTotal, session.currencyCode)}
                        </>
                      ) : null}{" "}
                    </div>
                  </div>
                  <SchoolBadge>{session.status}</SchoolBadge>
                </div>
                {session.status === "CLOSED" ? (
                  <div className="mt-3">
                    <div className="text-sm text-slate-600">
                      Expected{" "}
                      {money(session.expectedCashAmount, session.currencyCode)}{" "}
                      · Counted{" "}
                      {money(
                        session.closingCashAmount ?? 0,
                        session.currencyCode,
                      )}{" "}
                      · Variance{" "}
                      {money(session.varianceAmount ?? 0, session.currencyCode)}
                    </div>
                    {reopenSessionId === session.id ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          value={reopenReason}
                          onChange={(event) =>
                            setReopenReason(event.target.value)
                          }
                          placeholder="Required supervisor reason"
                          className="min-w-72 flex-1 rounded-xl border border-slate-300 px-3 py-2"
                        />
                        <button
                          type="button"
                          onClick={() => void reopenSession(session.id)}
                          disabled={
                            reopenReason.trim().length < 10 ||
                            busy === `reopen-${session.id}`
                          }
                          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Approve reopening
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReopenSessionId(session.id);
                          setReopenReason("");
                        }}
                        className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
                      >
                        Review reopening
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </fieldset>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function SessionSummary({ session }: { session: CashierSession }) {
  return (
    <div
      className={`mt-4 rounded-2xl border p-4 ${
        session.status === "OPEN"
          ? "border-green-200 bg-green-50"
          : "border-slate-300 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-slate-950">
            {session.currencyCode} session · {session.businessDate}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Opening cash{" "}
            {money(session.openingCashAmount, session.currencyCode)} · Expected
            cash {money(session.expectedCashAmount, session.currencyCode)}
          </div>
        </div>
        <SchoolBadge>{session.status}</SchoolBadge>
      </div>
      {session.collectionsByMethod.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {session.collectionsByMethod.map((item) => (
            <span
              key={item.paymentMethod}
              className="rounded-full bg-white px-3 py-1 text-xs text-slate-700"
            >
              {PAYMENT_METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod}:{" "}
              net {money(item.totalAmount, session.currencyCode)} (
              {item.paymentCount} payment(s)
              {item.refundCount > 0 ? `, ${item.refundCount} refund(s)` : ""}
              ){" "}
            </span>
          ))}
        </div>
      ) : null}
      {session.status === "CLOSED" ? (
        <p className="mt-3 text-sm text-slate-600">
          This session is closed. A supervisor must reopen it before another
          payment can be posted.
        </p>
      ) : null}
    </div>
  );
}
