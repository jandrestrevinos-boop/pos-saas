import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { resolveBranchId, type TenantContext } from "@/lib/tenant-context";

/**
 * Qué sucursales revisa cada quien: quien administra sucursales ve las de toda la
 * empresa (undefined = todas); el resto, solo la sucursal donde opera.
 */
export async function alertBranchScope(ctx: TenantContext, companyId: string): Promise<string[] | undefined> {
  if (hasPermission(ctx.permissions, PERMISSIONS.BRANCHES_MANAGE)) return undefined;
  const branchId = await resolveBranchId(ctx, companyId);
  return branchId ? [branchId] : [];
}

/** Horas que una caja puede seguir abierta antes de avisar (turno olvidado sin cerrar). */
export const CASH_OPEN_ALERT_HOURS = 14;

export type StockAlert = {
  id: string; // productId:branchId (único por producto y sucursal)
  name: string;
  category: string;
  branchName: string;
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
 *  - Sin existencia / stock bajo: por PRODUCTO Y SUCURSAL (la existencia real es por sucursal).
 *  - Caja abierta demasiado tiempo: turno que se quedó sin cerrar.
 *
 * `branchIds`: limita las alertas a esas sucursales (quien no administra sucursales
 * solo ve las de la suya). Sin él, se revisan todas las sucursales activas.
 */
export const alertsService = {
  async getAlerts(companyId: string, branchIds?: string[]) {
    const [products, branches, openRegisters] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, isActive: true, tracksInventory: true },
        select: {
          id: true,
          name: true,
          minStock: true,
          category: { select: { name: true } },
          branchStocks: { select: { branchId: true, stock: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.branch.findMany({
        where: { companyId, isActive: true, ...(branchIds ? { id: { in: branchIds } } : {}) },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.cashRegister.findMany({
        where: { status: "OPEN", branch: { companyId, ...(branchIds ? { id: { in: branchIds } } : {}) } },
        select: { id: true, openedAt: true, branch: { select: { name: true } } },
      }),
    ]);

    const stockAlerts: StockAlert[] = [];
    for (const p of products) {
      for (const b of branches) {
        const stock = p.branchStocks.find((s) => s.branchId === b.id)?.stock ?? 0;
        const base = { id: `${p.id}:${b.id}`, name: p.name, category: p.category.name, branchName: b.name, stock, minStock: p.minStock };
        if (stock <= 0) stockAlerts.push({ ...base, level: "OUT" });
        else if (p.minStock > 0 && stock <= p.minStock) stockAlerts.push({ ...base, level: "LOW" });
      }
    }
    // Primero los agotados, luego los bajos
    stockAlerts.sort((a, b) =>
      a.level === b.level ? a.name.localeCompare(b.name) || a.branchName.localeCompare(b.branchName) : a.level === "OUT" ? -1 : 1
    );

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

  async count(companyId: string, branchIds?: string[]): Promise<number> {
    return (await this.getAlerts(companyId, branchIds)).total;
  },
};
