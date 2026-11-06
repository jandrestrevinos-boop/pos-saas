import { z } from "zod";
import type { ReportFilters } from "./service";

const ymd = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 93;

/** Lee ?from=&to=&employeeId=&branchId= de la URL y valida el rango (máx. ~3 meses). */
export function parseFilters(url: URL): ReportFilters | { error: string } {
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!ymd.test(from) || !ymd.test(to)) return { error: "Fechas no válidas (usa AAAA-MM-DD)" };
  if (from > to) return { error: "La fecha inicial no puede ser posterior a la final" };
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (days > MAX_RANGE_DAYS) return { error: "El rango máximo es de 3 meses" };
  return {
    from,
    to,
    employeeId: url.searchParams.get("employeeId") || undefined,
    branchId: url.searchParams.get("branchId") || undefined,
  };
}

export const manualRecordSchema = z.object({
  employeeId: z.string().min(1, "Elige al empleado"),
  kind: z.enum(["IN", "OUT"]),
  date: z.string().regex(ymd, "Fecha inválida"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida"),
  note: z.string().trim().min(5, "Escribe el motivo (mínimo 5 letras)").max(300),
});

export const voidSchema = z.object({
  reason: z.string().trim().min(5, "Escribe el motivo (mínimo 5 letras)").max(300),
});
