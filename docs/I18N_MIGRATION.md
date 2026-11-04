# Language consistency

The application now uses next-i18next 16 (App Router), i18next and react-i18next. Existing `useI18n()` and `getServerTranslator()` callers are compatibility adapters backed by next-i18next. URLs and the `almac_locale` cookie are preserved; authentication proxy behavior is unchanged.

Resources are bundled from `lib/i18n/messages.ts`, so no runtime public-directory filesystem access is required on Vercel. Existing `{name}` interpolation remains supported. French and English catalogs have identical keys, checked by `tests/i18n-catalog.test.mjs`.

This is the engine migration, not a claim of complete translation coverage. Remaining conversion must include hardcoded page headings, form placeholders, validation messages, API error presentation, status labels, PDF/print output and date/number formatting. Do not translate personal names or user-entered school data automatically.

## Super Admin source conversion (November 2026)

Super Admin pages/components now use the bundled `platform` namespace in `lib/i18n/platform-copy.ts`, via `usePlatformCopy()` (client) and `getServerPlatformCopy()` (server). This namespace uses literal source text keys with `keySeparator: false`, because sentences contain punctuation. The original `common` namespace continues using dotted keys. Both reuse the same locale cookie and language switcher.

Converted content includes page headings, fields, placeholders, buttons, empty/loading states, roles/statuses, chart legends/tooltips, onboarding actions, and known feedback. Unknown backend errors are mapped to a safe localized message instead of displaying raw English/internal details. Known audit summary templates preserve dynamic names/emails; unrecognized audit descriptions use a localized event label in French. Stored audit records/exports are not rewritten, and English still displays the original audit summary.

`tests/platform-i18n.test.mjs` runs with `pnpm test:ux`: catalog parity, interpolation, error safety, audit templates and an AST check across Super Admin TSX pages/components. It rejects raw static UI text, untranslated non-locale branches and missing literal `pt()` keys. Names, example email addresses, technical abbreviations and existing explicit FR/EN branches are deliberately allowed. This is a source-coverage check, not a claim of visual end-to-end testing or complete translation of every other school module/PDF.

The root `pnpm test`/`pnpm check` also runs the maintained web tests, so the existing release CI quality gate includes this protection.

For new platform copy, add English/French entries and use the appropriate helper. Never translate `value`, API paths, role identifiers or mutation payloads. New API-generated audit descriptions should have structured event codes/templates; do not rely on automatic translation of arbitrary stored text.

Use catalog keys via `useI18n().t` or `getServerTranslator().t` for new UI. Keep keys present in both languages. Do not display bilingual slash-separated labels. API error identifiers should map to localized UI messages; never weaken backend validation or expose raw internal errors.

Verification: switch FR/EN on each role's workflows and printed documents; reload and check cookie persistence, document language, empty states, validation, successful actions and failure states. Catalog parity does not prove that hardcoded text has been eliminated.
