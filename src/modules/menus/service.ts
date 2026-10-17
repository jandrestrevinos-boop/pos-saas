import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const menuSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  description: z.string().max(300).optional(),
  isActive: z.boolean().optional(),
});

export const menuGroupsSchema = z.object({
  groups: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Cada grupo necesita un nombre").max(60),
        minSelect: z.coerce.number().int().min(0).max(20),
        maxSelect: z.coerce.number().int().min(1).max(20),
        options: z
          .array(
            z.object({
              optionProductId: z.string().min(1),
              // 0 = incluida en el precio fijo del menú; > 0 = cargo extra al elegirla.
              extraPrice: z.coerce.number().min(0).default(0),
            })
          )
          .min(1, "Cada grupo necesita al menos una opción")
          .max(40),
      })
    )
    .max(12),
});

export type ChosenOption = {
  optionProductId: string;
  name: string;
  extraPriceAtSale: number;
  costAtSale: number;
};

type OptionRow = {
  id: string;
  extraPrice: unknown;
  optionProductId: string;
  optionProduct: { id: string; name: string; cost: unknown; isActive: boolean };
};
type GroupRow = { id: string; name: string; minSelect: number; maxSelect: number; sortOrder: number; options: OptionRow[] };

const GROUP_INCLUDE = {
  options: { include: { optionProduct: { select: { id: true, name: true, cost: true, isActive: true } } } },
} as const;

