import type { I18nConfig } from "next-i18next/proxy";
import { messages, LOCALE_COOKIE } from "./lib/i18n/messages";
import { platformFr, platformEn } from "./lib/i18n/platform-copy";

const config: I18nConfig = {
  supportedLngs: ["fr", "en"],
  fallbackLng: "fr",
  defaultNS: "common",
  ns: ["common", "platform"],
  localeInPath: false,
  cookieName: LOCALE_COOKIE,
  persistCookie: false,
  resourceLoader: async (language, namespace) => namespace === "platform" ? (language === "fr" ? platformFr : platformEn) : messages[language as "fr" | "en"],
  i18nextOptions: {
    interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
    returnObjects: false,
  },
};
export default config;
