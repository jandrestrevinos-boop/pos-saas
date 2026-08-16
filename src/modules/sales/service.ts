import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .min(1, "El carrito está vacío"),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  cashReceived: z.coerce.number().min(0).optional(),
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
    const productMap = new Map((products as SaleProduct[]).map((p) => [p.id, p]));

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
        status: "PENDING",
        subtotal,
        discount,
        tax: 0,
        total,
        items: { create: orderItemsData },
        payments: {
          create: {
            method: input.paymentMethod,
            amount: total,
            cashReceived: input.cashReceived,
            change,
          },
        },
      },
      include: { items: { include: { product: true } }, payments: true },
    });

    // Descuenta inventario para los productos que lo controlan (no bloquea
    // la venta si algo falla aquí; la venta ya quedó registrada).
    const { inventoryService } = await import("@/modules/inventory/service");
    try {
      await inventoryService.deductForSale(branchId, userId, input.items);
    } catch {
      // El inventario es informativo respecto a la venta; un fallo aquí
      // no debe revertir un cobro ya realizado al cliente.
    }

    return order;
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
};
