import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const movementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "WASTE"]),
  quantity: z.coerce.number().int(),
  reason: z.string().optional(),
});

export const inventoryService = {
  async listTrackedProducts(companyId: string) {
    return prisma.product.findMany({
      where: { companyId, tracksInventory: true },
      include: { category: true },
      orderBy: { name: "asc" },
    });
  },

  async listMovements(companyId: string, limit = 50) {
    return prisma.inventoryMovement.findMany({
      where: { product: { companyId } },
      include: { product: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async registerMovement(companyId: string, branchId: string, userId: string, input: z.infer<typeof movementSchema>) {
    const product = await prisma.product.findFirst({ where: { id: input.productId, companyId } });
    if (!product) throw new Error("Producto no encontrado");
    if (!product.tracksInventory) throw new Error("Este producto no controla inventario");

    // IN suma, OUT y WASTE restan, ADJUSTMENT puede ser positivo o negativo
    // según lo que capture el usuario (se guarda tal cual).
    const delta =
      input.type === "IN" ? Math.abs(input.quantity) : input.type === "ADJUSTMENT" ? input.quantity : -Math.abs(input.quantity);

    const newStock = product.stock + delta;
    if (newStock < 0) throw new Error("La existencia no puede quedar en negativo");

    const [movement] = await prisma.$transaction([
      prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          branchId,
          userId,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason,
        },
      }),
      prisma.product.update({ where: { id: product.id }, data: { stock: newStock } }),
    ]);

    return movement;
  },

  /**
   * Descuenta stock automáticamente cuando se concreta una venta.
   * Se usa desde el servicio de ventas — nunca se expone como endpoint propio.
   */
  async deductForSale(branchId: string, userId: string, items: { productId: string; quantity: number }[]) {
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product?.tracksInventory) continue;

      const newStock = Math.max(product.stock - item.quantity, 0);
      await prisma.$transaction([
        prisma.inventoryMovement.create({
          data: {
            productId: product.id,
            branchId,
            userId,
            type: "OUT",
            quantity: item.quantity,
            reason: "Venta",
          },
        }),
        prisma.product.update({ where: { id: product.id }, data: { stock: newStock } }),
      ]);
    }
  },

  /** Repone el stock que se descontó por una venta que se está cancelando. */
  async restockForCancelledSale(branchId: string, userId: string, items: { productId: string; quantity: number }[]) {
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product?.tracksInventory) continue;

      const newStock = product.stock + item.quantity;
      await prisma.$transaction([
        prisma.inventoryMovement.create({
          data: {
            productId: product.id,
            branchId,
            userId,
            type: "IN",
            quantity: item.quantity,
            reason: "Cancelación de venta",
          },
        }),
        prisma.product.update({ where: { id: product.id }, data: { stock: newStock } }),
      ]);
    }
  },
};