export const menusService = {
  /** Menús de la empresa con sus grupos/opciones y un resumen de costo. */
  async list(companyId: string) {
    const menus = await prisma.product.findMany({
      where: { companyId, isMenu: true },
      include: {
        category: { select: { name: true } },
        menuGroups: { include: GROUP_INCLUDE, orderBy: { sortOrder: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    type MenuRow = {
      id: string; name: string; price: unknown; cost: unknown; isActive: boolean; categoryId: string;
      category: { name: string }; menuGroups: GroupRow[];
    };
    return (menus as unknown as MenuRow[]).map((m) => {
      const price = Number(m.price);
      const baseCost = m.cost === null || m.cost === undefined ? 0 : Number(m.cost);
      // Peor caso de costo: en cada grupo, las `maxSelect` opciones más caras.
      let worstCost = baseCost;
      for (const g of m.menuGroups) {
        const costs = g.options.map((o) => Number(o.optionProduct.cost ?? 0)).sort((a, b) => b - a);
        worstCost += costs.slice(0, g.maxSelect).reduce((s, c) => s + c, 0);
      }
      return {
        id: m.id,
        name: m.name,
        price,
        baseCost,
        worstCost,
        worstFoodCostPercent: price > 0 ? (worstCost / price) * 100 : null,
        isActive: m.isActive,
        categoryId: m.categoryId,
        category: m.category.name,
        groups: m.menuGroups.map((g) => ({
          id: g.id,
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.map((o) => ({
            id: o.id,
            optionProductId: o.optionProductId,
            name: o.optionProduct.name,
            extraPrice: Number(o.extraPrice),
            cost: Number(o.optionProduct.cost ?? 0),
            isActive: o.optionProduct.isActive,
          })),
        })),
      };
    });
  },

  async create(companyId: string, input: z.infer<typeof menuSchema>) {
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, companyId } });
    if (!category) throw new Error("Categoría no encontrada");
    return prisma.product.create({
      data: {
        companyId,
        categoryId: input.categoryId,
        name: input.name,
        price: input.price,
        description: input.description,
        isMenu: true,
        isActive: input.isActive ?? true,
      },
    });
  },

  async update(companyId: string, id: string, input: z.infer<typeof menuSchema>) {
    const menu = await prisma.product.findFirst({ where: { id, companyId, isMenu: true } });
    if (!menu) throw new Error("Menú no encontrado");
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, companyId } });
    if (!category) throw new Error("Categoría no encontrada");
    return prisma.product.update({
      where: { id },
      data: {
        name: input.name,
        categoryId: input.categoryId,
        price: input.price,
        description: input.description,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
    });
  },

  /**
   * Reemplaza todos los grupos/opciones del menú. Ventas ya hechas no se afectan: lo que el cliente
   * eligió se congela en OrderItemMenuChoice al vender.
   */
  async setGroups(companyId: string, id: string, input: z.infer<typeof menuGroupsSchema>) {
    const menu = await prisma.product.findFirst({ where: { id, companyId, isMenu: true } });
    if (!menu) throw new Error("Menú no encontrado");

    const optionIds = new Set<string>();
    for (const g of input.groups) {
      if (g.minSelect > g.maxSelect) throw new Error(`En "${g.name}" el mínimo no puede ser mayor al máximo`);
      if (g.minSelect > g.options.length) throw new Error(`En "${g.name}" el mínimo es mayor que las opciones disponibles`);
      const inGroup = g.options.map((o) => o.optionProductId);
      if (new Set(inGroup).size !== inGroup.length) throw new Error(`En "${g.name}" hay una opción repetida`);
      inGroup.forEach((pid) => optionIds.add(pid));
    }
    if (optionIds.has(id)) throw new Error("Un menú no puede incluirse a sí mismo");

    if (optionIds.size > 0) {
      const valid = await prisma.product.count({
        where: { id: { in: Array.from(optionIds) }, companyId, isMenu: false },
      });
      if (valid !== optionIds.size) throw new Error("Una o más opciones no son productos válidos (no se pueden usar otros menús como opción)");
    }

    await prisma.$transaction(async (tx) => {
      await tx.menuGroup.deleteMany({ where: { productId: id } });
      let order = 0;
      for (const g of input.groups) {
        await tx.menuGroup.create({
          data: {
            productId: id,
            name: g.name,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            sortOrder: order++,
            options: { create: g.options.map((o) => ({ optionProductId: o.optionProductId, extraPrice: o.extraPrice })) },
          },
        });
      }
    });

    return this.list(companyId).then((all) => all.find((m) => m.id === id) ?? null);
  },

  /** Menús activos con grupos, para que el POS pida las elecciones al agregar el menú al carrito. */
  async listForPos(companyId: string) {
    const all = await this.list(companyId);
    return all
      .filter((m) => m.isActive)
      .map((m) => ({
        id: m.id,
        groups: m.groups.map((g) => ({
          id: g.id,
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.filter((o) => o.isActive).map((o) => ({ id: o.id, name: o.name, extraPrice: o.extraPrice })),
        })),
      }));
  },

  /**
   * Valida lo que eligió el cliente (ids de MenuOption) contra las reglas del menú y devuelve el cargo
   * extra, el costo extra y las elecciones ya "congeladas". El servidor es la única fuente de precio y
   * costo — nunca se confía en lo que mande el navegador.
   */
  async resolveChoices(companyId: string, menuProductId: string, choiceIds: string[]) {
    const product = await prisma.product.findFirst({ where: { id: menuProductId, companyId } });
    if (!product) throw new Error("Producto no encontrado");

    if (!product.isMenu) {
      if (choiceIds.length > 0) throw new Error(`"${product.name}" no es un menú completo`);
      return { extraPrice: 0, extraCost: 0, choices: [] as ChosenOption[] };
    }

    const groups = (await prisma.menuGroup.findMany({
      where: { productId: menuProductId },
      include: GROUP_INCLUDE,
    })) as unknown as GroupRow[];

    if (new Set(choiceIds).size !== choiceIds.length) throw new Error("No puedes elegir la misma opción dos veces");

    const optionIndex = new Map<string, { group: GroupRow; option: OptionRow }>();
    for (const g of groups) for (const o of g.options) optionIndex.set(o.id, { group: g, option: o });

    const perGroup = new Map<string, number>();
    const choices: ChosenOption[] = [];
    let extraPrice = 0;
    let extraCost = 0;
    for (const id of choiceIds) {
      const hit = optionIndex.get(id);
      if (!hit) throw new Error(`Una opción elegida ya no pertenece al menú "${product.name}"`);
      if (!hit.option.optionProduct.isActive) throw new Error(`"${hit.option.optionProduct.name}" ya no está disponible`);
      perGroup.set(hit.group.id, (perGroup.get(hit.group.id) ?? 0) + 1);
      const price = Number(hit.option.extraPrice);
      const cost = Number(hit.option.optionProduct.cost ?? 0);
      extraPrice += price;
      extraCost += cost;
      choices.push({
        optionProductId: hit.option.optionProductId,
        name: hit.option.optionProduct.name,
        extraPriceAtSale: price,
        costAtSale: cost,
      });
    }

    for (const g of groups) {
      const n = perGroup.get(g.id) ?? 0;
      if (n < g.minSelect || n > g.maxSelect) {
        throw new Error(
          g.minSelect === g.maxSelect
            ? `En "${g.name}" debes elegir ${g.minSelect}`
            : `En "${g.name}" elige entre ${g.minSelect} y ${g.maxSelect}`
        );
      }
    }

    return {
      extraPrice: Math.round(extraPrice * 100) / 100,
      extraCost: Math.round(extraCost * 100) / 100,
      choices,
    };
  },
};
