import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const movementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "WASTE"]),
  quantity: z.coerce.number().int(),
  reason: z.string().optional(),
});

export const transferSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1, "Selecciona la sucursal destino"),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
  note: z.string().max(200).optional(),
});

type Tx = Prisma.TransactionClient;

/**
 * INVENTARIO POR SUCURSAL
 * - La existencia real vive en BranchStock (producto + sucursal). Sin fila = 0.
 * - Product.stock se mantiene como el TOTAL de todas las sucursales, ajustado
 *   en la MISMA transacción con el mismo delta, para que lo que lee el total
 *   (productos, WhatsApp, reportes) nunca quede desfasado.
 */

/** Existencia de un producto en una sucursal (0 si nunca se ha movido ahí). */
export async function getBranchStock(productId: string, branchId: string, db: Tx | typeof prisma = prisma): Promise<number> {
  const row = await db.branchStock.findUnique({ where: { productId_branchId: { productId, branchId } }, select: { stock: true } });
  return row?.stock ?? 0;
}

/**
 * Aplica un cambio de existencia en una sucursal y en el total, de forma atómica.
 *  - delta > 0: suma.
 *  - delta < 0: resta; con clamp = true no baja de 0 (ventas: nunca bloquean el cobro),
 *    con clamp = false lanza error si no alcanza.
 * Devuelve el cambio realmente aplicado (puede ser menor en valor absoluto si hubo clamp).
 */
async function applyStockDelta(tx: Tx, productId: string, branchId: string, delta: number, clamp: boolean): Promise<number> {
  if (delta === 0) return 0;

  if (delta > 0) {
    await tx.branchStock.upsert({
      where: { productId_branchId: { productId, branchId } },
      create: { productId, branchId, stock: delta },
      update: { stock: { increment: delta } },
    });
    await tx.product.update({ where: { id: productId }, data: { stock: { increment: delta } } });
    return delta;
  }

  const need = -delta;
  // Resta condicionada: solo si hay suficiente. Evita quedar en negativo aunque
  // dos ventas entren al mismo tiempo.
  const done = await tx.branchStock.updateMany({
    where: { productId, branchId, stock: { gte: need } },
    data: { stock: { decrement: need } },
  });
  if (done.count === 1) {
    await tx.product.update({ where: { id: productId }, data: { stock: { decrement: need } } });
    return delta;
  }

  const current = await getBranchStock(productId, branchId, tx);
  if (!clamp) throw new Error("La existencia no puede quedar en negativo");
  if (current <= 0) return 0;

  // Hay algo, pero menos de lo pedido: se lleva a 0 y se descuenta del total solo lo que había.
  await tx.branchStock.updateMany({ where: { productId, branchId }, data: { stock: 0 } });
  await tx.product.update({ where: { id: productId }, data: { stock: { decrement: current } } });
  return -current;
}

