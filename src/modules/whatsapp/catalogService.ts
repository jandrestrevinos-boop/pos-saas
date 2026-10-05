/**
 * catalogService.ts
 * Obtiene catálogo dinámico para WhatsApp.
 *
 * Reglas de disponibilidad (deben coincidir con lo que ve el cajero):
 * - Solo categorías y productos ACTIVOS.
 * - Un producto que NO controla inventario (tracksInventory = false) está
 *   siempre disponible. Antes se exigía stock > 0 para todos, así que
 *   los platillos preparados (tacos, etc.) nunca aparecían en el menú.
 * - Un producto que SÍ controla inventario solo aparece si tiene existencias.
 */

import { prisma } from "@/lib/prisma";

export const catalogService = {
  async getCatalog(companyId: string, branchId: string) {
    try {
      return await prisma.category.findMany({
        where: {
          companyId,
          isActive: true,
        },
        include: {
          products: {
            where: {
              isActive: true,
              // Solo se ofrece lo que esta sucursal tiene en existencia (o no controla inventario).
              OR: [{ tracksInventory: false }, { branchStocks: { some: { branchId, stock: { gt: 0 } } } }],
            },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              stock: true,
              tracksInventory: true,
            },
            orderBy: {
              name: "asc",
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      });
    } catch (error) {
      console.error(`[CatalogService] Error:`, error);
      return [];
    }
  },

  async getProduct(productId: string, companyId: string) {
    try {
      return await prisma.product.findFirst({
        where: {
          id: productId,
          companyId,
          isActive: true,
        },
      });
    } catch (error) {
      console.error(`[CatalogService] Error:`, error);
      return null;
    }
  },

  async isAvailable(productId: string, branchId: string, quantity: number = 1): Promise<boolean> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { tracksInventory: true, isActive: true },
      });
      if (!product || !product.isActive) return false;
      if (!product.tracksInventory) return true;
      const row = await prisma.branchStock.findUnique({
        where: { productId_branchId: { productId, branchId } },
        select: { stock: true },
      });
      return (row?.stock ?? 0) >= quantity;
    } catch {
      return false;
    }
  },
};
