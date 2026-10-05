import { prisma } from "@/lib/prisma";

/** Horas que una caja puede seguir abierta antes de avisar (turno olvidado sin cerrar). */
export const CASH_OPEN_ALERT_HOURS = 14;

export type StockAlert = {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  level: "OUT" | "LOW";
};

export type CashAlert = {
  id: string;
  branchName: string;
  openedAt: string;
  hoursOpen: number;
};

/**
 * Alertas operativas de una empresa, calculadas al momento (sin cron):
 *  - Sin existencia: producto que controla inventario y ya está en 0.
 *  - Stock bajo: existencia <= mínimo configurado (solo si el mínimo > 0).
 *  - Caja abierta demasiado tiempo: turno que se quedó sin cerrar.
 */
export const alertsService = {
  async getAlerts(companyId: string) {
    const [products, openRegisters] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, isActive: true, tracksInventory: true },
        select: { id: true, name: true, stock: true, minStock: true, category: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.cashRegister.findMany({
        where: { status: "OPEN", branch: { companyId } },
        select: { id: true, openedAt: true, branch: { select: { name: true } } },
      }),
    ]);

    const stockAlerts: StockAlert[] = [];
    for (const p of products) {
      if (p.stock <= 0) {
        stockAlerts.push({ id: p.id, name: p.name, category: p.category.name, stock: p.stock, minStock: p.minStock, level: "OUT" });
      } else if (p.minStock > 0 && p.stock <= p.minStock) {
        stockAlerts.push({ id: p.id, name: p.name, category: p.category.name, stock: p.stock, minStock: p.minStock, level: "LOW" });
      }
    }
    // Primero los agotados, luego los bajos
    stockAlerts.sort((a, b) => (a.level === b.level ? a.name.localeCompare(b.name) : a.level === "OUT" ? -1 : 1));

    const now = Date.now();
    const cashAlerts: CashAlert[] = openRegisters
      .map((r) => ({
        id: r.id,
        branchName: r.branch.name,
        openedAt: r.openedAt.toISOString(),
        hoursOpen: Math.floor((now - r.openedAt.getTime()) / 3_600_000),
      }))
      .filter((r) => r.hoursOpen >= CASH_OPEN_ALERT_HOURS);

    return { stockAlerts, cashAlerts, total: stockAlerts.length + cashAlerts.length };
  },

  async count(companyId: string): Promise<number> {
    return (await this.getAlerts(companyId)).total;
  },
};
