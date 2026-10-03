import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { computeBillingAccess, addMonths, addDays, type BillingAccess } from "@/lib/billing";
import { platformSettingsService } from "@/modules/platformSettings/service";

/**
 * Cobro mensual de la suscripción de TAPI (software) — el dinero entra a la
 * cuenta de Mercado Pago de JOSE (token de plataforma en MP_PLATFORM_ACCESS_TOKEN),
 * NO a la de cada restaurante (esas son las de MercadoPagoAccount, vía OAuth).
 *
 * Modelo: Suscripciones de Mercado Pago (/preapproval). El restaurante autoriza
 * una vez el cargo recurrente mensual; Mercado Pago cobra solo cada mes y nos
 * avisa por webhook (/api/billing/webhook). Cada aviso se VERIFICA consultando
 * a Mercado Pago con nuestro token (nunca confiamos en el body del webhook),
 * y los pagos son idempotentes por mpPaymentId.
 *
 * El acceso NO depende de un cron: se calcula con fechas (ver src/lib/billing.ts).
 */

const MP_API = "https://api.mercadopago.com";

function requirePlatformToken(): string {
  const token = process.env.MP_PLATFORM_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Falta configurar MP_PLATFORM_ACCESS_TOKEN (token de la cuenta de Mercado Pago de Jose) en las variables de entorno");
  }
  return token;
}

function appBaseUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const redirect = process.env.MERCADOPAGO_REDIRECT_URI;
  if (redirect) return redirect.replace("/api/mercadopago/oauth/callback", "").replace(/\/$/, "");
  throw new Error("Falta configurar APP_URL (ej. https://www.tappysoftware.com) en las variables de entorno");
}

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requirePlatformToken()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mercado Pago respondió ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

interface MpPreapproval {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  external_reference?: string;
  init_point?: string;
}

interface MpAuthorizedPayment {
  id: number | string;
  preapproval_id?: string;
  status?: string; // scheduled | processed | recycling | cancelled
  transaction_amount?: number;
  payment?: { id?: number | string; status?: string };
}

export const manualPaymentSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(1),
  amountMxn: z.coerce.number().min(0).optional(),
  note: z.string().max(200).optional(),
});

export const checkoutSchema = z.object({
  payerEmail: z.string().email("Escribe el correo de la cuenta de Mercado Pago con la que vas a pagar"),
});

type SubWithPlan = {
  id: string;
  companyId: string;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  trialEndsAt: Date | null;
  renewalDate: Date | null;
  useCustomPlan: boolean;
  customPriceMxn: unknown;
  plan: { name: string; priceMxn: unknown };
};

