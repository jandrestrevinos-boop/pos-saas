import bcrypt from "bcryptjs";
import { put } from "@vercel/blob";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  CONSENT_VERSION,
  MIN_SECONDS_BETWEEN_PUNCHES,
  SESSION_MAX_HOURS,
  TIMEZONES,
  addDays,
  formatLocalDateTime,
  localParts,
  recordHash,
  summarizeEmployee,
  verifyChain,
  zonedToUtc,
  type EmployeeSummary,
} from "@/lib/attendance";
import { toCsv } from "@/lib/csv";

const MAX_PIN_FAILS = 5;
const LOCK_MINUTES = 10;
const GENERIC_LOGIN_ERROR = "Número de empleado o PIN incorrecto";

const pinSchema = z.string().regex(/^\d{4,6}$/, "El PIN debe tener de 4 a 6 números");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (usa HH:mm)");
const workDaysSchema = z
  .array(z.number().int().min(1).max(7))
  .min(1, "Elige al menos un día de trabajo")
  .transform((days) => Array.from(new Set(days)).sort().join(","));

const codeSchema = z
  .number({ invalid_type_error: "El número de empleado debe ser un número" })
  .int("El número de empleado debe ser un número entero")
  .min(1, "El número de empleado debe ser 1 o mayor")
  .max(999999, "El número de empleado es demasiado grande");

export const employeeCreateSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80),
  position: z.string().trim().max(60).optional().nullable(),
  branchId: z.string().min(1, "Elige la sucursal"),
  pin: pinSchema,
  shiftType: z.enum(["DIURNA", "NOCTURNA", "MIXTA"]).default("DIURNA"),
  shiftStart: hhmm.optional().nullable(),
  workDays: workDaysSchema.default([1, 2, 3, 4, 5, 6]),
});

export const employeeUpdateSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().trim().min(2).max(80).optional(),
  position: z.string().trim().max(60).optional().nullable(),
  branchId: z.string().min(1).optional(),
  pin: pinSchema.optional(),
  shiftType: z.enum(["DIURNA", "NOCTURNA", "MIXTA"]).optional(),
  shiftStart: hhmm.optional().nullable(),
  workDays: workDaysSchema.optional(),
  isActive: z.boolean().optional(),
});

export const settingsSchema = z.object({
  timezone: z.string().refine((tz) => TIMEZONES.some((t) => t.value === tz), "Zona horaria no válida"),
  requirePhoto: z.boolean(),
  lateToleranceMinutes: z.number().int().min(0).max(60),
});

export interface PunchPhoto {
  buf: Buffer;
  type: string;
  ext: string;
}

export type PunchResult =
  | { needsConsent: true; employeeName: string }
  | {
      needsConsent?: false;
      kind: "IN" | "OUT";
      employeeName: string;
      punchedAt: string;
      sessionMinutes: number | null;
    };

export interface ReportFilters {
  from: string; // AAAA-MM-DD (zona de la empresa)
  to: string;
  employeeId?: string;
  branchId?: string;
}

function rangeToInstants(f: ReportFilters, tz: string) {
  return { start: zonedToUtc(f.from, "00:00", tz), end: zonedToUtc(addDays(f.to, 1), "00:00", tz) };
}

async function audit(
  companyId: string,
  userId: string | null,
  action: string,
  entityId: string,
  previousData: object | null,
  newData: object | null
) {
  await prisma.auditLog.create({
    data: {
      companyId,
      userId,
      action,
      entity: "AttendanceRecord",
      entityId,
      previousData: previousData ?? undefined,
      newData: newData ?? undefined,
    },
  });
}

