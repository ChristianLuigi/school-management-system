export const THEME_STORAGE_KEY = "almac-ui-theme";

export const themes = ["light", "dark", "system"] as const;

export type Theme = (typeof themes)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && themes.includes(value as Theme);
}
