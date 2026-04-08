"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CreditCard,
  GraduationCap,
  Home,
  Users,
} from "lucide-react";
import { ReactNode } from "react";

type AdminShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/students", label: "Students", icon: Users },
  { href: "/academics", label: "Academics", icon: GraduationCap },
  { href: "/finance", label: "Finance", icon: CreditCard },
  { href: "/reports", label: "Reports", icon: BookOpen },
];

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              School Management
            </div>
            <div className="mt-1 text-xl font-bold">Admin Panel</div>
          </div>

          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Bilingual K-12 Platform
              </div>
              <div className="text-lg font-semibold">Admin Workspace</div>
            </div>

            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                FR / EN
              </button>
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
                <BarChart3 size={16} />
                Connected to API
              </div>
            </div>
          </header>

          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}