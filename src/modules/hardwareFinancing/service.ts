import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  computeFinancedBalance,
  computeLineItemTotals,
  buildInstallmentSchedule,
  buildRestructuredSchedule,
} from "./calculator";
import { encodeExternalReference } from "@/modules/mercadoPago/externalReference";

const lineItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "El nombre del producto es obligatorio"),
  catalogUnitPrice: z.coerce.number().min(0),
  negotiatedUnitPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().positive(),
});

export const createFinancingSchema = z.object({
  companyId: z.string().min(1),
  items: z.array(lineItemSchema).min(1, "Agrega al menos un producto de hardware"),
  discount: z.coerce.number().min(0).optional(),
  downPayment: z.coerce.number().min(0).optional(),
  financialCharge: z.coerce.number().min(0).optional(),
  interestRate: z.coerce.number().min(0).optional(),
  totalInstallments: z.coerce.number().int().positive(),
  periodicity: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
  firstPaymentDueDate: z.coerce.date(),
});

export type CreateFinancingInput = z.infer<typeof createFinancingSchema>;

async function generateFinancingCode(tx: typeof prisma): Promise<string> {
  const last = await tx.hardwareFinancing.findFirst({
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  const lastNumber = last ? parseInt(last.code.replace("HF-", ""), 10) : 0;
  return `HF-${String(lastNumber + 1).padStart(6, "0")}`;
}

export const hardwareFinancingService = {
  async list(companyId: string) {
    return prisma.hardwareFinancing.findMany({
      where: { companyId },
      include: { items: true, payments: { orderBy: { paymentNumber: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async get(id: string) {
    const financing = await prisma.hardwareFinancing.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { paymentNumber: "asc" } },
        restructuredFrom: { select: { id: true, code: true } },
        restructuredInto: { select: { id: true, code: true } },
      },
    });
    if (!financing) throw new Error("Financiamiento no encontrado");
    return financing;
  },

  /** Resumen para la ficha de la empresa (sección 15 de la spec). */
  async getActiveSummary(companyId: string) {
    const financings = await prisma.hardwareFinancing.findMany({
      where: { companyId, status: { in: ["PENDING", "ACTIVE", "PARTIALLY_PAID", "OVERDUE"] } },
      include: { payments: { orderBy: { paymentNumber: "asc" } }, items: true },
      orderBy: { createdAt: "desc" },
    });

    return financings.map((f) => {
      const nextPayment = f.payments.find((p) => p.status === "PENDING" || p.status === "OVERDUE");
      return {
        id: f.id,
        code: f.code,
        status: f.status,
        totalInstallments: f.totalInstallments,
        paymentsCompleted: f.paymentsCompleted,
        remainingBalance: Number(f.remainingBalance),
        nextPaymentDueDate: nextPayment?.dueDate ?? null,
        nextPaymentAmount: nextPayment ? Number(nextPayment.amount) : null,
        items: f.items.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          negotiatedUnitPrice: Number(i.negotiatedUnitPrice),
        })),
      };
    });
  },

  async create(createdById: string, input: CreateFinancingInput) {
    const { lines, hardwareListValue, negotiatedValue } = computeLineItemTotals(input.items);

    const discount = input.discount ?? 0;
    const downPayment = input.downPayment ?? 0;
    const financialCharge = input.financialCharge ?? 0;
    const interestRate = input.interestRate ?? 0;
    const periodicity = input.periodicity ?? "MONTHLY";

    const financedBalance = computeFinancedBalance({
      negotiatedValue,
      discount,
      downPayment,
      financialCharge,
      interestRate,
    });

    const schedule = buildInstallmentSchedule({
      financedBalance,
      totalInstallments: input.totalInstallments,
      periodicity,
      firstPaymentDueDate: input.firstPaymentDueDate,
    });

    return prisma.$transaction(async (tx) => {
      const code = await generateFinancingCode(tx as typeof prisma);

      const financing = await tx.hardwareFinancing.create({
        data: {
          code,
          companyId: input.companyId,
          createdById,
          status: "ACTIVE",
          periodicity,
          hardwareListValue,
          negotiatedValue,
          discount,
          downPayment,
          financialCharge,
          interestRate,
          financedBalance,
          totalInstallments: input.totalInstallments,
          installmentAmount: schedule.installmentAmount,
          firstPaymentDueDate: input.firstPaymentDueDate,
          finalPaymentDueDate: schedule.entries[schedule.entries.length - 1].dueDate,
          remainingBalance: financedBalance,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              catalogUnitPrice: line.catalogUnitPrice,
              negotiatedUnitPrice: line.negotiatedUnitPrice,
              quantity: line.quantity,
              subtotal: line.subtotal,
            })),
          },
        },
      });

      await tx.hardwareFinancingPayment.createMany({
        data: schedule.entries.map((entry) => ({
          financingId: financing.id,
          paymentNumber: entry.paymentNumber,
          dueDate: entry.dueDate,
          amount: entry.amount,
          status: "PENDING",
          externalReference: encodeExternalReference({
            kind: "hwfin",
            companyId: input.companyId,
            financingId: financing.id,
            paymentNumber: entry.paymentNumber,
          }),
        })),
      });

      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: createdById,
          action: "CREATE",
          entity: "HardwareFinancing",
          entityId: financing.id,
          newData: {
            code,
            hardwareListValue,
            negotiatedValue,
            discount,
            downPayment,
            financialCharge,
            interestRate,
            financedBalance,
            totalInstallments: input.totalInstallments,
            installmentAmount: schedule.installmentAmount,
          },
        },
      });

      return tx.hardwareFinancing.findUniqueOrThrow({
        where: { id: financing.id },
        include: { items: true, payments: true },
      });
    });
  },

  /** Liquidación anticipada del saldo pendiente (sección 11 de la spec). */
  async liquidateEarly(id: string, performedById: string, mercadoPagoPaymentId?: string) {
    return prisma.$transaction(async (tx) => {
      const financing = await tx.hardwareFinancing.findUniqueOrThrow({
        where: { id },
        include: { payments: true },
      });

      if (financing.status === "LIQUIDATED") throw new Error("Este financiamiento ya está liquidado.");
      if (financing.status === "CANCELLED") throw new Error("No se puede liquidar un financiamiento cancelado.");

      const pendingPayments = financing.payments.filter((p) => p.status === "PENDING" || p.status === "OVERDUE");
      const remainingBalance = Number(financing.remainingBalance);

      await tx.hardwareFinancingPayment.updateMany({
        where: { financingId: financing.id, id: { in: pendingPayments.map((p) => p.id) } },
        data: { status: "CANCELLED" },
      });

      const lastPaymentNumber = Math.max(...financing.payments.map((p) => p.paymentNumber), 0);

      await tx.hardwareFinancingPayment.create({
        data: {
          financingId: financing.id,
          paymentNumber: lastPaymentNumber + 1,
          dueDate: new Date(),
          amount: remainingBalance,
          status: "PAID",
          paidAt: new Date(),
          mercadoPagoPaymentId,
          externalReference: encodeExternalReference({
            kind: "hwfin",
            companyId: financing.companyId,
            financingId: financing.id,
            paymentNumber: lastPaymentNumber + 1,
          }),
        },
      });

      await tx.hardwareFinancing.update({
        where: { id: financing.id },
        data: {
          status: "LIQUIDATED",
          remainingBalance: 0,
          liquidatedAt: new Date(),
          paymentsCompleted: financing.totalInstallments,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: financing.companyId,
          userId: performedById,
          action: "EARLY_PAYOFF",
          entity: "HardwareFinancing",
          entityId: financing.id,
          previousData: { remainingBalance },
          newData: { remainingBalance: 0, status: "LIQUIDATED" },
        },
      });

      return tx.hardwareFinancing.findUniqueOrThrow({ where: { id: financing.id }, include: { payments: true, items: true } });
    });
  },

  /** Reestructuración: crea un nuevo financiamiento sobre el saldo restante. */
  async restructure(params: {
    id: string;
    performedById: string;
    newTotalInstallments: number;
    newPeriodicity?: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    newFirstPaymentDueDate: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const original = await tx.hardwareFinancing.findUniqueOrThrow({
        where: { id: params.id },
        include: { payments: true, items: true },
      });

      if (original.status === "LIQUIDATED" || original.status === "CANCELLED") {
        throw new Error("No se puede reestructurar un financiamiento liquidado o cancelado.");
      }

      const pendingPayments = original.payments.filter((p) => p.status === "PENDING" || p.status === "OVERDUE");
      await tx.hardwareFinancingPayment.updateMany({
        where: { financingId: original.id, id: { in: pendingPayments.map((p) => p.id) } },
        data: { status: "CANCELLED" },
      });

      const remainingBalance = Number(original.remainingBalance);
      const periodicity = params.newPeriodicity ?? original.periodicity;

      const schedule = buildRestructuredSchedule({
        remainingBalance,
        newTotalInstallments: params.newTotalInstallments,
        periodicity,
        firstPaymentDueDate: params.newFirstPaymentDueDate,
      });

      const code = await generateFinancingCode(tx as typeof prisma);

      const restructured = await tx.hardwareFinancing.create({
        data: {
          code,
          companyId: original.companyId,
          createdById: params.performedById,
          status: "ACTIVE",
          periodicity,
          hardwareListValue: original.hardwareListValue,
          negotiatedValue: original.negotiatedValue,
          financedBalance: remainingBalance,
          totalInstallments: params.newTotalInstallments,
          installmentAmount: schedule.installmentAmount,
          firstPaymentDueDate: params.newFirstPaymentDueDate,
          finalPaymentDueDate: schedule.entries[schedule.entries.length - 1].dueDate,
          remainingBalance,
          restructuredFromId: original.id,
          items: {
            create: original.items.map((item) => ({
              productId: item.productId ?? undefined,
              productName: item.productName,
              catalogUnitPrice: item.catalogUnitPrice,
              negotiatedUnitPrice: item.negotiatedUnitPrice,
              quantity: item.quantity,
              subtotal: item.subtotal,
            })),
          },
        },
      });

      await tx.hardwareFinancingPayment.createMany({
        data: schedule.entries.map((entry) => ({
          financingId: restructured.id,
          paymentNumber: entry.paymentNumber,
          dueDate: entry.dueDate,
          amount: entry.amount,
          status: "PENDING",
          externalReference: encodeExternalReference({
            kind: "hwfin",
            companyId: original.companyId,
            financingId: restructured.id,
            paymentNumber: entry.paymentNumber,
          }),
        })),
      });

      await tx.hardwareFinancing.update({ where: { id: original.id }, data: { status: "RESTRUCTURED" } });

      await tx.auditLog.create({
        data: {
          companyId: original.companyId,
          userId: params.performedById,
          action: "RESTRUCTURED",
          entity: "HardwareFinancing",
          entityId: original.id,
          newData: { restructuredIntoId: restructured.id, newTotalInstallments: params.newTotalInstallments },
        },
      });

      return tx.hardwareFinancing.findUniqueOrThrow({ where: { id: restructured.id }, include: { payments: true, items: true } });
    });
  },

  async cancel(id: string, performedById: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const financing = await tx.hardwareFinancing.findUniqueOrThrow({ where: { id }, include: { payments: true } });
      const pendingPayments = financing.payments.filter((p) => p.status === "PENDING" || p.status === "OVERDUE");

      await tx.hardwareFinancingPayment.updateMany({
        where: { financingId: financing.id, id: { in: pendingPayments.map((p) => p.id) } },
        data: { status: "CANCELLED" },
      });

      await tx.hardwareFinancing.update({ where: { id: financing.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });

      await tx.auditLog.create({
        data: {
          companyId: financing.companyId,
          userId: performedById,
          action: "CANCEL",
          entity: "HardwareFinancing",
          entityId: financing.id,
          newData: { reason: reason ?? null },
        },
      });

      return tx.hardwareFinancing.findUniqueOrThrow({ where: { id: financing.id }, include: { payments: true } });
    });
  },

  /**
   * Llamar desde companiesService.changePlan / setStatus (cancelación de
   * TAPI) cuando la empresa tiene financiamiento activo, únicamente para
   * dejar constancia en auditoría de que NO se tocó el financiamiento
   * (secciones 9 y 10 de la spec). No modifica nada de HardwareFinancing.
   */
  async logNoEffectEvent(companyId: string, action: "PLAN_CHANGED_NO_EFFECT" | "SUBSCRIPTION_CANCELLED_NO_EFFECT", metadata?: Record<string, unknown>) {
    const activeFinancings = await prisma.hardwareFinancing.findMany({
      where: { companyId, status: { in: ["ACTIVE", "PARTIALLY_PAID", "OVERDUE"] } },
      select: { id: true },
    });
    if (activeFinancings.length === 0) return;

    await prisma.auditLog.createMany({
      data: activeFinancings.map((f) => ({
        companyId,
        action,
        entity: "HardwareFinancing",
        entityId: f.id,
        newData: metadata ?? {},
      })),
    });
  },
};
