"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CircleDollarSign,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const ITEMS = [
  { href: "/finance", labelKey: "finance.overview", icon: LayoutDashboard },
  { href: "/finance/cashier", labelKey: "finance.cashier", icon: Banknote },
  { href: "/finance/billing", labelKey: "finance.billing", icon: ReceiptText },
  {
    href: "/finance/reconciliation",
    labelKey: "finance.reconciliation",
    icon: Landmark,
  },
  {
    href: "/finance/corrections",
    labelKey: "finance.corrections",
    icon: RotateCcw,
  },
  {
    href: "/finance/payroll",
    labelKey: "finance.payroll",
    icon: CircleDollarSign,
  },
] as const;

export function FinanceNavigation() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1 print:hidden">
      <nav
        aria-label={t("finance.navigation")}
        className="flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/finance"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                active
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
