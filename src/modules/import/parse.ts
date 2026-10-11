import ExcelJS from "exceljs";

/** Una fila ya normalizada: encabezados en minúsculas y sin acentos -> texto. */
export type RawRow = Record<string, string>;

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel limita el cuerpo de la petición a ~4.5 MB)
export const MAX_ROWS = 2000;

export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cellToString(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((t) => t.text).join("").trim();
    }
    if (o.result !== undefined && o.result !== null) return String(o.result).trim();
    if (typeof o.text === "string") return o.text.trim();
    return "";
  }
  return String(v).trim();
}

/** CSV simple con comillas, BOM y separador "," o ";" (Excel en español usa ";"). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toRawRows(matrix: string[][]): RawRow[] {
  if (matrix.length < 2) return [];
  const headers = matrix[0].map(normalizeHeader);
  const out: RawRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (line.every((c) => c.trim() === "")) continue; // fila vacía
    const obj: RawRow = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = (line[idx] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}

/**
 * Lee un .xlsx o .csv y devuelve filas con encabezados normalizados.
 * Para .xlsx usa la hoja `sheetName` si existe; si no, la primera.
 */
export async function parseTable(
  buffer: Buffer,
  filename: string,
  sheetName: string
): Promise<RawRow[]> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("El archivo es muy grande (máximo 4 MB).");
  }
  const lower = filename.toLowerCase();

  let matrix: string[][];
  if (lower.endsWith(".csv")) {
    matrix = parseCsv(buffer.toString("utf8"));
  } else if (lower.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    } catch {
      throw new Error("No se pudo leer el Excel. Guárdalo de nuevo como .xlsx (o como .csv) e inténtalo otra vez.");
    }
    const ws =
      wb.worksheets.find((w) => normalizeHeader(w.name) === normalizeHeader(sheetName)) ??
      wb.worksheets.find((w) => normalizeHeader(w.name) !== "instrucciones") ??
      wb.worksheets[0];
    if (!ws) throw new Error("El archivo no tiene hojas.");

    matrix = [];
    const colCount = ws.columnCount;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const line: string[] = [];
      for (let c = 1; c <= colCount; c++) line.push(cellToString(row.getCell(c).value));
      matrix.push(line);
    });
  } else {
    throw new Error("Formato no soportado. Sube un archivo .xlsx o .csv.");
  }

  const rows = toRawRows(matrix);
  if (rows.length === 0) throw new Error("El archivo no tiene filas para importar.");
  if (rows.length > MAX_ROWS) {
    throw new Error(`El archivo tiene ${rows.length} filas; el máximo por importación es ${MAX_ROWS}.`);
  }
  return rows;
}

/** "$1,234.50" -> 1234.5 ; "85,50" -> 85.5 ; vacío -> undefined ; basura -> NaN */
export function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  let s = raw.replace(/[$\s]/g, "");
  if (s === "") return undefined;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function parseYesNo(raw: string | undefined): boolean | undefined {
  if (!raw) return undefined;
  const v = normalizeHeader(raw);
  if (["si", "s", "yes", "y", "true", "1", "activo"].includes(v)) return true;
  if (["no", "n", "false", "0", "inactivo"].includes(v)) return false;
  return undefined;
}
