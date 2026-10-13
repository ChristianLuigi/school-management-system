# Language consistency

The application now uses next-i18next 16 (App Router), i18next and react-i18next. Existing `useI18n()` and `getServerTranslator()` callers are compatibility adapters backed by next-i18next. URLs and the `almac_locale` cookie are preserved; authentication proxy behavior is unchanged.

Resources are bundled from `lib/i18n/messages.ts`, so no runtime public-directory filesystem access is required on Vercel. Existing `{name}` interpolation remains supported. French and English catalogs have identical keys, checked by `tests/i18n-catalog.test.mjs`.

This is the engine migration, not a claim of complete translation coverage. Remaining conversion must include hardcoded page headings, form placeholders, validation messages, API error presentation, status labels, PDF/print output and date/number formatting. Do not translate personal names or user-entered school data automatically.

Use catalog keys via `useI18n().t` or `getServerTranslator().t` for new UI. Keep keys present in both languages. Do not display bilingual slash-separated labels. API error identifiers should map to localized UI messages; never weaken backend validation or expose raw internal errors.

Verification: switch FR/EN on each role's workflows and printed documents; reload and check cookie persistence, document language, empty states, validation, successful actions and failure states. Catalog parity does not prove that hardcoded text has been eliminated.
