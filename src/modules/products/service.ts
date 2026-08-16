import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  cost: z.coerce.number().min(0).optional(),
  sku: z.string().optional(),
  description: z.string().optional(),
  tracksInventory: z.boolean().optional(),
  stock: z.coerce.number().int().min(0).optional(),
});

export const productsService = {
  async list(companyId: string) {
    return prisma.product.findMany({
      where: { companyId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(companyId: string, input: z.infer<typeof productSchema>) {
    return prisma.product.create({
      data: {
        companyId,
        categoryId: input.categoryId,
        name: input.name,
        price: input.price,
        cost: input.cost,
        sku: input.sku,
        description: input.description,
        tracksInventory: input.tracksInventory ?? false,
        stock: input.stock ?? 0,
      },
    });
  },

  async update(companyId: string, id: string, data: Partial<z.infer<typeof productSchema>>) {
    const result = await prisma.product.updateMany({ where: { id, companyId }, data });
    if (result.count === 0) throw new Error("Producto no encontrado");
    return prisma.product.findUnique({ where: { id } });
  },

  async setActive(companyId: string, id: string, isActive: boolean) {
    const result = await prisma.product.updateMany({ where: { id, companyId }, data: { isActive } });
    if (result.count === 0) throw new Error("Producto no encontrado");
  },
};
