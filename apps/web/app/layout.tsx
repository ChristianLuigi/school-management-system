import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./print.css";
import { I18nProvider } from "@/components/i18n-provider";
import { getServerLocale } from "@/lib/i18n";
import { Providers } from "./providers";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export const metadata: Metadata = {
  title: {
    default: "Almac School Management",
    template: "%s | Almac",
  },
  description:
    "A secure, bilingual workspace for modern school administration.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

const themeInitializer = `
  (() => {
    try {
      const stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
      const preference = ["light", "dark", "system"].includes(stored) ? stored : "light";
      const resolved = preference === "system"
        ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : preference;
      const root = document.documentElement;
      root.dataset.theme = resolved;
      root.dataset.themePreference = preference;
      root.classList.toggle("dark", resolved === "dark");
      root.style.colorScheme = resolved;
    } catch {}
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>
        <I18nProvider initialLocale={locale}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}