export const attendanceService = {
  // ── Configuración ───────────────────────────────────────────────────
  async getSettings(companyId: string) {
    return prisma.attendanceSettings.upsert({ where: { companyId }, update: {}, create: { companyId } });
  },

  async updateSettings(companyId: string, input: z.infer<typeof settingsSchema>) {
    return prisma.attendanceSettings.upsert({ where: { companyId }, update: input, create: { companyId, ...input } });
  },

  // ── Empleados ───────────────────────────────────────────────────────
  async listEmployees(companyId: string) {
    const rows = await prisma.employee.findMany({
      where: { companyId },
      include: { branch: { select: { name: true } } },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
    // Nunca se manda el hash del PIN al navegador.
    return rows.map(({ pinHash: _pinHash, pinFailedCount: _f, ...rest }) => rest);
  },

  async createEmployee(companyId: string, input: z.infer<typeof employeeCreateSchema>) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, companyId }, select: { id: true } });
    if (!branch) throw new Error("La sucursal no es válida");
    const pinHash = await bcrypt.hash(input.pin, 10);

    const data = {
      companyId,
      branchId: input.branchId,
      name: input.name,
      position: input.position || null,
      pinHash,
      shiftType: input.shiftType,
      shiftStart: input.shiftStart || null,
      workDays: input.workDays,
    };

    // Número de empleado capturado a mano: debe estar libre en la empresa.
    if (input.code !== undefined) {
      const taken = await prisma.employee.findUnique({ where: { companyId_code: { companyId, code: input.code } }, select: { id: true } });
      if (taken) throw new Error(`El número de empleado ${input.code} ya está en uso`);
      try {
        const created = await prisma.employee.create({ data: { ...data, code: input.code } });
        return { id: created.id, code: created.code };
      } catch {
        throw new Error(`El número de empleado ${input.code} ya está en uso`);
      }
    }

    // Sin número capturado: el siguiente consecutivo por empresa; si dos altas chocan, se reintenta.
    for (let attempt = 0; attempt < 3; attempt++) {
      const last = await prisma.employee.findFirst({ where: { companyId }, orderBy: { code: "desc" }, select: { code: true } });
      try {
        const created = await prisma.employee.create({ data: { ...data, code: (last?.code ?? 0) + 1 } });
        return { id: created.id, code: created.code };
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
    throw new Error("No se pudo crear el empleado");
  },

  async updateEmployee(companyId: string, id: string, input: z.infer<typeof employeeUpdateSchema>) {
    const employee = await prisma.employee.findFirst({ where: { id, companyId }, select: { id: true, code: true } });
    if (!employee) throw new Error("Empleado no encontrado");
    if (input.code !== undefined && input.code !== employee.code) {
      const taken = await prisma.employee.findUnique({ where: { companyId_code: { companyId, code: input.code } }, select: { id: true } });
      if (taken) throw new Error(`El número de empleado ${input.code} ya está en uso`);
    }
    if (input.branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: input.branchId, companyId }, select: { id: true } });
      if (!branch) throw new Error("La sucursal no es válida");
    }
    const { pin, ...rest } = input;
    await prisma.employee.update({
      where: { id },
      data: {
        ...rest,
        position: rest.position === undefined ? undefined : rest.position || null,
        shiftStart: rest.shiftStart === undefined ? undefined : rest.shiftStart || null,
        ...(pin ? { pinHash: await bcrypt.hash(pin, 10), pinFailedCount: 0, pinLockedUntil: null } : {}),
      },
    });
  },

  // ── Quiosco: checar ─────────────────────────────────────────────────
  async punch(params: {
    companyId: string;
    deviceUserId: string;
    branchId: string;
    ip: string | null;
    code: number;
    pin: string;
    acceptConsent: boolean;
    photo: PunchPhoto | null;
  }): Promise<PunchResult> {
    const { companyId } = params;
    const now = new Date();
    const settings = await this.getSettings(companyId);

    const employee = await prisma.employee.findUnique({ where: { companyId_code: { companyId, code: params.code } } });
    if (!employee || !employee.isActive) throw new Error(GENERIC_LOGIN_ERROR);

    if (employee.pinLockedUntil && employee.pinLockedUntil > now) {
      const mins = Math.ceil((employee.pinLockedUntil.getTime() - now.getTime()) / 60000);
      throw new Error(`Demasiados intentos. Intenta de nuevo en ${mins} min o pide ayuda a tu gerente.`);
    }

    const pinOk = await bcrypt.compare(params.pin, employee.pinHash);
    if (!pinOk) {
      const fails = employee.pinFailedCount + 1;
      await prisma.employee.update({
        where: { id: employee.id },
        data:
          fails >= MAX_PIN_FAILS
            ? { pinFailedCount: 0, pinLockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000) }
            : { pinFailedCount: fails },
      });
      throw new Error(GENERIC_LOGIN_ERROR);
    }
    if (employee.pinFailedCount > 0 || employee.pinLockedUntil) {
      await prisma.employee.update({ where: { id: employee.id }, data: { pinFailedCount: 0, pinLockedUntil: null } });
    }

    // Aceptación del empleado (primera vez, o si cambió la versión del aviso).
    if (!employee.consentAcceptedAt || (employee.consentVersion ?? 0) < CONSENT_VERSION) {
      if (!params.acceptConsent) return { needsConsent: true, employeeName: employee.name };
      await prisma.employee.update({
        where: { id: employee.id },
        data: { consentAcceptedAt: now, consentVersion: CONSENT_VERSION },
      });
    }

    if (settings.requirePhoto && !params.photo) {
      throw new Error("No se pudo tomar la foto. Permite el acceso a la cámara e intenta de nuevo.");
    }

    // Entrada o salida: la decide el servidor según la última marca vigente.
    const last = await prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, voidedAt: null },
      orderBy: { punchedAt: "desc" },
    });
    if (last && (now.getTime() - last.punchedAt.getTime()) / 1000 < MIN_SECONDS_BETWEEN_PUNCHES) {
      throw new Error("Ya checaste hace un momento. Espera un minuto.");
    }
    const kind: "IN" | "OUT" =
      last && last.kind === "IN" && now.getTime() - last.punchedAt.getTime() <= SESSION_MAX_HOURS * 3600_000 ? "OUT" : "IN";

    let photoUrl: string | null = null;
    if (params.photo) {
      try {
        const blob = await put(`${companyId}/attendance/${employee.id}.${params.photo.ext}`, params.photo.buf, {
          access: "public",
          addRandomSuffix: true,
          contentType: params.photo.type,
        });
        photoUrl = blob.url;
      } catch (e) {
        console.error("Error subiendo foto del checador", e);
        if (settings.requirePhoto) throw new Error("No se pudo guardar la foto. Intenta de nuevo.");
      }
    }

    await prisma.$transaction(async (tx) => {
      const prev = await tx.attendanceRecord.findFirst({
        where: { employeeId: employee.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { hash: true },
      });
      await tx.attendanceRecord.create({
        data: {
          companyId,
          employeeId: employee.id,
          branchId: params.branchId,
          kind,
          source: "KIOSK",
          punchedAt: now,
          photoUrl,
          deviceUserId: params.deviceUserId,
          ipAddress: params.ip,
          prevHash: prev?.hash ?? null,
          hash: recordHash({
            prevHash: prev?.hash ?? null,
            companyId,
            employeeId: employee.id,
            kind,
            source: "KIOSK",
            punchedAt: now,
          }),
        },
      });
    });

    return {
      kind,
      employeeName: employee.name,
      punchedAt: now.toISOString(),
      sessionMinutes: kind === "OUT" && last ? Math.round((now.getTime() - last.punchedAt.getTime()) / 60000) : null,
    };
  },

  // ── Registros y correcciones ────────────────────────────────────────
  async listRecords(companyId: string, f: ReportFilters) {
    const settings = await this.getSettings(companyId);
    const { start, end } = rangeToInstants(f, settings.timezone);
    return prisma.attendanceRecord.findMany({
      where: {
        companyId,
        punchedAt: { gte: start, lt: end },
        ...(f.employeeId ? { employeeId: f.employeeId } : {}),
        ...(f.branchId ? { branchId: f.branchId } : {}),
      },
      include: { employee: { select: { name: true, code: true } }, branch: { select: { name: true } } },
      orderBy: { punchedAt: "desc" },
      take: 2000,
    });
  },

  /** Marca olvidada: se agrega como MANUAL, con motivo obligatorio y huella en la auditoría. */
  async addManual(
    companyId: string,
    userId: string,
    input: { employeeId: string; kind: "IN" | "OUT"; date: string; time: string; note: string }
  ) {
    const settings = await this.getSettings(companyId);
    const employee = await prisma.employee.findFirst({ where: { id: input.employeeId, companyId } });
    if (!employee) throw new Error("Empleado no encontrado");
    const punchedAt = zonedToUtc(input.date, input.time, settings.timezone);
    if (punchedAt.getTime() > Date.now() + 5 * 60000) throw new Error("No se pueden capturar marcas en el futuro");

    const created = await prisma.$transaction(async (tx) => {
      const prev = await tx.attendanceRecord.findFirst({
        where: { employeeId: employee.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { hash: true },
      });
      return tx.attendanceRecord.create({
        data: {
          companyId,
          employeeId: employee.id,
          branchId: employee.branchId,
          kind: input.kind,
          source: "MANUAL",
          punchedAt,
          note: input.note,
          createdById: userId,
          prevHash: prev?.hash ?? null,
          hash: recordHash({
            prevHash: prev?.hash ?? null,
            companyId,
            employeeId: employee.id,
            kind: input.kind,
            source: "MANUAL",
            punchedAt,
          }),
        },
      });
    });
    await audit(companyId, userId, "ATTENDANCE_MANUAL", created.id, null, {
      employee: employee.name,
      kind: input.kind,
      punchedAt: punchedAt.toISOString(),
      note: input.note,
    });
    return created;
  },

  /** Una marca equivocada NO se borra: se anula y queda guardada con quién y por qué. */
  async voidRecord(companyId: string, userId: string, recordId: string, reason: string) {
    const rec = await prisma.attendanceRecord.findFirst({ where: { id: recordId, companyId } });
    if (!rec) throw new Error("Marca no encontrada");
    if (rec.voidedAt) throw new Error("Esta marca ya está anulada");
    await prisma.attendanceRecord.update({
      where: { id: rec.id },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
    });
    await audit(
      companyId,
      userId,
      "ATTENDANCE_VOID",
      rec.id,
      { kind: rec.kind, punchedAt: rec.punchedAt.toISOString(), source: rec.source },
      { reason }
    );
  },

  // ── Reporte ─────────────────────────────────────────────────────────
  async report(companyId: string, f: ReportFilters) {
    const settings = await this.getSettings(companyId);
    const tz = settings.timezone;
    const now = new Date();
    const { start, end } = rangeToInstants(f, tz);

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        ...(f.employeeId ? { id: f.employeeId } : {}),
        ...(f.branchId ? { branchId: f.branchId } : {}),
      },
      include: { branch: { select: { name: true } } },
      orderBy: { code: "asc" },
    });

    // Se piden marcas con un día de margen en cada extremo para emparejar jornadas que cruzan medianoche.
    const marginMs = 24 * 3600_000;
    const records = await prisma.attendanceRecord.findMany({
      where: {
        companyId,
        employeeId: { in: employees.map((e) => e.id) },
        punchedAt: { gte: new Date(start.getTime() - marginMs), lt: new Date(end.getTime() + marginMs) },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const rows = await Promise.all(
      employees.map(async (emp) => {
      const mine = records.filter((r) => r.employeeId === emp.id);
      const valid = mine.filter((r) => !r.voidedAt).map((r) => ({ kind: r.kind, punchedAt: r.punchedAt }));
      const summary: EmployeeSummary = summarizeEmployee(emp, valid, f, { timeZone: tz, toleranceMinutes: settings.lateToleranceMinutes, now });
      return {
        employeeId: emp.id,
        code: emp.code,
        name: emp.name,
        position: emp.position,
        branch: emp.branch.name,
        isActive: emp.isActive,
        totalMinutes: summary.totalMinutes,
        daysWorked: summary.daysWorked,
        lates: summary.lates,
        absences: summary.absences,
        overtimeMinutes: summary.overtimeMinutes,
        alerts: summary.alerts,
        chainOk: await this.chainOk(emp.id),
      };
      })
    );
    return { timezone: tz, rows };
  },

  /** Verifica la cadena completa del empleado (todas sus marcas, no solo el periodo). */
  async chainOk(employeeId: string) {
    const all = await prisma.attendanceRecord.findMany({
      where: { employeeId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { companyId: true, employeeId: true, kind: true, source: true, punchedAt: true, prevHash: true, hash: true },
    });
    return verifyChain(all);
  },

  // ── Exportación (CSV para Excel) ────────────────────────────────────
  async exportSummaryCsv(companyId: string, f: ReportFilters) {
    const { rows } = await this.report(companyId, f);
    const hours = (m: number) => Math.round((m / 60) * 100) / 100;
    return toCsv(
      ["No.", "Empleado", "Puesto", "Sucursal", "Del", "Al", "Días con asistencia", "Horas trabajadas", "Retardos", "Faltas", "Horas extra estimadas", "Alertas", "Integridad del registro"],
      rows.map((r) => [
        r.code,
        r.name,
        r.position ?? "",
        r.branch,
        f.from,
        f.to,
        r.daysWorked,
        hours(r.totalMinutes),
        r.lates,
        r.absences,
        hours(r.overtimeMinutes),
        r.alerts.join(" | "),
        r.chainOk ? "Verificada" : "ALTERADA",
      ])
    );
  },

  async exportRecordsCsv(companyId: string, f: ReportFilters) {
    const settings = await this.getSettings(companyId);
    const records = await this.listRecords(companyId, f);
    const chronological = [...records].reverse();
    return toCsv(
      ["Fecha", "Hora", "No.", "Empleado", "Sucursal", "Tipo", "Origen", "Motivo (captura manual)", "Foto", "Anulada", "Motivo de anulación", "Hash"],
      chronological.map((r) => {
        const t = formatLocalDateTime(r.punchedAt, settings.timezone);
        return [
          t.date,
          t.time,
          r.employee.code,
          r.employee.name,
          r.branch.name,
          r.kind === "IN" ? "Entrada" : "Salida",
          r.source === "KIOSK" ? "Quiosco" : "Manual",
          r.note ?? "",
          r.photoUrl ?? "",
          r.voidedAt ? "Sí" : "No",
          r.voidReason ?? "",
          r.hash,
        ];
      })
    );
  },

  /** Hoy en la zona de la empresa (AAAA-MM-DD). */
  async todayYmd(companyId: string) {
    const settings = await this.getSettings(companyId);
    return localParts(new Date(), settings.timezone).ymd;
  },
};
