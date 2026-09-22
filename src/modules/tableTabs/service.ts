import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const addRoundSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .min(1, "El carrito está vacío"),
});

export const closeTabSchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER", "MERCADOPAGO", "MERCADOPAGO_TERMINAL"]),
  cashReceived: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).default(0),
});

/**
 * Caja tipo Mesa: a diferencia de Mostrador (una sola orden, se cobra de
 * inmediato), aquí una mesa abre UNA orden que va acumulando rondas de
 * productos — cada ronda se manda a cocina y se descuenta inventario en el
 * momento (igual que Mostrador), pero el pago se difiere hasta que alguien
 * cierra la cuenta. Table.currentOrderId apunta a esa orden mientras sigue
 * abierta; se limpia al cerrar.
 */
export const tableTabsService = {
  /** Abre la cuenta de una mesa, o regresa la que ya estaba abierta (idempotente — evita dos tabs abiertos a la vez en la misma mesa). */
  async open(companyId: string, branchId: string, userId: string, tableId: string) {
    const table = await prisma.table.findFirst({ where: { id: tableId, companyId, branchId } });
    if (!table) throw new Error("Mesa no encontrada");

    if (table.currentOrderId) {
      const existing = await prisma.order.findUnique({
        where: { id: table.currentOrderId },
        include: { items: { include: { product: true } } },
      });
      if (existing) return existing;
    }

    const order = await prisma.order.create({
      data: {
        localId: crypto.randomUUID(),
        companyId,
        branchId,
        userId,
        tableId,
        status: "PENDING",
        isOpenTab: true,
        orderType: "COMER_AQUI",
        subtotal: 0,
        discount: 0,
        tax: 0,
        total: 0,
      },
      include: { items: { include: { product: true } } },
    });

    await prisma.table.update({
      where: { id: tableId },
      data: { currentOrderId: order.id, status: "OCUPADA" },
    });

    return order;
  },

  /** El ticket abierto actual de una mesa (o null si está Libre). Usado por /tables y por el POS en modo mesa. */
  async getOpenOrder(companyId: string, tableId: string) {
    const table = await prisma.table.findFirst({ where: { id: tableId, companyId } });
    if (!table?.currentOrderId) return null;

    return prisma.order.findUnique({
      where: { id: table.currentOrderId },
      include: { items: { include: { product: true } } },
    });
  },

  /** Agrega una ronda de productos a una cuenta ya abierta. Manda a cocina y descuenta inventario de inmediato, igual que Mostrador — el pago sigue pendiente. */
  async addRound(companyId: string, branchId: string, userId: string, orderId: string, input: z.infer<typeof addRoundSchema>) {
    const order = await prisma.order.findFirst({ where: { id: orderId, companyId, isOpenTab: true } });
    if (!order) throw new Error("Esta mesa no tiene una cuenta abierta");

    const productIds = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, companyId, isActive: true },
    });
    if (products.length !== new Set(productIds).size) {
      throw new Error("Uno o más productos ya no están disponibles");
    }

    type MinimalProduct = { id: string; price: number | string };
    const productMap = new Map((products as unknown as MinimalProduct[]).map((p) => [p.id, p]));

    let roundSubtotal = 0;
    const orderItemsData = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * item.quantity;
      roundSubtotal += lineTotal;
      return { productId: product.id, quantity: item.quantity, unitPriceAtSale: unitPrice, lineTotal };
    });

    const newSubtotal = Number(order.subtotal) + roundSubtotal;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        items: { create: orderItemsData },
        subtotal: newSubtotal,
        total: newSubtotal - Number(order.discount),
        // Llegó comida nueva a la mesa: reabre el status para que cocina la
        // vea de nuevo, aunque ya hubiera entregado rondas anteriores.
        status: "PENDING",
      },
      include: { items: { include: { product: true } } },
    });

    const { inventoryService } = await import("@/modules/inventory/service");
    try {
      await inventoryService.deductForSale(branchId, userId, input.items);
    } catch {
      // El inventario es informativo; no debe bloquear que la ronda ya se mandó a cocina.
    }

    return updated;
  },

  /** Cierra la cuenta: cobra el total acumulado de todas las rondas y libera la mesa. */
  async close(companyId: string, orderId: string, userId: string, input: z.infer<typeof closeTabSchema>) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, companyId, isOpenTab: true },
      include: { items: true },
    });
    if (!order) throw new Error("Esta mesa no tiene una cuenta abierta");
    if (order.items.length === 0) throw new Error("La cuenta no tiene productos todavía");

    const subtotal = Number(order.subtotal);
    const discount = Math.min(input.discount, subtotal);
    const total = subtotal - discount;

    if (input.paymentMethod === "CASH") {
      if (input.cashReceived === undefined || input.cashReceived < total) {
        throw new Error("El efectivo recibido no puede ser menor al total");
      }
    }
    const change =
      input.paymentMethod === "CASH" && input.cashReceived !== undefined ? input.cashReceived - total : undefined;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        isOpenTab: false,
        discount,
        total,
        payments: {
          create: {
            method: input.paymentMethod,
            status:
              input.paymentMethod === "MERCADOPAGO" || input.paymentMethod === "MERCADOPAGO_TERMINAL"
                ? "PENDING"
                : "APPROVED",
            amount: total,
            cashReceived: input.cashReceived,
            change,
          },
        },
      },
      include: { items: { include: { product: true } }, payments: true },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "TABLE_CLOSE",
        entity: "Order",
        entityId: orderId,
        newData: { total: total.toString(), paymentMethod: input.paymentMethod, tableId: order.tableId },
      },
    });

    // La mesa ya se desocupa al cerrar la cuenta — los clientes ya
    // terminaron y se van, independientemente de si un cobro de Mercado
    // Pago sigue pendiente de confirmar (el inventario ya se descontó por
    // ronda, así que no hay nada que revertir si ese pago llegara a fallar).
    if (order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { currentOrderId: null, status: "CUENTA" },
      });
    }

    return updated;
  },
};
