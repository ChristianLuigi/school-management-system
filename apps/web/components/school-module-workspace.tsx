"use client";

import { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Settings2,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  QuickLinkCard,
  SchoolPageHeader,
  SchoolPanel,
} from "@/components/school-ui";

type WorkspaceIcon =
  | "dashboard"
  | "students"
  | "academics"
  | "attendance"
  | "gradebooks"
  | "finance"
  | "reports"
  | "settings";

type QuickAction = {
  href: string;
  title: string;
  description?: string;
  icon?: WorkspaceIcon;
};

type AttentionItem = {
  tone?: "green" | "amber" | "red" | "blue" | "neutral";
  title: string;
  description: string;
};

const WORKSPACE_ICONS = {
  dashboard: LayoutDashboard,
  students: UsersRound,
  academics: GraduationCap,
  attendance: ClipboardCheck,
  gradebooks: BookOpenCheck,
  finance: WalletCards,
  reports: FileText,
  settings: Settings2,
} as const;
function attentionToneClasses(
  tone: AttentionItem["tone"],
): { container: string; heading: string; body: string } {
  if (tone === "red") {
    return {
      container: "border-danger/40 bg-danger-subtle",
      heading: "text-danger",
      body: "text-danger",
    };
  }

  if (tone === "green") {
    return {
      container: "border-success/40 bg-success-subtle",
      heading: "text-success",
      body: "text-success",
    };
  }

  if (tone === "blue") {
    return {
      container: "border-info/40 bg-info-subtle",
      heading: "text-info",
      body: "text-info",
    };
  }

  if (tone === "neutral") {
    return {
      container: "border-border bg-surface",
      heading: "text-foreground",
      body: "text-foreground",
    };
  }

  return {
    container: "border-warning/40 bg-warning-subtle",
    heading: "text-warning",
    body: "text-warning",
  };
}

export function SchoolModuleWorkspace({
  title,
  description,
  quickActions,
  attentionItems,
  mainTitle,
  mainSubtitle,
  children,
  compact = false,
}: {
  title: string;
  description: string;
  quickActions: QuickAction[];
  attentionItems: AttentionItem[];
  mainTitle: string;
  mainSubtitle?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const { t } = useI18n();

  if (compact) {
    return (
      <div className="space-y-5">
        <SchoolPageHeader title={title} description={description} />

        <nav
          aria-label={t("workspace.quickActions")}
          className="flex flex-wrap gap-2"
        >
          {quickActions.map((action) => {
            const Icon = action.icon ? WORKSPACE_ICONS[action.icon] : Landmark;
            return (
              <Link
                key={`${action.href}-${action.title}`}
                href={action.href}
                className="group inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-input hover:text-foreground"
              >
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-info" />
                <span>{action.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
              </Link>
            );
          })}
        </nav>

        {attentionItems.length ? (
          <div className="flex flex-wrap gap-2">
            {attentionItems.map((item, index) => {
              const toneClasses = attentionToneClasses(item.tone);
              return (
                <div
                  key={`${item.title}-${index}`}
                  title={item.description}
                  className={`rounded-xl border px-3 py-2 text-sm ${toneClasses.container}`}
                >
                  <span className={`font-medium ${toneClasses.heading}`}>
                    {item.title}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        {children}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SchoolPageHeader title={title} description={description} />

      <div className="grid gap-6 xl:grid-cols-2">
        <SchoolPanel
          title={t("workspace.quickActions")}
          subtitle={t("workspace.quickActionsDescription")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {quickActions.map((action) => (
              <QuickLinkCard
                key={`${action.href}-${action.title}`}
                href={action.href}
                title={action.title}
                description={action.description ?? ""}
              />
            ))}
          </div>
        </SchoolPanel>

        <SchoolPanel
          title={t("workspace.operationalAttention")}
          subtitle={t("workspace.operationalAttentionDescription")}
        >
          <div className="space-y-3">
            {attentionItems.map((item, index) => {
              const toneClasses = attentionToneClasses(item.tone);

              return (
                <div
                  key={`${item.title}-${index}`}
                  className={`rounded-2xl border p-4 ${toneClasses.container}`}
                >
                  <div className={`font-semibold ${toneClasses.heading}`}>
                    {item.title}
                  </div>
                  <p className={`mt-1 text-sm ${toneClasses.body}`}>
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </SchoolPanel>
      </div>

      <SchoolPanel title={mainTitle} subtitle={mainSubtitle}>
        {children}
      </SchoolPanel>
    </div>
  );
}