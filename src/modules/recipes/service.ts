import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { INGREDIENT_UNITS, recipeCost, foodCostPercent } from "@/lib/recipe-cost";

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  unit: z.enum(INGREDIENT_UNITS),
  costPerUnit: z.coerce.number().min(0, "El costo no puede ser negativo"),
  wastePercent: z.coerce.number().min(0).max(95).default(0),
  isActive: z.boolean().optional(),
});

export const recipeSchema = z.object({
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
      })
    )
    .max(60),
});

type RecipeRow = { quantity: unknown; ingredient: { costPerUnit: unknown; wastePercent: unknown } };

function costOfRows(rows: RecipeRow[]): number {
  return recipeCost(
    rows.map((r) => ({
      quantity: Number(r.quantity),
      costPerUnit: Number(r.ingredient.costPerUnit),
      wastePercent: Number(r.ingredient.wastePercent),
    }))
  );
}

type Tx = Prisma.TransactionClient;

/**
 * Recalcula Product.cost de los productos con receta y lo guarda. Así Reportes, Dashboard
 * (Food Cost %, margen) y la tabla de productos usan el costo real sin cambiar su código.
 * Un producto SIN renglones de receta conserva el costo que ya tenía (capturado a mano).
 */
async function recalcProducts(tx: Tx, productIds: string[]) {
  for (const productId of productIds) {
    const rows = await tx.recipeItem.findMany({ where: { productId }, include: { ingredient: true } });
    if (rows.length === 0) continue;
    await tx.product.update({ where: { id: productId }, data: { cost: costOfRows(rows as unknown as RecipeRow[]) } });
  }
}

export const recipesService = {
  async listIngredients(companyId: string) {
    const rows = await prisma.ingredient.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { recipeItems: true } } },
    });
    return rows;
  },

  async createIngredient(companyId: string, input: z.infer<typeof ingredientSchema>) {
    const exists = await prisma.ingredient.findFirst({ where: { companyId, name: input.name } });
    if (exists) throw new Error("Ya existe un insumo con ese nombre");
    return prisma.ingredient.create({
      data: {
        companyId,
        name: input.name,
        unit: input.unit,
        costPerUnit: input.costPerUnit,
        wastePercent: input.wastePercent,
        isActive: input.isActive ?? true,
      },
    });
  },

  /** Al cambiar el costo/merma de un insumo se recalculan todas las recetas que lo usan. */
  async updateIngredient(companyId: string, id: string, input: z.infer<typeof ingredientSchema>, userId: string) {
    const current = await prisma.ingredient.findFirst({ where: { id, companyId } });
    if (!current) throw new Error("Insumo no encontrado");
    if (input.name !== current.name) {
      const dup = await prisma.ingredient.findFirst({ where: { companyId, name: input.name, NOT: { id } } });
      if (dup) throw new Error("Ya existe un insumo con ese nombre");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ingredient.update({
        where: { id },
        data: {
          name: input.name,
          unit: input.unit,
          costPerUnit: input.costPerUnit,
          wastePercent: input.wastePercent,
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      });
      const used = await tx.recipeItem.findMany({ where: { ingredientId: id }, select: { productId: true } });
      await recalcProducts(tx, Array.from(new Set(used.map((u: { productId: string }) => u.productId))));

      if (Number(current.costPerUnit) !== input.costPerUnit || Number(current.wastePercent) !== input.wastePercent) {
        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: "INGREDIENT_COST_UPDATE",
            entity: "Ingredient",
            entityId: id,
            previousData: { costPerUnit: String(current.costPerUnit), wastePercent: String(current.wastePercent) },
            newData: { costPerUnit: String(input.costPerUnit), wastePercent: String(input.wastePercent) },
          },
        });
      }
      return updated;
    });
  },

  /** Un insumo que ya está en alguna receta no se borra (rompería costos): se desactiva. */
  async deleteIngredient(companyId: string, id: string) {
    const current = await prisma.ingredient.findFirst({ where: { id, companyId }, include: { _count: { select: { recipeItems: true } } } });
    if (!current) throw new Error("Insumo no encontrado");
    if (current._count.recipeItems > 0) {
      await prisma.ingredient.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, deactivated: true };
    }
    await prisma.ingredient.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  },

  async getRecipe(companyId: string, productId: string) {
    const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
    if (!product) throw new Error("Producto no encontrado");
    const items = await prisma.recipeItem.findMany({
      where: { productId },
      include: { ingredient: true },
      orderBy: { ingredient: { name: "asc" } },
    });
    return { product, items, cost: items.length ? costOfRows(items as unknown as RecipeRow[]) : null };
  },

  /** Reemplaza la receta completa del producto y guarda el costo calculado en Product.cost. */
  async setRecipe(companyId: string, productId: string, input: z.infer<typeof recipeSchema>, userId: string) {
    const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
    if (!product) throw new Error("Producto no encontrado");

    const ids = input.items.map((i) => i.ingredientId);
    if (new Set(ids).size !== ids.length) throw new Error("Un insumo no puede repetirse en la misma receta");
    if (ids.length > 0) {
      const found = await prisma.ingredient.count({ where: { id: { in: ids }, companyId } });
      if (found !== ids.length) throw new Error("Uno o más insumos ya no existen");
    }

    await prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({ where: { productId } });
      if (input.items.length > 0) {
        await tx.recipeItem.createMany({
          data: input.items.map((i) => ({ productId, ingredientId: i.ingredientId, quantity: i.quantity })),
        });
      }
      await recalcProducts(tx, [productId]);
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "RECIPE_UPDATE",
          entity: "Product",
          entityId: productId,
          previousData: { cost: product.cost === null ? null : String(product.cost) },
          newData: { ingredients: input.items.length },
        },
      });
    });

    return this.getRecipe(companyId, productId);
  },

  /** Tabla de costeo: todos los productos con su costo, margen y Food Cost %. */
  async costingReport(companyId: string) {
    const products = await prisma.product.findMany({
      where: { companyId },
      include: { category: { select: { name: true } }, _count: { select: { recipeItems: true } } },
      orderBy: { name: "asc" },
    });
    type Row = { id: string; name: string; isMenu: boolean; price: unknown; cost: unknown; category: { name: string }; _count: { recipeItems: number } };
    return (products as unknown as Row[]).map((p) => {
      const price = Number(p.price);
      const hasCost = p.cost !== null && p.cost !== undefined;
      const cost = hasCost ? Number(p.cost) : null;
      return {
        id: p.id,
        name: p.name,
        category: p.category.name,
        isMenu: p.isMenu,
        price,
        cost,
        hasRecipe: p._count.recipeItems > 0,
        margin: cost === null ? null : price - cost,
        foodCostPercent: cost === null ? null : foodCostPercent(cost, price),
      };
    });
  },
};