export const inventoryService = {
  /** Productos que controlan inventario, con la existencia de ESTA sucursal y del resto. */
  async listTrackedProducts(companyId: string, branchId: string) {
    const [products, branches] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, tracksInventory: true },
        include: { category: true, branchStocks: { select: { branchId: true, stock: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    ]);

    return products.map(({ branchStocks, ...p }) => ({
      ...p,
      // `stock` = existencia en la sucursal activa (lo que ve y opera esta sucursal)
      stock: branchStocks.find((s) => s.branchId === branchId)?.stock ?? 0,
      totalStock: p.stock,
      otherBranches: branches
        .filter((b) => b.id !== branchId)
        .map((b) => ({ branchId: b.id, branchName: b.name, stock: branchStocks.find((s) => s.branchId === b.id)?.stock ?? 0 })),
    }));
  },

  async listMovements(companyId: string, limit = 50) {
    return prisma.inventoryMovement.findMany({
      where: { product: { companyId } },
      include: {
        product: { select: { name: true } },
        user: { select: { name: true } },
        branch: { select: { name: true } },
      },
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

    return prisma.$transaction(async (tx) => {
      await applyStockDelta(tx, product.id, branchId, delta, false);
      return tx.inventoryMovement.create({
        data: { productId: product.id, branchId, userId, type: input.type, quantity: input.quantity, reason: input.reason },
      });
    });
  },

  /**
   * Fija la existencia de ESTA sucursal en un valor exacto (se usa cuando alguien
   * edita el "stock" desde el formulario de producto). Genera un ajuste en el historial.
   */
  async setBranchStock(companyId: string, branchId: string, userId: string, productId: string, newStock: number) {
    const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
    if (!product || !product.tracksInventory) return;

    await prisma.$transaction(async (tx) => {
      const current = await getBranchStock(productId, branchId, tx);
      const delta = newStock - current;
      if (delta === 0) return;
      await applyStockDelta(tx, productId, branchId, delta, false);
      await tx.inventoryMovement.create({
        data: { productId, branchId, userId, type: "ADJUSTMENT", quantity: delta, reason: "Ajuste desde edición de producto" },
      });
    });
  },

  /**
   * Descuenta stock automáticamente cuando se concreta una venta.
   * Se usa desde el servicio de ventas — nunca se expone como endpoint propio.
   * Descuenta de la sucursal donde se vendió. Nunca bloquea la venta.
   */
  async deductForSale(branchId: string, userId: string, items: { productId: string; quantity: number }[]) {
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { id: true, tracksInventory: true } });
      if (!product?.tracksInventory) continue;

      await prisma.$transaction(async (tx) => {
        await applyStockDelta(tx, product.id, branchId, -item.quantity, true);
        await tx.inventoryMovement.create({
          data: { productId: product.id, branchId, userId, type: "OUT", quantity: item.quantity, reason: "Venta" },
        });
      });
    }
  },

  /** Repone el stock que se descontó por una venta que se está cancelando (a la sucursal de esa venta). */
  async restockForCancelledSale(branchId: string, userId: string, items: { productId: string; quantity: number }[]) {
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { id: true, tracksInventory: true } });
      if (!product?.tracksInventory) continue;

      await prisma.$transaction(async (tx) => {
        await applyStockDelta(tx, product.id, branchId, item.quantity, true);
        await tx.inventoryMovement.create({
          data: { productId: product.id, branchId, userId, type: "IN", quantity: item.quantity, reason: "Cancelación de venta" },
        });
      });
    }
  },

  /** Alta de un producto con existencia inicial: la existencia queda en la sucursal donde se da de alta. */
  async seedInitialStock(productId: string, branchId: string, userId: string, quantity: number) {
    if (quantity <= 0) return;
    await prisma.$transaction(async (tx) => {
      // Product.stock ya se creó con `quantity`; solo falta la fila de la sucursal.
      await tx.branchStock.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: { productId, branchId, stock: quantity },
        update: { stock: quantity },
      });
      await tx.inventoryMovement.create({
        data: { productId, branchId, userId, type: "IN", quantity, reason: "Existencia inicial" },
      });
    });
  },

  /** Traspaso inmediato entre dos sucursales de la MISMA empresa. */
  async transfer(companyId: string, userId: string, input: z.infer<typeof transferSchema>) {
    if (input.fromBranchId === input.toBranchId) throw new Error("La sucursal origen y destino deben ser distintas");

    const [product, branches] = await Promise.all([
      prisma.product.findFirst({ where: { id: input.productId, companyId }, select: { id: true, name: true, tracksInventory: true } }),
      prisma.branch.findMany({
        where: { companyId, isActive: true, id: { in: [input.fromBranchId, input.toBranchId] } },
        select: { id: true, name: true },
      }),
    ]);
    if (!product) throw new Error("Producto no encontrado");
    if (!product.tracksInventory) throw new Error("Este producto no controla inventario");
    const from = branches.find((b) => b.id === input.fromBranchId);
    const to = branches.find((b) => b.id === input.toBranchId);
    if (!from || !to) throw new Error("Sucursal no válida");

    const noteSuffix = input.note ? ` — ${input.note}` : "";

    return prisma.$transaction(async (tx) => {
      // La salida falla si la sucursal origen no tiene suficiente (no se permite negativo).
      try {
        await applyStockDelta(tx, product.id, from.id, -input.quantity, false);
      } catch {
        const available = await getBranchStock(product.id, from.id, tx);
        throw new Error(`${from.name} solo tiene ${available} de ${product.name}`);
      }
      await applyStockDelta(tx, product.id, to.id, input.quantity, false);

      await tx.inventoryMovement.createMany({
        data: [
          { productId: product.id, branchId: from.id, userId, type: "OUT", quantity: input.quantity, reason: `Transferencia a ${to.name}${noteSuffix}` },
          { productId: product.id, branchId: to.id, userId, type: "IN", quantity: input.quantity, reason: `Transferencia desde ${from.name}${noteSuffix}` },
        ],
      });

      const transfer = await tx.stockTransfer.create({
        data: {
          companyId,
          productId: product.id,
          fromBranchId: from.id,
          toBranchId: to.id,
          userId,
          quantity: input.quantity,
          note: input.note || null,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "STOCK_TRANSFER",
          entity: "StockTransfer",
          entityId: transfer.id,
          newData: { product: product.name, from: from.name, to: to.name, quantity: input.quantity },
        },
      });
      return transfer;
    });
  },
};
