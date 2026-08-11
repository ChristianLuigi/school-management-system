export function encodeCsvCell(value: unknown) {
  const text = String(value ?? "");
  const safeText =
    typeof value !== "number" && /^[\s]*[=+\-@]/.test(text)
      ? `'${text}`
      : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function createSafeCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>) {
  return rows.map((row) => row.map(encodeCsvCell).join(",")).join("\r\n");
}
