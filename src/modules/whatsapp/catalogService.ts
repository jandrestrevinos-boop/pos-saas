/**
 * catalogService.ts
 * Obtiene catálogo dinámico
 */

import { prisma } from "@/lib/prisma";

export const catalogService = {
  async getCatalog(companyId: string, branchId: string) {
    try {
      return await prisma.category.findMany({
        where: {
          companyId,
        },
        include: {
          products: {
            where: {
              stock: {
                gt: 0,
              },
            },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              stock: true,
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
        },
      });
    } catch (error) {
      console.error(`[CatalogService] Error:`, error);
      return null;
    }
  },

  async isAvailable(productId: string, quantity: number = 1): Promise<boolean> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { stock: true },
      });
      return product ? product.stock >= quantity : false;
    } catch {
      return false;
    }
  },
};
