"use client";

import type { ReactNode } from "react";
import { LogOut, Menu } from "lucide-react";

type TopbarProps = {
  workspaceLabel: string;
  user: {
    name: string;
    email: string;
  };
  actions?: ReactNode;
  loggingOut: boolean;
  onMenuClick: () => void;
  onLogout: () => void;
};

function initials(name: string, email: string) {
  const source = name.trim() || email;
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Topbar({
  workspaceLabel,
  user,
  actions,
  loggingOut,
  onMenuClick,
  onLogout,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex min-h-20 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-controls="app-sidebar"
            aria-label="Open navigation"
            className="rounded-md border border-border bg-surface p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground lg:hidden"
            onClick={onMenuClick}
          >
            <Menu aria-hidden="true" size={20} />
          </button>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Workspace
            </p>
            <p className="truncate text-sm font-semibold text-foreground sm:text-base">
              {workspaceLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {actions}

          <div className="hidden min-w-0 items-center gap-3 border-l border-border pl-3 sm:flex">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
              {initials(user.name, user.email)}
            </div>
            <div className="hidden min-w-0 xl:block">
              <p className="max-w-40 truncate text-sm font-medium text-foreground">
                {user.name || "Account"}
              </p>
              <p className="max-w-40 truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loggingOut}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-60"
            onClick={onLogout}
          >
            <LogOut aria-hidden="true" size={16} />
            <span className="hidden sm:inline">
              {loggingOut ? "Signing out…" : "Sign out"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
