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
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";

export const catalogService = {
  async getCatalog(companyId: string, branchId: string) {
    try {
      // Los menús completos se ofrecen por WhatsApp solo si el plan de la empresa los incluye.
      const menusEnabled = await hasFeature(companyId, FEATURE_KEYS.MENUS_COMPLETOS);
      return await prisma.category.findMany({
        where: {
          companyId,
          isActive: true,
        },
        include: {
          products: {
            where: {
              isActive: true,
              ...(menusEnabled ? {} : { isMenu: false }),
              // Solo se ofrece lo que esta sucursal tiene en existencia (o no controla inventario).
              OR: [{ tracksInventory: false }, { branchStocks: { some: { branchId, stock: { gt: 0 } } } }],
            },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              isMenu: true,
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
      const menusEnabled = await hasFeature(companyId, FEATURE_KEYS.MENUS_COMPLETOS);
      return await prisma.product.findFirst({
        where: {
          id: productId,
          companyId,
          isActive: true,
          ...(menusEnabled ? {} : { isMenu: false }),
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
