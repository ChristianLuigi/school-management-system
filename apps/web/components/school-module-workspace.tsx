"use client";

import { ReactNode } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  QuickLinkCard,
  SchoolPageHeader,
  SchoolPanel,
} from "@/components/school-ui";

type QuickAction = {
  href: string;
  title: string;
  description: string;
};

type AttentionItem = {
  tone?: "green" | "amber" | "red" | "blue" | "neutral";
  title: string;
  description: string;
};

function attentionToneClasses(
  tone: AttentionItem["tone"],
): { container: string; heading: string; body: string } {
  if (tone === "red") {
    return {
      container: "border-red-200 bg-red-50",
      heading: "text-red-900",
      body: "text-red-800",
    };
  }

  if (tone === "green") {
    return {
      container: "border-green-200 bg-green-50",
      heading: "text-green-900",
      body: "text-green-800",
    };
  }

  if (tone === "blue") {
    return {
      container: "border-blue-200 bg-blue-50",
      heading: "text-blue-900",
      body: "text-blue-800",
    };
  }

  if (tone === "neutral") {
    return {
      container: "border-slate-200 bg-slate-50",
      heading: "text-slate-900",
      body: "text-slate-700",
    };
  }

  return {
    container: "border-amber-200 bg-amber-50",
    heading: "text-amber-900",
    body: "text-amber-800",
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
}: {
  title: string;
  description: string;
  quickActions: QuickAction[];
  attentionItems: AttentionItem[];
  mainTitle: string;
  mainSubtitle?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();

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
                description={action.description}
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