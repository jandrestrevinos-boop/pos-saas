import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const saleSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.coerce.number().int().positive(),
        })
      )
      .min(1, "El carrito está vacío"),
    discount: z.coerce.number().min(0).default(0),
    paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER", "MERCADOPAGO", "MERCADOPAGO_TERMINAL"]),
    cashReceived: z.coerce.number().min(0).optional(),
    tableId: z.string().optional(),
    orderType: z.enum(["COMER_AQUI", "PARA_LLEVAR", "DOMICILIO"]).default("COMER_AQUI"),
    notes: z.string().max(500).optional(),
    deliveryAddress: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === "DOMICILIO" && !data.deliveryAddress?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La dirección es requerida para pedidos a domicilio",
        path: ["deliveryAddress"],
      });
    }
  });

export type SaleInput = z.infer<typeof saleSchema>;

export const salesService = {
  async create(companyId: string, branchId: string, userId: string, input: SaleInput) {
    // 1. Trae los productos reales de la base de datos — el precio y nombre
    //    NUNCA se toman de lo que mandó el navegador, para evitar que alguien
    //    manipule el total de una venta desde las herramientas del navegador.
    const productIds = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, companyId, isActive: true },
    });

    if (products.length !== new Set(productIds).size) {
      throw new Error("Uno o más productos ya no están disponibles");
    }

    // Tipo mínimo explícito: evita depender de la inferencia automática de
    // Prisma para estos dos campos, que es lo único que usamos aquí.
    type SaleProduct = { id: string; price: number | string };
    const productMap = new Map((products as unknown as SaleProduct[]).map((p) => [p.id, p]));

    let subtotal = 0;
    const orderItemsData = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPriceAtSale: unitPrice,
        lineTotal,
      };
    });

    const discount = Math.min(input.discount, subtotal); // el descuento nunca deja el total en negativo
    const total = subtotal - discount;

    if (input.paymentMethod === "CASH") {
      if (input.cashReceived === undefined || input.cashReceived < total) {
        throw new Error("El efectivo recibido no puede ser menor al total");
      }
    }

    const change =
      input.paymentMethod === "CASH" && input.cashReceived !== undefined
        ? input.cashReceived - total
        : undefined;

    // 2. Crea la orden y sus renglones en una sola transacción
    const order = await prisma.order.create({
      data: {
        localId: crypto.randomUUID(),
        companyId,
        branchId,
        userId,
        tableId: input.tableId ?? null,
        status: "PENDING",
        orderType: input.orderType,
        notes: input.notes?.trim() || null,
        deliveryAddress: input.orderType === "DOMICILIO" ? input.deliveryAddress?.trim() : null,
        subtotal,
        discount,
        tax: 0,
        total,
        items: { create: orderItemsData },
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

    // Si la venta viene ligada a una mesa, la marca como Ocupada
    // automáticamente (el mesero ya no tiene que hacerlo a mano).
    if (input.tableId) {
      await prisma.table.updateMany({
        where: { id: input.tableId, companyId },
        data: { status: "OCUPADA" },
      });
    }

    // Para Mercado Pago el cobro todavía no se ha confirmado — el
    // inventario se descuenta hasta que el webhook confirme el pago
    // (finalizeApprovedOrder), para no descontar stock de un cobro que
    // termine rechazado o abandonado.
    if (input.paymentMethod !== "MERCADOPAGO" && input.paymentMethod !== "MERCADOPAGO_TERMINAL") {
      const { inventoryService } = await import("@/modules/inventory/service");
      try {
        await inventoryService.deductForSale(branchId, userId, input.items);
      } catch {
        // El inventario es informativo respecto a la venta; un fallo aquí
        // no debe revertir un cobro ya realizado al cliente.
      }
    }

    return order;
  },

  /** Se llama desde el webhook de Mercado Pago cuando un pago queda aprobado: descuenta el inventario que se difirió en create(). */
  async finalizeApprovedOrder(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return;

    const { inventoryService } = await import("@/modules/inventory/service");
    type MinimalOrderItem = { productId: string; quantity: number };
    try {
      await inventoryService.deductForSale(
        order.branchId,
        order.userId,
        (order.items as MinimalOrderItem[]).map((i) => ({ productId: i.productId, quantity: i.quantity }))
      );
    } catch {
      // Igual que en create(): el inventario no debe bloquear que el pago quede confirmado.
    }
  },

  async listToday(companyId: string, branchId?: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return prisma.order.findMany({
      where: { companyId, branchId, createdAt: { gte: startOfDay }, status: { not: "CANCELED" } },
      include: { items: true, payments: true },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Historial de ventas con filtros — usado por /sales-history. */
  async listHistory(companyId: string, filters: { branchId?: string; from?: Date; to?: Date; limit?: number }) {
    return prisma.order.findMany({
      where: {
        companyId,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        isOpenTab: false, // las cuentas de mesa que siguen abiertas no aparecen aquí, solo ventas ya cerradas
        createdAt: {
          ...(filters.from ? { gte: filters.from } : {}),
          ...(filters.to ? { lte: filters.to } : {}),
        },
      },
      include: {
        items: { include: { product: true } },
        payments: true,
        user: { select: { name: true } },
        table: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 100,
    });
  },

  /**
   * Cancela una venta ya cerrada (no una cuenta de mesa abierta). Repone
   * inventario y deja rastro en AuditLog. OJO: esto NO reembolsa un cobro
   * ya hecho por Mercado Pago o tarjeta física — solo anula el registro y
   * el inventario del lado de Tappy.
   */
  async cancelSale(companyId: string, orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, companyId },
      include: { items: true, payments: true },
    });
    if (!order) throw new Error("Venta no encontrada");
    if (order.isOpenTab) throw new Error("Esta mesa todavía tiene la cuenta abierta — no se puede cancelar desde aquí");
    if (order.status === "CANCELED") throw new Error("Esta venta ya estaba cancelada");

    const wasApproved = order.payments.some((p: { status: string }) => p.status === "APPROVED");

    await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELED" } });

    if (wasApproved) {
      const { inventoryService } = await import("@/modules/inventory/service");
      try {
        await inventoryService.restockForCancelledSale(
          order.branchId,
          userId,
          order.items.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: i.quantity }))
        );
      } catch {
        // No debe bloquear la cancelación si el inventario falla al reponerse.
      }
    }

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "SALE_CANCEL",
        entity: "Order",
        entityId: orderId,
        previousData: { status: order.status, total: order.total.toString() },
        newData: { status: "CANCELED" },
      },
    });

    return order;
  },
};
