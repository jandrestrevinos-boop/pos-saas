import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { cashReportService } from "@/modules/cash/report";

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
    if (existing) {
      // Si el día se abrió solo con la primera venta (fondo $0), el cajero todavía puede
      // registrar el fondo real; cualquier otro día abierto sigue siendo un error.
      if (existing.autoOpened) {
        return prisma.cashRegister.update({ where: { id: existing.id }, data: { openingCash, autoOpened: false } });
      }
      throw new Error("Ya hay una caja abierta en esta sucursal");
    }

    return prisma.cashRegister.create({ data: { branchId, openingCash, status: "OPEN" } });
  },

  /**
   * Garantiza que la sucursal tenga un día de caja abierto antes de vender/cobrar.
   * - Empresa con requireOpenCashDay: si no hay día abierto, NO deja vender (hay que abrir caja).
   * - Empresa sin esa opción (default): abre el día solo, con fondo $0, para que los cortes X/Z
   *   funcionen sin cambiar la forma de trabajar.
   */
  async ensureOpenDay(companyId: string, branchId: string, userId?: string) {
    const open = await prisma.cashRegister.findFirst({ where: { branchId, status: "OPEN" }, select: { id: true } });
    if (open) return open;

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { requireOpenCashDay: true } });
    if (company?.requireOpenCashDay) {
      throw new Error("Primero abre la caja del día: ve a Caja y registra el fondo inicial.");
    }

    let createdNow = false;
    const register = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"cash-open:" + branchId}))`;
      const again = await tx.cashRegister.findFirst({ where: { branchId, status: "OPEN" } });
      if (again) return again;
      createdNow = true;
      return tx.cashRegister.create({ data: { branchId, openingCash: 0, status: "OPEN", autoOpened: true } });
    });

    if (createdNow) {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId: userId ?? null,
          action: "CASH_OPEN",
          entity: "CashRegister",
          entityId: register.id,
          newData: { auto: true },
        },
      });
    }
    return { id: register.id };
  },

  async addMovement(registerId: string, userId: string, input: z.infer<typeof movementSchema>) {
    const register = await prisma.cashRegister.findUnique({ where: { id: registerId } });
    if (!register || register.status !== "OPEN") throw new Error("La caja no está abierta");

    return prisma.cashMovement.create({
      data: { cashRegisterId: registerId, userId, type: input.type, amount: input.amount, reason: input.reason },
    });
  },

  // Calcula lo vendido por método de pago desde que se abrió la caja, con los PAGOS
  // APROBADOS de ventas no canceladas de la sucursal (mismo criterio que los cortes X/Z,
  // para que el efectivo esperado de "Caja" y el de los reportes siempre coincidan).
  async computeSalesTotals(branchId: string, since: Date): Promise<PaymentTotals> {
    const payments = await prisma.payment.findMany({
      where: {
        status: "APPROVED",
        createdAt: { gte: since },
        order: { branchId, status: { not: "CANCELED" } },
      },
      select: { method: true, amount: true },
    });

    const totals: PaymentTotals = { cash: 0, card: 0, transfer: 0, other: 0 };
    for (const payment of payments) {
      const amount = Number(payment.amount);
      if (payment.method === "CASH") totals.cash += amount;
      else if (payment.method === "CARD") totals.card += amount;
      else if (payment.method === "TRANSFER") totals.transfer += amount;
      else totals.other += amount;
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

  /**
   * Corte Z: cierra el día de la sucursal. Calcula el reporte, bloquea si hay cuentas de mesa
   * abiertas o pagos de Mercado Pago sin confirmar, asigna un folio consecutivo por sucursal y
   * guarda el resumen congelado (zReport). Un Z ya hecho no se recalcula ni se edita.
   */
  async closeDay(input: { companyId: string; branchId: string; userId: string; userName: string; countedCash: number }) {
    const register = await this.getOpenRegister(input.branchId);
    if (!register) throw new Error("La caja no está abierta");

    const now = new Date();
    const preview = await cashReportService.build(register.id, {
      kind: "Z",
      upTo: now,
      counted: input.countedCash,
      generatedBy: input.userName,
    });

    if (preview.pending.openTabs > 0) {
      const n = preview.pending.openTabs;
      throw new Error(
        `No se puede hacer el corte: hay ${n} cuenta${n === 1 ? "" : "s"} de mesa abierta${n === 1 ? "" : "s"}. Cóbrala${n === 1 ? "" : "s"} o cancélala${n === 1 ? "" : "s"} primero.`
      );
    }
    if (preview.pending.pendingPayments > 0) {
      const n = preview.pending.pendingPayments;
      throw new Error(
        `No se puede hacer el corte: hay ${n} pago${n === 1 ? "" : "s"} de Mercado Pago sin confirmar. Verifícalo${n === 1 ? "" : "s"} o cancélalo${n === 1 ? "" : "s"} primero.`
      );
    }

    const closed = await prisma.$transaction(
      async (tx) => {
        // Un solo Z a la vez por sucursal: así el folio consecutivo nunca se repite.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"cash-z:" + input.branchId}))`;

        const fresh = await tx.cashRegister.findUnique({ where: { id: register.id }, select: { status: true } });
        if (!fresh || fresh.status !== "OPEN") throw new Error("Este día ya fue cerrado");

        const last = await tx.cashRegister.aggregate({ where: { branchId: input.branchId }, _max: { folio: true } });
        const folio = (last._max.folio ?? 0) + 1;
        const report = { ...preview, folio };

        const updated = await tx.cashRegister.update({
          where: { id: register.id },
          data: {
            status: "CLOSED",
            closedAt: now,
            countedCash: input.countedCash,
            expectedCash: preview.cash.expected,
            difference: preview.cash.difference,
            folio,
            zReport: report as unknown as Prisma.InputJsonValue,
          },
        });
        return { updated, report };
      },
      { timeout: 15000 }
    );

    return closed;
  },
};
