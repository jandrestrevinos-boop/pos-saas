import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["PENDING", "IN_PREPARATION", "READY"] as const;

const NEXT_STATUS: Record<string, string> = {
  PENDING: "IN_PREPARATION",
  IN_PREPARATION: "READY",
  READY: "DELIVERED",
};

export const kitchenService = {
  /**
   * Cada "ticket" que ve cocina es una RONDA (orderId + roundNumber), no la
   * orden completa. Así, en una mesa con cuenta abierta, una ronda nueva no
   * vuelve a mostrar los productos de rondas anteriores ya entregadas — cada
   * ronda vive y avanza de estatus por su cuenta. Mostrador siempre tiene
   * una sola ronda (roundNumber = 1).
   */
  async listActive(branchId: string) {
    const items = await prisma.orderItem.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        order: {
          branchId,
          // No manda a cocina una orden de Mercado Pago cuyo cobro todavía
          // no se confirma — evita que se empiece a preparar algo que el
          // cliente podría no llegar a pagar. No afecta CASH/CARD/TRANSFER/
          // OTHER, que siempre nacen ya aprobados (ver Payment.status default).
          payments: { none: { method: { in: ["MERCADOPAGO", "MERCADOPAGO_TERMINAL"] }, status: "PENDING" } },
        },
      },
      include: {
        product: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            user: { select: { name: true } },
            table: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    type TicketItem = (typeof items)[number];
    type Ticket = {
      id: string; // `${orderId}:${roundNumber}` — lo que usa el botón de avanzar
      orderId: string;
      orderNumber: number;
      roundNumber: number;
      tableName: string | null;
      userName: string;
      status: string;
      createdAt: Date;
      items: TicketItem[];
    };

    const ticketsByKey = new Map<string, Ticket>();
    for (const item of items) {
      const key = `${item.orderId}:${item.roundNumber}`;
      let ticket = ticketsByKey.get(key);
      if (!ticket) {
        ticket = {
          id: key,
          orderId: item.orderId,
          orderNumber: item.order.orderNumber,
          roundNumber: item.roundNumber,
          tableName: item.order.table?.name ?? null,
          userName: item.order.user.name,
          status: item.status,
          createdAt: item.createdAt,
          items: [],
        };
        ticketsByKey.set(key, ticket);
      }
      ticket.items.push(item);
      // Todos los renglones de una misma ronda siempre avanzan juntos (ver
      // advanceRound), pero si alguno se quedó atrás por cualquier motivo,
      // el ticket se queda en el estatus menos avanzado para no perderlo.
      if (ACTIVE_STATUSES.indexOf(item.status as (typeof ACTIVE_STATUSES)[number]) <
        ACTIVE_STATUSES.indexOf(ticket.status as (typeof ACTIVE_STATUSES)[number])) {
        ticket.status = item.status;
      }
    }

    return Array.from(ticketsByKey.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  },

  /** Avanza de estatus TODOS los renglones de una ronda juntos (un ticket = una acción). */
  async advanceRound(companyId: string, orderId: string, roundNumber: number) {
    const order = await prisma.order.findFirst({ where: { id: orderId, companyId } });
    if (!order) throw new Error("Pedido no encontrado");

    const roundItems = await prisma.orderItem.findMany({ where: { orderId, roundNumber } });
    if (roundItems.length === 0) throw new Error("Ronda no encontrada");

    const current = roundItems[0].status;
    const next = NEXT_STATUS[current];
    if (!next) throw new Error("Esta ronda ya no puede avanzar de estatus");

    await prisma.orderItem.updateMany({
      where: { orderId, roundNumber },
      data: { status: next as never },
    });

    return { orderId, roundNumber, status: next };
  },

  /** La Pantalla de Cocina está disponible en todos los planes — la diferenciación de precio es por capacidad (usuarios/sucursales/cajas), no por funciones. El costo de implementación (hardware, instalación) se cotiza aparte del plan de software. */
  async isEnabledForCompany(companyId: string): Promise<boolean> {
    return true;
  },
};
