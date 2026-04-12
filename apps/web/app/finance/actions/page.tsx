"use client";

import { AdminShell } from "@/components/admin-shell";
import { apiPost } from "@/lib/api";
import { FormEvent, useState } from "react";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const GRADE_LEVEL_ID = "55555555-5555-4555-8555-555555555561";
const STUDENT_ID = "7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const ACADEMIC_YEAR_ID = "33333333-3333-4333-8333-333333333333";
const GRADING_PERIOD_ID = "44444444-4444-4444-8444-444444444441";
const ADMIN_USER_ID = "77777777-7777-4777-8777-777777777771";

export default function FinanceActionsPage() {
  const [feePlanForm, setFeePlanForm] = useState({
    schoolId: SCHOOL_ID,
    frName: "Frais de scolarité - Trimestre 1",
    enName: "Tuition Fee - Trimester 1",
    feeType: "TUITION",
    billingFrequency: "TRIMESTER",
    gradeLevelId: GRADE_LEVEL_ID,
    defaultAmount: "15000",
    currencyCode: "HTG",
    isActive: true,
  });

  const [invoiceForm, setInvoiceForm] = useState({
    studentId: STUDENT_ID,
    academicYearId: ACADEMIC_YEAR_ID,
    gradingPeriodId: GRADING_PERIOD_ID,
    issueDate: "2025-09-20",
    dueDate: "2025-09-30",
    currencyCode: "HTG",
    tuitionAmount: "15000",
    transportAmount: "3000",
  });

  const [paymentForm, setPaymentForm] = useState({
    invoiceId: "",
    studentId: STUDENT_ID,
    amount: "5000",
    paymentMethod: "CASH",
    recordedByUserId: ADMIN_USER_ID,
    referenceNo: "",
  });

  const [feePlanResult, setFeePlanResult] = useState<string>("");
  const [invoiceResult, setInvoiceResult] = useState<string>("");
  const [paymentResult, setPaymentResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function handleCreateFeePlan(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFeePlanResult("");

    try {
      const result = await apiPost<{ id: string; name_i18n: Record<string, string> }>(
        "/fee-plans",
        {
          schoolId: feePlanForm.schoolId,
          nameI18n: {
            fr: feePlanForm.frName,
            en: feePlanForm.enName,
          },
          feeType: feePlanForm.feeType,
          billingFrequency: feePlanForm.billingFrequency,
          gradeLevelId: feePlanForm.gradeLevelId || undefined,
          defaultAmount: Number(feePlanForm.defaultAmount),
          currencyCode: feePlanForm.currencyCode,
          isActive: feePlanForm.isActive,
        },
      );

      setFeePlanResult(
        `Fee plan created: ${result.id} (${result.name_i18n?.fr ?? "Unnamed"})`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create fee plan.");
    }
  }

  async function handleGenerateInvoice(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInvoiceResult("");

    try {
      const result = await apiPost<{
        invoice: { id: string; invoice_number: string; total_amount: string };
      }>("/invoices/generate", {
        studentId: invoiceForm.studentId,
        academicYearId: invoiceForm.academicYearId,
        gradingPeriodId: invoiceForm.gradingPeriodId,
        issueDate: invoiceForm.issueDate,
        dueDate: invoiceForm.dueDate,
        currencyCode: invoiceForm.currencyCode,
        lineItems: [
          {
            labelI18n: {
              fr: "Scolarité - 1er trimestre",
              en: "Tuition - Trimester 1",
            },
            quantity: 1,
            unitAmount: Number(invoiceForm.tuitionAmount),
            discountAmount: 0,
          },
          {
            labelI18n: {
              fr: "Transport",
              en: "Transport",
            },
            quantity: 1,
            unitAmount: Number(invoiceForm.transportAmount),
            discountAmount: 0,
          },
        ],
      });

      setInvoiceForm((prev) => ({
        ...prev,
      }));

      setPaymentForm((prev) => ({
        ...prev,
        invoiceId: result.invoice.id,
      }));

      setInvoiceResult(
        `Invoice generated: ${result.invoice.invoice_number} | ID: ${result.invoice.id} | Total: ${result.invoice.total_amount}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invoice.");
    }
  }

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPaymentResult("");

    try {
      const result = await apiPost<{
        payment: { id: string; receipt_number: string; amount: string };
        invoice: { id: string; status: string; balanceDue: number };
      }>("/payments/record", {
        invoiceId: paymentForm.invoiceId,
        studentId: paymentForm.studentId,
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        recordedByUserId: paymentForm.recordedByUserId,
        referenceNo: paymentForm.referenceNo || undefined,
      });

      setPaymentResult(
        `Payment recorded: ${result.payment.receipt_number} | Amount: ${result.payment.amount} | New balance: ${result.invoice.balanceDue}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment.");
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Finance Actions</h1>
          <p className="mt-1 text-slate-600">
            Create fee plans, generate invoices, and record payments from the admin panel.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <form
            onSubmit={handleCreateFeePlan}
            className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <h2 className="text-lg font-semibold">Create Fee Plan</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">French Name</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={feePlanForm.frName}
                onChange={(e) =>
                  setFeePlanForm((prev) => ({ ...prev, frName: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">English Name</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={feePlanForm.enName}
                onChange={(e) =>
                  setFeePlanForm((prev) => ({ ...prev, enName: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Fee Type</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={feePlanForm.feeType}
                onChange={(e) =>
                  setFeePlanForm((prev) => ({ ...prev, feeType: e.target.value }))
                }
              >
                <option value="TUITION">TUITION</option>
                <option value="REGISTRATION">REGISTRATION</option>
                <option value="TRANSPORT">TRANSPORT</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Billing Frequency</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={feePlanForm.billingFrequency}
                onChange={(e) =>
                  setFeePlanForm((prev) => ({
                    ...prev,
                    billingFrequency: e.target.value,
                  }))
                }
              >
                <option value="MONTHLY">MONTHLY</option>
                <option value="TRIMESTER">TRIMESTER</option>
                <option value="ONE_TIME">ONE_TIME</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Default Amount</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={feePlanForm.defaultAmount}
                onChange={(e) =>
                  setFeePlanForm((prev) => ({
                    ...prev,
                    defaultAmount: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={feePlanForm.currencyCode}
                onChange={(e) =>
                  setFeePlanForm((prev) => ({
                    ...prev,
                    currencyCode: e.target.value,
                  }))
                }
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800"
            >
              Create Fee Plan
            </button>

            {feePlanResult ? (
              <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
                {feePlanResult}
              </div>
            ) : null}
          </form>

          <form
            onSubmit={handleGenerateInvoice}
            className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <h2 className="text-lg font-semibold">Generate Invoice</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">Issue Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={invoiceForm.issueDate}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, issueDate: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Due Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={invoiceForm.dueDate}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tuition Amount</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={invoiceForm.tuitionAmount}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({
                    ...prev,
                    tuitionAmount: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Transport Amount</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={invoiceForm.transportAmount}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({
                    ...prev,
                    transportAmount: e.target.value,
                  }))
                }
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800"
            >
              Generate Invoice
            </button>

            {invoiceResult ? (
              <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
                {invoiceResult}
              </div>
            ) : null}
          </form>

          <form
            onSubmit={handleRecordPayment}
            className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <h2 className="text-lg font-semibold">Record Payment</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">Invoice ID</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={paymentForm.invoiceId}
                onChange={(e) =>
                  setPaymentForm((prev) => ({ ...prev, invoiceId: e.target.value }))
                }
                placeholder="Paste or auto-fill from generated invoice"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Amount</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Payment Method</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={paymentForm.paymentMethod}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentMethod: e.target.value,
                  }))
                }
              >
                <option value="CASH">CASH</option>
                <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                <option value="CARD">CARD</option>
                <option value="MOBILE_MONEY">MOBILE_MONEY</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Reference No (optional)</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={paymentForm.referenceNo}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    referenceNo: e.target.value,
                  }))
                }
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800"
            >
              Record Payment
            </button>

            {paymentResult ? (
              <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
                {paymentResult}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </AdminShell>
  );
}