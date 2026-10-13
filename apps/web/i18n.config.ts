import type { I18nConfig } from "next-i18next/proxy";
import { messages, LOCALE_COOKIE } from "./lib/i18n/messages";

const config: I18nConfig = {
  supportedLngs: ["fr", "en"],
  fallbackLng: "fr",
  defaultNS: "common",
  ns: ["common"],
  localeInPath: false,
  cookieName: LOCALE_COOKIE,
  persistCookie: false,
  resourceLoader: async language => messages[language as "fr" | "en"],
  i18nextOptions: {
    interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
    returnObjects: false,
  },
};
export default config;
