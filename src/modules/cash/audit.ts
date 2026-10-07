import { prisma } from "@/lib/prisma";

type RegisterRow = {
  id: string;
  branchId: string;
  branch: { name: string };
  openedAt: Date;
  closedAt: Date | null;
  status: string;
  openingCash: number | string;
  countedCash: number | string | null;
  expectedCash: number | string | null;
  difference: number | string | null;
  movements: {
    id: string;
    type: string;
    amount: number | string;
    reason: string | null;
    createdAt: Date;
    user: { name: string };
  }[];
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

export const cashAuditService = {
  /**
   * Turnos de caja del rango, con quién abrió y quién cerró cada uno (se lee del
   * AuditLog: CASH_OPEN / CASH_CLOSE ya guardan el usuario, así que los turnos
   * anteriores también quedan atribuidos), más resumen de faltantes/sobrantes.
   */
  async report(companyId: string, opts: { from: Date; to: Date; branchId?: string }) {
    const registers = (await prisma.cashRegister.findMany({
      where: {
        branch: { companyId },
        openedAt: { gte: opts.from, lte: opts.to },
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
      },
      include: {
        branch: { select: { name: true } },
        movements: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { openedAt: "desc" },
      take: 500,
    })) as unknown as RegisterRow[];

    const ids = registers.map((r) => r.id);
    const logs = (ids.length
      ? await prisma.auditLog.findMany({
          where: {
            companyId,
            entity: "CashRegister",
            action: { in: ["CASH_OPEN", "CASH_CLOSE"] },
            entityId: { in: ids },
          },
          select: { entityId: true, action: true, userId: true },
        })
      : []) as unknown as { entityId: string | null; action: string; userId: string | null }[];

    const userIds = [...new Set(logs.map((l) => l.userId).filter((u): u is string => !!u))];
    const users = (userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : []) as unknown as { id: string; name: string }[];
    const userName = new Map(users.map((u) => [u.id, u.name]));

    const openedBy = new Map<string, string>();
    const closedBy = new Map<string, string>();
    for (const log of logs) {
      if (!log.entityId || !log.userId) continue;
      const name = userName.get(log.userId);
      if (!name) continue;
      (log.action === "CASH_OPEN" ? openedBy : closedBy).set(log.entityId, name);
    }

    const rows = registers.map((r) => {
      const cashIn = r.movements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + Number(m.amount), 0);
      const cashOut = r.movements
        .filter((m) => m.type === "CASH_OUT" || m.type === "REFUND")
        .reduce((s, m) => s + Number(m.amount), 0);
      return {
        id: r.id,
        branchName: r.branch.name,
        openedAt: r.openedAt.toISOString(),
        closedAt: r.closedAt ? r.closedAt.toISOString() : null,
        status: r.status as "OPEN" | "CLOSED",
        openedBy: openedBy.get(r.id) ?? null,
        closedBy: closedBy.get(r.id) ?? null,
        openingCash: Number(r.openingCash),
        expectedCash: num(r.expectedCash),
        countedCash: num(r.countedCash),
        difference: num(r.difference),
        cashIn,
        cashOut,
        movements: r.movements.map((m) => ({
          id: m.id,
          type: m.type,
          amount: Number(m.amount),
          reason: m.reason,
          user: m.user.name,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    });

    const closed = rows.filter((r) => r.status === "CLOSED" && r.difference !== null);
    const withDifference = closed.filter((r) => Math.abs(r.difference ?? 0) >= 0.01);
    const totalShortage = closed.reduce((s, r) => s + Math.min(r.difference ?? 0, 0), 0);
    const totalOverage = closed.reduce((s, r) => s + Math.max(r.difference ?? 0, 0), 0);

    const cashierMap = new Map<string, { name: string; shifts: number; difference: number }>();
    for (const r of closed) {
      const name = r.closedBy ?? "Sin dato";
      const cur = cashierMap.get(name) ?? { name, shifts: 0, difference: 0 };
      cur.shifts += 1;
      cur.difference += r.difference ?? 0;
      cashierMap.set(name, cur);
    }

    return {
      summary: {
        closedCount: closed.length,
        openCount: rows.filter((r) => r.status === "OPEN").length,
        withDifferenceCount: withDifference.length,
        totalShortage,
        totalOverage,
      },
      byCashier: [...cashierMap.values()].sort((a, b) => a.difference - b.difference),
      registers: rows,
    };
  },
};
