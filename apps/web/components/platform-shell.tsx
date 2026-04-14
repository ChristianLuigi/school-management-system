"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings2,
} from "lucide-react";
import { ReactNode, useState } from "react";

type PlatformShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/platform", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/schools", label: "Schools", icon: Building2 },
  { href: "/platform/invitations", label: "Invitations", icon: Mail },
  { href: "/platform/onboarding", label: "Onboarding", icon: Settings2 },
];

export function PlatformShell({ children }: PlatformShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/session/logout", {
        method: "POST",
      });

      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Platform
            </div>
            <div className="mt-1 text-xl font-bold">Super Admin</div>
          </div>

          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/platform"
                  ? pathname === "/platform"
                  : pathname.startsWith(item.href);

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
                Multi-school SaaS
              </div>
              <div className="text-lg font-semibold">Platform Workspace</div>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <LogOut size={16} />
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          </header>

          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}