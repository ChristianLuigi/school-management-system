import { cookies } from "next/headers";
import {
  defaultLocale,
  isSupportedLocale,
  LOCALE_COOKIE,
  translate,
  type Locale,
} from "./messages";

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

  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
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
