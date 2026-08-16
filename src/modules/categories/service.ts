import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
});

export const categoriesService = {
  async list(companyId: string) {
    return prisma.category.findMany({
      where: { companyId }, // filtro de tenant obligatorio
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });
  },

  async create(companyId: string, name: string) {
    const count = await prisma.category.count({ where: { companyId } });
    return prisma.category.create({ data: { companyId, name, sortOrder: count } });
  },

  async update(companyId: string, id: string, data: { name?: string; isActive?: boolean }) {
    // where compuesto: solo actualiza si la categoría pertenece a esta empresa
    const result = await prisma.category.updateMany({ where: { id, companyId }, data });
    if (result.count === 0) throw new Error("Categoría no encontrada");
    return prisma.category.findUnique({ where: { id } });
  },

  async remove(companyId: string, id: string) {
    const result = await prisma.category.deleteMany({ where: { id, companyId } });
    if (result.count === 0) throw new Error("Categoría no encontrada");
  },
};
