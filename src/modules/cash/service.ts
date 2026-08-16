import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const openRegisterSchema = z.object({
  openingCash: z.coerce.number().min(0),
});

export const movementSchema = z.object({
  type: z.enum(["CASH_IN", "CASH_OUT", "REFUND"]),
  amount: z.coerce.number().positive(),
  reason: z.string().optional(),
});

export const closeRegisterSchema = z.object({
  countedCash: z.coerce.number().min(0),
});

type PaymentTotals = { cash: number; card: number; transfer: number; other: number };

export const cashService = {
  async getOpenRegister(branchId: string) {
    return prisma.cashRegister.findFirst({
      where: { branchId, status: "OPEN" },
      include: { movements: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } } },
    });
  },

  async open(branchId: string, openingCash: number) {
    const existing = await prisma.cashRegister.findFirst({ where: { branchId, status: "OPEN" } });
    if (existing) throw new Error("Ya hay una caja abierta en esta sucursal");

    return prisma.cashRegister.create({ data: { branchId, openingCash, status: "OPEN" } });
  },

  async addMovement(registerId: string, userId: string, input: z.infer<typeof movementSchema>) {
    const register = await prisma.cashRegister.findUnique({ where: { id: registerId } });
    if (!register || register.status !== "OPEN") throw new Error("La caja no está abierta");

    return prisma.cashMovement.create({
      data: { cashRegisterId: registerId, userId, type: input.type, amount: input.amount, reason: input.reason },
    });
  },

  // Calcula lo vendido por método de pago desde que se abrió la caja,
  // usando las órdenes reales de la sucursal (nunca un número inventado).
  async computeSalesTotals(branchId: string, since: Date): Promise<PaymentTotals> {
    const orders = await prisma.order.findMany({
      where: { branchId, createdAt: { gte: since }, status: { not: "CANCELED" } },
      include: { payments: true },
    });

    const totals: PaymentTotals = { cash: 0, card: 0, transfer: 0, other: 0 };
    for (const order of orders) {
      for (const payment of order.payments) {
        const amount = Number(payment.amount);
        if (payment.method === "CASH") totals.cash += amount;
        else if (payment.method === "CARD") totals.card += amount;
        else if (payment.method === "TRANSFER") totals.transfer += amount;
        else totals.other += amount;
      }
    }
    return totals;
  },

  async getStatus(branchId: string) {
    const register = await this.getOpenRegister(branchId);
    if (!register) return { open: false as const };

    const salesTotals = await this.computeSalesTotals(branchId, register.openedAt);
    type MovementRow = { type: string; amount: number | string };
    const movements = register.movements as unknown as MovementRow[];
    const cashIn = movements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + Number(m.amount), 0);
    const cashOut = movements
      .filter((m) => m.type === "CASH_OUT" || m.type === "REFUND")
      .reduce((s, m) => s + Number(m.amount), 0);

    const expectedCash = Number(register.openingCash) + salesTotals.cash + cashIn - cashOut;

    return { open: true as const, register, salesTotals, expectedCash };
  },

  async close(registerId: string, branchId: string, countedCash: number) {
    const status = await this.getStatus(branchId);
    if (!status.open) throw new Error("La caja no está abierta");

    const difference = countedCash - status.expectedCash;

    return prisma.cashRegister.update({
      where: { id: registerId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        countedCash,
        expectedCash: status.expectedCash,
        difference,
      },
    });
  },
};