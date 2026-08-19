import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["PENDING", "IN_PREPARATION", "READY"] as const;

const NEXT_STATUS: Record<string, string> = {
  PENDING: "IN_PREPARATION",
  IN_PREPARATION: "READY",
  READY: "DELIVERED",
};

export const kitchenService = {
  async listActive(branchId: string) {
    return prisma.order.findMany({
      where: { branchId, status: { in: [...ACTIVE_STATUSES] } },
      include: {
        items: { include: { product: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async advanceStatus(companyId: string, orderId: string) {
    const order = await prisma.order.findFirst({ where: { id: orderId, companyId } });
    if (!order) throw new Error("Pedido no encontrado");

    const next = NEXT_STATUS[order.status];
    if (!next) throw new Error("Este pedido ya no puede avanzar de estatus");

    return prisma.order.update({ where: { id: orderId }, data: { status: next as never } });
  },

  /** La Pantalla de Cocina está disponible en todos los planes — la diferenciación de precio es por capacidad (usuarios/sucursales/cajas), no por funciones. El costo de implementación (hardware, instalación) se cotiza aparte del plan de software. */
  async isEnabledForCompany(companyId: string): Promise<boolean> {
    return true;
  },
};