/** Precio mensual real que paga la empresa (personalizado si lo tiene). */
export function effectivePriceMxn(sub: Pick<SubWithPlan, "useCustomPlan" | "customPriceMxn" | "plan">): number {
  if (sub.useCustomPlan && sub.customPriceMxn !== null && sub.customPriceMxn !== undefined) {
    return Number(sub.customPriceMxn);
  }
  return Number(sub.plan.priceMxn);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export const billingService = {
  /** ¿Puede esta empresa usar Tappy hoy? Se llama desde layout/POS/cocina. */
  async getAccess(companyId: string): Promise<BillingAccess> {
    const [company, settings] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          status: true,
          subscription: { select: { status: true, trialEndsAt: true, renewalDate: true } },
        },
      }),
      platformSettingsService.get(),
    ]);

    if (!company) {
      return computeBillingAccess({ companyStatus: "CANCELLED", subscription: null, graceDays: settings.graceDays });
    }

    return computeBillingAccess({
      companyStatus: company.status,
      subscription: company.subscription,
      graceDays: settings.graceDays,
    });
  },

  /** Todo lo que necesita la pantalla /facturacion. */
  async getOverview(companyId: string) {
    const [company, access] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          status: true,
          subscription: { include: { plan: true } },
        },
      }),
      this.getAccess(companyId),
    ]);
    if (!company) throw new Error("Empresa no encontrada");

    const payments = await prisma.subscriptionPayment.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const sub = company.subscription;
    return {
      companyName: company.name,
      companyStatus: company.status,
      planName: sub?.plan.name ?? null,
      priceMxn: sub ? effectivePriceMxn(sub) : null,
      hasRecurringCharge: !!sub?.mpPreapprovalId,
      access: {
        state: access.state,
        allowed: access.allowed,
        endsAt: access.endsAt ? access.endsAt.toISOString() : null,
        graceEndsAt: access.graceEndsAt ? access.graceEndsAt.toISOString() : null,
        daysLeft: access.daysLeft,
        graceDaysLeft: access.graceDaysLeft,
        blockReason: access.blockReason ?? null,
      },
      payments: payments.map((p) => ({
        id: p.id,
        amountMxn: Number(p.amountMxn),
        status: p.status,
        method: p.method,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        periodEnd: p.periodEnd ? p.periodEnd.toISOString() : null,
        note: p.note,
      })),
    };
  },

  /**
   * Crea la suscripción recurrente en Mercado Pago y devuelve el link donde
   * el restaurante autoriza el pago. Si todavía está en demo, el primer cobro
   * se programa para el día que termina el demo (start_date).
   */
  async createCheckout(companyId: string, userId: string, input: z.infer<typeof checkoutSchema>) {
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true, company: true },
    });
    if (!sub) throw new Error("Esta empresa no tiene una suscripción registrada");
    if (sub.company.status !== "ACTIVE") {
      throw new Error("Tu cuenta está suspendida. Contacta a soporte de Tappy.");
    }

    const price = effectivePriceMxn(sub);
    if (!(price > 0)) {
      throw new Error("Tu plan no tiene un precio mensual configurado. Contacta a soporte de Tappy.");
    }

    if (sub.mpPreapprovalId) {
      const existing = await mpFetch<MpPreapproval>(`/preapproval/${sub.mpPreapprovalId}`).catch(() => null);
      if (existing?.status === "authorized") {
        throw new Error("Ya tienes un cobro automático activo. Si necesitas cambiarlo, contacta a soporte de Tappy.");
      }
    }

    // Fecha del primer cobro: fin del demo (o del periodo ya pagado) si todavía está en el futuro.
    const now = new Date();
    const firstChargeAt = sub.status === "TRIALING" ? sub.trialEndsAt : sub.renewalDate;
    const startDate = firstChargeAt && firstChargeAt.getTime() > now.getTime() + 60 * 60 * 1000 ? firstChargeAt : null;

    const created = await mpFetch<MpPreapproval>("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: `Tappy ${sub.plan.name} — ${sub.company.name}`,
        external_reference: `tappysub:${companyId}`,
        payer_email: input.payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: price,
          currency_id: "MXN",
          ...(startDate ? { start_date: startDate.toISOString() } : {}),
        },
        back_url: `${appBaseUrl()}/facturacion?retorno=1`,
        status: "pending",
      }),
    });

    if (!created.init_point) {
      throw new Error("Mercado Pago no devolvió el link de pago");
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { mpPreapprovalId: created.id, payerEmail: input.payerEmail },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "SUBSCRIPTION_CHECKOUT_CREATED",
        entity: "Subscription",
        entityId: sub.id,
        newData: { preapprovalId: created.id, amountMxn: price, firstChargeAt: startDate ? startDate.toISOString() : null },
      },
    });

    return { checkoutUrl: created.init_point };
  },

  /**
   * Punto de entrada del webhook. `topic` y `resourceId` vienen del aviso de
   * Mercado Pago, pero lo único que usamos de ahí es el id: todo lo demás se
   * consulta a Mercado Pago con nuestro token.
   */
  async handleNotification(topic: string, resourceId: string) {
    if (topic === "subscription_preapproval" || topic === "preapproval") {
      return this.syncPreapproval(resourceId);
    }
    if (topic === "subscription_authorized_payment") {
      return this.processAuthorizedPayment(resourceId);
    }
    return { skipped: true as const };
  },

  async syncPreapproval(preapprovalId: string) {
    const pre = await mpFetch<MpPreapproval>(`/preapproval/${preapprovalId}`);
    const sub = await prisma.subscription.findUnique({ where: { mpPreapprovalId: preapprovalId } });
    if (!sub) return { skipped: true as const, reason: "preapproval desconocido" };

    await prisma.auditLog.create({
      data: {
        companyId: sub.companyId,
        action: `SUBSCRIPTION_PREAPPROVAL_${pre.status.toUpperCase()}`,
        entity: "Subscription",
        entityId: sub.id,
        newData: { preapprovalId, status: pre.status },
      },
    });
    // Cancelar/pausar el cobro automático NO corta el acceso: el acceso
    // sigue hasta renewalDate (+ gracia). Solo queda registrado.
    return { ok: true as const, status: pre.status };
  },

  async processAuthorizedPayment(authorizedPaymentId: string) {
    const ap = await mpFetch<MpAuthorizedPayment>(`/authorized_payments/${authorizedPaymentId}`);
    if (!ap.preapproval_id) return { skipped: true as const, reason: "sin preapproval_id" };

    const sub = await prisma.subscription.findUnique({
      where: { mpPreapprovalId: ap.preapproval_id },
      include: { plan: true },
    });
    if (!sub) return { skipped: true as const, reason: "preapproval desconocido" };

    const paymentStatus = ap.payment?.status;

    if (paymentStatus === "approved") {
      const mpPaymentId = String(ap.payment?.id ?? `auth:${ap.id}`);
      const amount = typeof ap.transaction_amount === "number" ? ap.transaction_amount : effectivePriceMxn(sub);
      return this.recordApprovedPayment({
        sub,
        amountMxn: amount,
        method: "MERCADOPAGO",
        mpPaymentId,
        months: 1,
      });
    }

    if (paymentStatus === "rejected" || ap.status === "recycling") {
      if (sub.status === "ACTIVE") {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE" } });
      }
      await prisma.auditLog.create({
        data: {
          companyId: sub.companyId,
          action: "SUBSCRIPTION_PAYMENT_REJECTED",
          entity: "Subscription",
          entityId: sub.id,
          newData: { authorizedPaymentId: String(ap.id), status: ap.status ?? null, paymentStatus: paymentStatus ?? null },
        },
      });
      return { ok: true as const, rejected: true as const };
    }

    return { skipped: true as const, reason: "pago aún sin resolver" };
  },

  /**
   * Registra un pago aprobado (Mercado Pago o manual) y mueve "pagado hasta".
   * El periodo arranca en el MAYOR entre hoy y el fin del demo/periodo actual,
   * así pagar antes de tiempo nunca regala ni quita días.
   */
  async recordApprovedPayment(params: {
    sub: SubWithPlan;
    amountMxn: number;
    method: "MERCADOPAGO" | "MANUAL";
    mpPaymentId?: string;
    months: number;
    note?: string;
    performedById?: string;
  }) {
    const { sub } = params;

    if (params.mpPaymentId) {
      const existing = await prisma.subscriptionPayment.findUnique({ where: { mpPaymentId: params.mpPaymentId } });
      if (existing) return { ok: true as const, duplicate: true as const };
    }

    const now = new Date();
    const currentEnd = sub.status === "TRIALING" ? sub.trialEndsAt : sub.renewalDate;
    const periodStart = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
    const periodEnd = addMonths(periodStart, params.months);

    try {
      await prisma.$transaction([
        prisma.subscriptionPayment.create({
          data: {
            companyId: sub.companyId,
            subscriptionId: sub.id,
            amountMxn: params.amountMxn,
            status: "APPROVED",
            method: params.method,
            mpPaymentId: params.mpPaymentId ?? null,
            periodStart,
            periodEnd,
            paidAt: now,
            note: params.note ?? null,
          },
        }),
        prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "ACTIVE", renewalDate: periodEnd },
        }),
        prisma.auditLog.create({
          data: {
            companyId: sub.companyId,
            userId: params.performedById ?? null,
            action: params.method === "MANUAL" ? "SUBSCRIPTION_PAYMENT_MANUAL" : "SUBSCRIPTION_PAYMENT_APPROVED",
            entity: "Subscription",
            entityId: sub.id,
            newData: {
              amountMxn: params.amountMxn,
              months: params.months,
              periodEnd: periodEnd.toISOString(),
              mpPaymentId: params.mpPaymentId ?? null,
              note: params.note ?? null,
            },
          },
        }),
      ]);
    } catch (err) {
      // Dos avisos simultáneos del mismo pago: el segundo choca con el índice único.
      if (isUniqueViolation(err)) return { ok: true as const, duplicate: true as const };
      throw err;
    }

    return { ok: true as const, periodEnd: periodEnd.toISOString() };
  },

  /** Super Admin: pago recibido por fuera (SPEI, efectivo...). */
  async markManualPayment(companyId: string, performedById: string, input: z.infer<typeof manualPaymentSchema>) {
    const sub = await prisma.subscription.findUnique({ where: { companyId }, include: { plan: true } });
    if (!sub) throw new Error("Esta empresa no tiene una suscripción registrada");
    if (sub.status === "CANCELED") throw new Error("La suscripción está cancelada");

    const amount = input.amountMxn ?? effectivePriceMxn(sub) * input.months;
    return this.recordApprovedPayment({
      sub,
      amountMxn: amount,
      method: "MANUAL",
      months: input.months,
      note: input.note,
      performedById,
    });
  },

  /** Super Admin: alargar (o fijar, si no tenía fecha) el demo de una empresa en TRIALING. */
  async extendTrial(companyId: string, performedById: string, days: number) {
    const sub = await prisma.subscription.findUnique({ where: { companyId } });
    if (!sub) throw new Error("Esta empresa no tiene una suscripción registrada");
    if (sub.status !== "TRIALING") {
      throw new Error("Solo se puede extender el demo de una empresa que sigue en demo");
    }

    const now = new Date();
    const base = sub.trialEndsAt && sub.trialEndsAt.getTime() > now.getTime() ? sub.trialEndsAt : now;
    const trialEndsAt = addDays(base, days);

    await prisma.subscription.update({ where: { id: sub.id }, data: { trialEndsAt } });
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: performedById,
        action: "SUBSCRIPTION_TRIAL_EXTENDED",
        entity: "Subscription",
        entityId: sub.id,
        previousData: { trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null },
        newData: { trialEndsAt: trialEndsAt.toISOString(), days },
      },
    });

    return { trialEndsAt };
  },
};
