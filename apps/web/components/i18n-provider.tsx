"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  defaultLocale,
  LOCALE_COOKIE,
  messages,
  supportedLocales,
  translate,
  type Locale,
} from "@/lib/i18n/messages";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale?: Locale;
  children: ReactNode;
}) {
  const router = useRouter();

  const [locale, setLocaleState] = useState<Locale>(
    initialLocale && supportedLocales.includes(initialLocale)
      ? initialLocale
      : defaultLocale,
  );

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (!supportedLocales.includes(nextLocale)) return;

      setLocaleState(nextLocale);

      document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

      try {
        window.localStorage.setItem(LOCALE_COOKIE, nextLocale);
      } catch {
        // Ignore localStorage errors; the cookie is the server source of truth.
      }

      router.refresh();
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return value;
}

export { messages };
