export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

export function parseCsv(
  input: string,
  options: { maxRows?: number; recordLabel?: string } = {},
): ParsedCsv {
  const source = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (closedQuote && character !== "," && character !== "\n" && character !== "\r") {
      throw new Error("A quoted CSV field must end before the next separator.");
    }
    if (character === '"') {
      if (cell.length > 0 || closedQuote) {
        throw new Error("A quote may only begin an empty CSV field.");
      }
      quoted = true;
    } else if (character === ",") {
      record.push(cell);
      cell = "";
      closedQuote = false;
    } else if (character === "\n" || character === "\r") {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
      closedQuote = false;
      if (character === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
    } else {
      cell += character;
    }
  }
  if (quoted) {
    throw new Error("The CSV file contains an unclosed quoted field.");
  }
  if (cell.length > 0 || record.length > 0) {
    record.push(cell);
    records.push(record);
  }

  const nonBlankRecords = records.filter((row) =>
    row.some((value) => value.trim().length > 0),
  );
  if (!nonBlankRecords.length) {
    throw new Error("The CSV file is empty.");
  }
  const headers = nonBlankRecords[0].map((value) => value.trim().toLowerCase());
  if (headers.length > 30) {
    throw new Error("The CSV file cannot contain more than 30 columns.");
  }
  if (headers.some((header) => !header)) {
    throw new Error("CSV column names cannot be blank.");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV column names must be unique.");
  }

  const rows = nonBlankRecords.slice(1);
  if (!rows.length) {
    throw new Error(
      `The CSV file does not contain any ${options.recordLabel ?? "data"} rows.`,
    );
  }
  const maxRows = options.maxRows ?? 500;
  if (rows.length > maxRows) {
    throw new Error(`A CSV import is limited to ${maxRows} rows.`);
  }
  if (rows.some((row) => row.length !== headers.length)) {
    throw new Error("Every CSV row must have the same number of columns.");
  }
  return { headers, rows };
}
