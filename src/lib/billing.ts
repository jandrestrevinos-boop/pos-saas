/**
 * Lógica pura (sin base de datos) de "¿esta empresa puede usar Tappy hoy?".
 *
 * Todo se calcula con FECHAS, no con un cron: el estado nunca se queda
 * desfasado. Cuando vence el demo o el periodo pagado, el acceso se corta
 * solo al pasar la fecha (+ días de gracia), y un pago aprobado simplemente
 * mueve la fecha hacia adelante.
 *
 *   DEMO     empresa en TRIALING con trialEndsAt vigente
 *   ACTIVE   suscripción pagada con renewalDate ("pagado hasta") vigente
 *   GRACE    ya venció, pero aún está dentro de los días de gracia (sigue operando, con aviso)
 *   BLOCKED  venció y se acabó la gracia, o la suscripción está cancelada, o la empresa fue suspendida
 *
 * Empresas "legacy" (sin trialEndsAt / sin renewalDate) NO se bloquean:
 * Jose decide su fecha desde Super Admin (extender demo / registrar pago).
 */

export type BillingState = "DEMO" | "ACTIVE" | "GRACE" | "BLOCKED";

export type BillingBlockReason = "COMPANY_INACTIVE" | "CANCELED" | "EXPIRED";

export interface BillingAccess {
  state: BillingState;
  allowed: boolean;
  /** Fin del demo o del periodo pagado (null = sin fecha, empresa legacy). */
  endsAt: Date | null;
  /** Hasta cuándo dura la gracia (endsAt + graceDays). */
  graceEndsAt: Date | null;
  /** Días enteros que faltan para endsAt (negativo si ya venció). null si no hay fecha. */
  daysLeft: number | null;
  /** Días que faltan para que se bloquee (solo en GRACE). */
  graceDaysLeft: number | null;
  blockReason?: BillingBlockReason;
}

export interface BillingInput {
  companyStatus: "ACTIVE" | "SUSPENDED" | "CANCELLED";
  subscription: {
    status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
    trialEndsAt: Date | null;
    renewalDate: Date | null;
  } | null;
  graceDays: number;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeBillingAccess(input: BillingInput): BillingAccess {
  const now = input.now ?? new Date();

  if (input.companyStatus !== "ACTIVE") {
    return {
      state: "BLOCKED",
      allowed: false,
      endsAt: null,
      graceEndsAt: null,
      daysLeft: null,
      graceDaysLeft: null,
      blockReason: "COMPANY_INACTIVE",
    };
  }

  const sub = input.subscription;

  // Sin suscripción registrada: no bloqueamos (dato legacy).
  if (!sub) {
    return { state: "ACTIVE", allowed: true, endsAt: null, graceEndsAt: null, daysLeft: null, graceDaysLeft: null };
  }

  if (sub.status === "CANCELED") {
    return {
      state: "BLOCKED",
      allowed: false,
      endsAt: sub.renewalDate,
      graceEndsAt: null,
      daysLeft: null,
      graceDaysLeft: null,
      blockReason: "CANCELED",
    };
  }

  const isTrial = sub.status === "TRIALING";
  const endsAt = isTrial ? sub.trialEndsAt : sub.renewalDate;

  // Sin fecha: no hay nada que vencer.
  if (!endsAt) {
    return {
      state: isTrial ? "DEMO" : "ACTIVE",
      allowed: true,
      endsAt: null,
      graceEndsAt: null,
      daysLeft: null,
      graceDaysLeft: null,
    };
  }

  const graceEndsAt = new Date(endsAt.getTime() + Math.max(0, input.graceDays) * DAY_MS);
  const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS);

  if (now.getTime() <= endsAt.getTime()) {
    return {
      state: isTrial ? "DEMO" : "ACTIVE",
      allowed: true,
      endsAt,
      graceEndsAt,
      daysLeft,
      graceDaysLeft: null,
    };
  }

  if (now.getTime() <= graceEndsAt.getTime()) {
    return {
      state: "GRACE",
      allowed: true,
      endsAt,
      graceEndsAt,
      daysLeft,
      graceDaysLeft: Math.ceil((graceEndsAt.getTime() - now.getTime()) / DAY_MS),
    };
  }

  return {
    state: "BLOCKED",
    allowed: false,
    endsAt,
    graceEndsAt,
    daysLeft,
    graceDaysLeft: 0,
    blockReason: "EXPIRED",
  };
}

/** Suma meses de calendario sin desbordar (31 ene + 1 mes = 28/29 feb, no 3 mar). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
