import { createHash } from "crypto";

/**
 * Lógica pura (sin base de datos) del checador de asistencia: zonas horarias, armado de
 * jornadas a partir de las marcas, retardos, faltas, horas extra estimadas y la cadena de hashes.
 *
 * Las horas extra son ESTIMADAS para apoyar la nómina; el pago final lo define el patrón
 * conforme a la Ley Federal del Trabajo.
 */

export const CONSENT_VERSION = 1;
export const SESSION_MAX_HOURS = 16; // una entrada sin salida después de esto se considera "salida olvidada"
export const MIN_SECONDS_BETWEEN_PUNCHES = 60;

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Monterrey", label: "Centro (Monterrey, CDMX, Guadalajara)" },
  { value: "America/Cancun", label: "Sureste (Cancún, Quintana Roo)" },
  { value: "America/Chihuahua", label: "Chihuahua" },
  { value: "America/Mazatlan", label: "Pacífico (Sinaloa, Nayarit, BCS)" },
  { value: "America/Hermosillo", label: "Sonora" },
  { value: "America/Tijuana", label: "Noroeste (Baja California)" },
];

/** Horas de jornada diaria por tipo de turno (LFT art. 60). */
export const DAILY_HOURS: Record<string, number> = { DIURNA: 8, NOCTURNA: 7, MIXTA: 7.5 };

/**
 * Reducción gradual de la jornada semanal (reforma de 2026) y tope semanal de horas extra.
 * Si la ley o las disposiciones de la STPS cambian estos valores, se ajustan solo aquí.
 */
export function weeklyLimits(year: number): { ordinaryHours: number; overtimeHours: number } {
  if (year <= 2026) return { ordinaryHours: 48, overtimeHours: 9 };
  if (year === 2027) return { ordinaryHours: 46, overtimeHours: 9 };
  if (year === 2028) return { ordinaryHours: 44, overtimeHours: 10 };
  if (year === 2029) return { ordinaryHours: 42, overtimeHours: 11 };
  return { ordinaryHours: 40, overtimeHours: 12 };
}

// ── Zona horaria ────────────────────────────────────────────────────────

export interface LocalParts {
  ymd: string; // AAAA-MM-DD en la zona de la empresa
  hour: number;
  minute: number;
  isoWeekday: number; // 1 = lunes ... 7 = domingo
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdays: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    isoWeekday: weekdays[get("weekday")] ?? 1,
  };
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const p = localParts(new Date(utcMs), timeZone);
  const [y, m, d] = p.ymd.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, p.hour, p.minute, 0);
  return asUtc - Math.floor(utcMs / 60000) * 60000;
}

/** Instante UTC que corresponde a "AAAA-MM-DD HH:mm" en la zona horaria dada. */
export function zonedToUtc(ymd: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi, 0);
  let utc = guess - tzOffsetMs(guess, timeZone);
  utc = guess - tzOffsetMs(utc, timeZone);
  return new Date(utc);
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Lunes de la semana (ISO) a la que pertenece la fecha. */
export function weekStart(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
  return addDays(ymd, -(wd - 1));
}

export function isoWeekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

// ── Cadena de hashes ───────────────────────────────────────────────────

export function recordHash(input: {
  prevHash: string | null;
  companyId: string;
  employeeId: string;
  kind: string;
  source: string;
  punchedAt: Date;
}): string {
  return createHash("sha256")
    .update(
      [input.prevHash ?? "", input.companyId, input.employeeId, input.kind, input.source, input.punchedAt.toISOString()].join("|")
    )
    .digest("hex");
}

/** Recalcula la cadena de un empleado (marcas en orden de captura). true = nadie alteró el historial. */
export function verifyChain(
  records: { companyId: string; employeeId: string; kind: string; source: string; punchedAt: Date; prevHash: string | null; hash: string }[]
): boolean {
  let prev: string | null = null;
  for (const r of records) {
    if ((r.prevHash ?? null) !== prev) return false;
    if (recordHash({ ...r, prevHash: prev }) !== r.hash) return false;
    prev = r.hash;
  }
  return true;
}

// ── Jornadas, retardos, faltas y horas extra ───────────────────────────

export interface PunchLite {
  kind: "IN" | "OUT";
  punchedAt: Date;
}

