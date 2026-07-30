"use client";

import { useCallback, useEffect, useState } from "react";

type PrintFormat = "A4" | "THERMAL_80MM";

export function useReceiptPrintAudit({
  schoolId,
  paymentId,
}: {
  schoolId: string;
  paymentId: string;
}) {
  const [printCount, setPrintCount] = useState(0);
  const [loadingPrintAudit, setLoadingPrintAudit] = useState(true);
  const [printError, setPrintError] = useState("");

  const loadPrintSummary = useCallback(async () => {
    setLoadingPrintAudit(true);
    try {
      const query = new URLSearchParams({ schoolId });
      const response = await fetch(
        `/api/finance/payments/${encodeURIComponent(paymentId)}/receipt-prints?${query.toString()}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to load receipt print history.");
      }
      setPrintCount(Number(body.printCount ?? 0));
      return Number(body.printCount ?? 0);
    } finally {
      setLoadingPrintAudit(false);
    }
  }, [paymentId, schoolId]);

  useEffect(() => {
    void loadPrintSummary().catch((caught) => {
      setPrintError(
        caught instanceof Error
          ? caught.message
          : "Unable to load receipt print history.",
      );
    });
  }, [loadPrintSummary]);

  const recordAndPrint = useCallback(
    async (printFormat: PrintFormat) => {
      setPrintError("");
      try {
        const currentCount = await loadPrintSummary();
        let reason: string | undefined;
        if (currentCount > 0) {
          const provided = window.prompt(
            "This receipt has already been printed. Enter the reprint reason (at least 5 characters).",
          );
          if (provided === null) {
            return false;
          }
          reason = provided.trim();
          if (reason.length < 5) {
            throw new Error(
              "A reason of at least 5 characters is required to reprint a receipt.",
            );
          }
        }
        const response = await fetch(
          `/api/finance/payments/${encodeURIComponent(paymentId)}/receipt-prints`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ schoolId, printFormat, reason }),
          },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to record receipt print.");
        }
        setPrintCount(Number(body.printCount ?? currentCount + 1));
        window.print();
        return true;
      } catch (caught) {
        setPrintError(
          caught instanceof Error
            ? caught.message
            : "Unable to print the receipt.",
        );
        return false;
      }
    },
    [loadPrintSummary, paymentId, schoolId],
  );

  return {
    printCount,
    loadingPrintAudit,
    printError,
    recordAndPrint,
  };
}
