import { prisma } from "@/lib/prisma";

/**
 * Combina el cargo de software (Subscription → Plan.priceMxn) con las
 * mensualidades de hardware que vencen en el periodo. Software y hardware
 * siguen viviendo en tablas separadas; esto solo los junta para
 * presentación/cobro del periodo (secciones 4, 8 y 17 de la spec).
 */
export async function getMonthlyChargeBreakdown(params: {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId: params.companyId },
    include: { plan: true },
  });

  // Si la empresa tiene un plan personalizado (acuerdo comercial especial),
  // se usa su precio negociado en vez del precio de catálogo del plan.
  const effectivePrice =
    subscription?.useCustomPlan && subscription.customPriceMxn != null
      ? Number(subscription.customPriceMxn)
      : subscription
      ? Number(subscription.plan.priceMxn)
      : 0;

  const softwareCharge = subscription?.status === "ACTIVE" ? effectivePrice : 0;
  const softwareChargeLabel = subscription?.plan.name ?? "Sin plan activo";

  const duePayments = await prisma.hardwareFinancingPayment.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { gte: params.periodStart, lt: params.periodEnd },
      financing: { companyId: params.companyId },
    },
    include: { financing: true },
    orderBy: { dueDate: "asc" },
  });

  const hardwareCharges = duePayments.map((p) => ({
    financingId: p.financingId,
    financingCode: p.financing.code,
    paymentNumber: p.paymentNumber,
    totalInstallments: p.financing.totalInstallments,
    amount: Number(p.amount),
  }));

  const total = softwareCharge + hardwareCharges.reduce((sum, h) => sum + h.amount, 0);

  return {
    companyId: params.companyId,
    period: params.periodStart.toISOString().slice(0, 7),
    softwareCharge,
    softwareChargeLabel,
    hardwareCharges,
    total,
  };
}

/** Cron diario: marca OVERDUE lo que ya venció sin pagar. No genera cargos. */
export async function markOverdueHardwarePayments(now: Date = new Date()) {
  const overduePayments = await prisma.hardwareFinancingPayment.findMany({
    where: { status: "PENDING", dueDate: { lt: now } },
  });
  if (overduePayments.length === 0) return { updated: 0 };

  await prisma.hardwareFinancingPayment.updateMany({
    where: { id: { in: overduePayments.map((p) => p.id) } },
    data: { status: "OVERDUE" },
  });

  const affectedFinancingIds = [...new Set(overduePayments.map((p) => p.financingId))];

  await prisma.hardwareFinancing.updateMany({
    where: { id: { in: affectedFinancingIds }, status: { in: ["ACTIVE", "PARTIALLY_PAID"] } },
    data: { status: "OVERDUE" },
  });

  await prisma.auditLog.createMany({
    data: affectedFinancingIds.map((financingId) => ({
      action: "PAYMENT_MARKED_OVERDUE",
      entity: "HardwareFinancing",
      entityId: financingId,
      newData: {
        overduePaymentIds: overduePayments.filter((p) => p.financingId === financingId).map((p) => p.id),
      },
    })),
  });

  return { updated: overduePayments.length };
}

/**
 * Salvaguarda a nivel de motor de facturación (sección 16 de la spec):
 * antes de cobrar, vuelve a verificar en BD que el financiamiento sigue
 * activo. Evita que un bug de interfaz genere un cobro sobre algo ya
 * liquidado/cancelado.
 */
export async function assertPaymentIsChargeable(paymentId: string) {
  const payment = await prisma.hardwareFinancingPayment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { financing: true },
  });

  const financingIsClosed = ["LIQUIDATED", "CANCELLED", "RESTRUCTURED"].includes(financing_status(payment));
  const paymentIsChargeable = payment.status === "PENDING" || payment.status === "OVERDUE";

  if (financingIsClosed || !paymentIsChargeable) {
    throw new Error(
      `Bloqueado: el pago ${paymentId} no debe cobrarse (financiamiento ${payment.financing.status}, pago ${payment.status}).`
    );
  }

  return payment;
}

function financing_status(payment: { financing: { status: string } }) {
  return payment.financing.status;
}
