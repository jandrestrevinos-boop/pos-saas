/**
 * Utilidades CSV para exportar información.
 *  - BOM UTF-8 al inicio: sin él Excel en español muestra mal los acentos.
 *  - Comillas dobles escapadas y saltos de línea dentro de celdas.
 *  - Protección contra "CSV injection": si un texto capturado por un usuario
 *    empieza con = + - @ (ej. un nombre de producto "=HYPERLINK(...)"), Excel
 *    lo ejecutaría como fórmula. Se le antepone un apóstrofo para que sea texto.
 */
export type CsvCell = string | number | boolean | Date | null | undefined;

function escapeCell(value: CsvCell, isText: boolean): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString().replace("T", " ").slice(0, 19) : String(value);
  if (isText && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [
    headers.map((h) => escapeCell(h, false)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCell(cell, typeof cell === "string")).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