export interface WorkSession {
  inAt: Date | null;
  outAt: Date | null;
  minutes: number;
  flag: "OK" | "SIN_SALIDA" | "SIN_ENTRADA" | "EN_CURSO";
}

/** Empareja entradas con salidas (marcas no anuladas, ordenadas por hora). */
export function buildSessions(punches: PunchLite[], now: Date): WorkSession[] {
  const sorted = [...punches].sort((a, b) => a.punchedAt.getTime() - b.punchedAt.getTime());
  const sessions: WorkSession[] = [];
  let open: Date | null = null;

  const closeOpenWithoutOut = () => {
    if (!open) return;
    const stale = now.getTime() - open.getTime() > SESSION_MAX_HOURS * 3600_000;
    sessions.push({ inAt: open, outAt: null, minutes: 0, flag: stale ? "SIN_SALIDA" : "EN_CURSO" });
    open = null;
  };

  for (const p of sorted) {
    if (p.kind === "IN") {
      if (open) {
        sessions.push({ inAt: open, outAt: null, minutes: 0, flag: "SIN_SALIDA" });
      }
      open = p.punchedAt;
    } else if (open) {
      const minutes = Math.max(0, Math.round((p.punchedAt.getTime() - open.getTime()) / 60000));
      sessions.push({ inAt: open, outAt: p.punchedAt, minutes, flag: "OK" });
      open = null;
    } else {
      sessions.push({ inAt: null, outAt: p.punchedAt, minutes: 0, flag: "SIN_ENTRADA" });
    }
  }
  closeOpenWithoutOut();
  return sessions;
}

export interface EmployeeLite {
  shiftType: string;
  shiftStart: string | null;
  workDays: string;
  createdAt: Date;
}

export interface DaySummary {
  ymd: string;
  minutes: number;
  firstIn: Date | null;
  lateMinutes: number; // 0 = a tiempo
  absent: boolean;
  alerts: string[];
}

export interface WeekSummary {
  weekStart: string;
  minutes: number;
  overtimeMinutes: number; // estimadas
  alerts: string[];
}

export interface EmployeeSummary {
  days: DaySummary[];
  weeks: WeekSummary[];
  totalMinutes: number;
  daysWorked: number;
  lates: number;
  absences: number;
  overtimeMinutes: number;
  alerts: string[];
}

