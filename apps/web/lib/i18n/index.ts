import { cookies } from "next/headers";
import { createServerI18next } from "next-i18next/server";
import config from "../../i18n.config";
import {
  defaultLocale,
  isSupportedLocale,
  LOCALE_COOKIE,
  type Locale,
} from "./messages";

const { getT } = createServerI18next(config);

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  return defaultLocale;
}

export async function getServerTranslator() {
  const locale = await getServerLocale();
  const { t } = await getT("common", { lng: locale });

  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) =>
      String(t(key, params)),
  };
}

export {
  defaultLocale,
  isSupportedLocale,
  LOCALE_COOKIE,
  messages,
  supportedLocales,
  translate,
  type Locale,
} from "./messages";