export function summarizeEmployee(
  employee: EmployeeLite,
  punches: PunchLite[],
  range: { from: string; to: string },
  opts: { timeZone: string; toleranceMinutes: number; now: Date }
): EmployeeSummary {
  const { timeZone, toleranceMinutes, now } = opts;
  const sessions = buildSessions(punches, now);
  const todayYmd = localParts(now, timeZone).ymd;
  const createdYmd = localParts(employee.createdAt, timeZone).ymd;
  const workDays = new Set(employee.workDays.split(",").map((n) => Number(n.trim())).filter(Boolean));
  const dailyMinutes = (DAILY_HOURS[employee.shiftType] ?? 8) * 60;

  const byDay = new Map<string, DaySummary>();
  const dayOf = (ymd: string) => {
    let d = byDay.get(ymd);
    if (!d) {
      d = { ymd, minutes: 0, firstIn: null, lateMinutes: 0, absent: false, alerts: [] };
      byDay.set(ymd, d);
    }
    return d;
  };

  for (const s of sessions) {
    const ref = s.inAt ?? s.outAt;
    if (!ref) continue;
    const ymd = localParts(ref, timeZone).ymd;
    if (ymd < range.from || ymd > range.to) continue;
    const day = dayOf(ymd);
    day.minutes += s.minutes;
    if (s.inAt && (!day.firstIn || s.inAt < day.firstIn)) day.firstIn = s.inAt;
    if (s.flag === "SIN_SALIDA" && !day.alerts.includes("SIN_SALIDA")) day.alerts.push("SIN_SALIDA");
    if (s.flag === "SIN_ENTRADA" && !day.alerts.includes("SIN_ENTRADA")) day.alerts.push("SIN_ENTRADA");
    if (s.flag === "EN_CURSO" && !day.alerts.includes("EN_CURSO")) day.alerts.push("EN_CURSO");
  }

  // Retardos y faltas por día programado.
  for (const ymd of eachDay(range.from, range.to)) {
    const scheduled = workDays.has(isoWeekdayOf(ymd));
    const day = byDay.get(ymd);
    if (day?.firstIn && employee.shiftStart && scheduled) {
      const first = localParts(day.firstIn, timeZone);
      const [sh, sm] = employee.shiftStart.split(":").map(Number);
      const late = first.hour * 60 + first.minute - (sh * 60 + sm);
      if (late > toleranceMinutes) day.lateMinutes = late;
    }
    if (scheduled && ymd < todayYmd && ymd >= createdYmd && (!day || !day.firstIn)) {
      dayOf(ymd).absent = true;
    }
    if (day && day.minutes > 12 * 60 && !day.alerts.includes("EXCEDE_12H")) day.alerts.push("EXCEDE_12H");
  }

  const days = Array.from(byDay.values()).sort((a, b) => a.ymd.localeCompare(b.ymd));

  // Semanas: horas, horas extra estimadas y topes legales.
  const weekMap = new Map<string, { minutes: number; dailyExtra: number }>();
  for (const d of days) {
    const wk = weekStart(d.ymd);
    const w = weekMap.get(wk) ?? { minutes: 0, dailyExtra: 0 };
    w.minutes += d.minutes;
    w.dailyExtra += Math.max(0, d.minutes - dailyMinutes);
    weekMap.set(wk, w);
  }
  const weeks: WeekSummary[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, w]) => {
      const limits = weeklyLimits(Number(wk.slice(0, 4)));
      const weeklyExcess = Math.max(0, w.minutes - limits.ordinaryHours * 60);
      const overtimeMinutes = Math.max(w.dailyExtra, weeklyExcess);
      const alerts: string[] = [];
      if (overtimeMinutes > limits.overtimeHours * 60) alerts.push("EXCEDE_TOPE_EXTRA_SEMANAL");
      return { weekStart: wk, minutes: w.minutes, overtimeMinutes, alerts };
    });

  const alerts = Array.from(new Set([...days.flatMap((d) => d.alerts), ...weeks.flatMap((w) => w.alerts)]));
  return {
    days,
    weeks,
    totalMinutes: days.reduce((n, d) => n + d.minutes, 0),
    daysWorked: days.filter((d) => d.minutes > 0 || d.firstIn).length,
    lates: days.filter((d) => d.lateMinutes > 0).length,
    absences: days.filter((d) => d.absent).length,
    overtimeMinutes: weeks.reduce((n, w) => n + w.overtimeMinutes, 0),
    alerts,
  };
}

export const ALERT_LABELS: Record<string, string> = {
  SIN_SALIDA: "Salida olvidada",
  SIN_ENTRADA: "Salida sin entrada",
  EN_CURSO: "Jornada en curso",
  EXCEDE_12H: "Más de 12 h en un día",
  EXCEDE_TOPE_EXTRA_SEMANAL: "Excede tope semanal de horas extra",
};

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

export function formatLocalDateTime(date: Date, timeZone: string): { date: string; time: string } {
  const p = localParts(date, timeZone);
  const sec = new Intl.DateTimeFormat("en-GB", { timeZone, second: "2-digit" }).format(date);
  return { date: p.ymd, time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:${sec.padStart(2, "0")}` };
}

export const CONSENT_TEXT = `Aviso y aceptación del registro electrónico de asistencia

Tu empleador registra tu jornada de trabajo de forma electrónica, como lo establece la Ley Federal del Trabajo (art. 132, fracción XXXIV).

Qué datos se guardan al checar: tu número de empleado, la fecha y hora de tu entrada y salida y una fotografía tomada en ese momento. La fotografía sirve únicamente para comprobar que fuiste tú quien checó; no se usa reconocimiento facial.

Para qué se usan: llevar el control de tu jornada, calcular horas trabajadas, retardos y horas extra, y atender requerimientos de la autoridad laboral.

Tus derechos: puedes pedir a tu empleador acceso, corrección u oposición al tratamiento de tus datos. Tu PIN es personal: no lo compartas, porque cualquier marca hecha con él se te atribuye.

Al aceptar, estás de acuerdo en que este sistema (número de empleado, PIN y fotografía) sea el medio para registrar tu asistencia.`;
