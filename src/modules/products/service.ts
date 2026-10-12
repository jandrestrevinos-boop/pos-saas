import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { inventoryService, getBranchStock } from "@/modules/inventory/service";
import { deleteBlobQuiet, isCompanyBlobUrl } from "@/lib/blob";

export const productSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  cost: z.coerce.number().min(0).optional(),
  sku: z.string().optional(),
  description: z.string().optional(),
  tracksInventory: z.boolean().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  minStock: z.coerce.number().int().min(0).optional(),
  // Foto del producto (URL de nuestro almacenamiento). "" o null = sin foto.
  imageUrl: z.string().max(600).nullable().optional(),
});

export const productsService = {
  async list(companyId: string) {
    return prisma.product.findMany({
      where: { companyId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * `branchId` + `userId`: sucursal donde se da de alta; si trae existencia inicial,
   * se queda en ESA sucursal (las demás empiezan en 0).
   */
  async create(companyId: string, input: z.infer<typeof productSchema>, ctx?: { branchId: string | null; userId: string }) {
    const imageUrl = input.imageUrl ? input.imageUrl : null;
    if (imageUrl && !isCompanyBlobUrl(imageUrl, companyId)) throw new Error("Imagen inválida");

    const product = await prisma.product.create({
      data: {
        companyId,
        categoryId: input.categoryId,
        name: input.name,
        price: input.price,
        cost: input.cost,
        sku: input.sku,
        description: input.description,
        imageUrl,
        tracksInventory: input.tracksInventory ?? false,
        stock: input.stock ?? 0,
        minStock: input.minStock ?? 0,
      },
    });

    if (ctx?.branchId && product.tracksInventory && product.stock > 0) {
      await inventoryService.seedInitialStock(product.id, ctx.branchId, ctx.userId, product.stock);
    }
    return product;
  },

  async update(
    companyId: string,
    id: string,
    data: Partial<z.infer<typeof productSchema>>,
    ctx?: { branchId: string | null; userId: string }
  ) {
    // La existencia ya no se escribe directo en Product.stock (es el TOTAL de todas las
    // sucursales): "stock" del formulario es la existencia de la sucursal donde se edita.
    const { stock, imageUrl, ...rest } = data;

    // Foto: solo se toca si el formulario la manda. Se valida que sea de nuestro almacenamiento
    // y de esta empresa, y la foto anterior se borra para no dejar archivos huérfanos.
    const imageData: { imageUrl?: string | null } = {};
    let oldImage: string | null = null;
    if (imageUrl !== undefined) {
      const next = imageUrl ? imageUrl : null;
      const current = await prisma.product.findFirst({ where: { id, companyId }, select: { imageUrl: true } });
      oldImage = current?.imageUrl ?? null;
      if (next !== oldImage) {
        if (next && !isCompanyBlobUrl(next, companyId)) throw new Error("Imagen inválida");
        imageData.imageUrl = next;
      }
    }

    const result = await prisma.product.updateMany({ where: { id, companyId }, data: { ...rest, ...imageData } });
    if (result.count === 0) throw new Error("Producto no encontrado");
    if (oldImage && imageData.imageUrl !== undefined && imageData.imageUrl !== oldImage) {
      await deleteBlobQuiet(oldImage);
    }

    if (stock !== undefined && ctx?.branchId) {
      await inventoryService.setBranchStock(companyId, ctx.branchId, ctx.userId, id, stock);
    }

    const product = await prisma.product.findUnique({ where: { id } });
    // La tabla de productos muestra la existencia de la sucursal activa, no el total.
    if (product?.tracksInventory && ctx?.branchId) {
      return { ...product, stock: await getBranchStock(id, ctx.branchId) };
    }
    return product;
  },

  async setActive(companyId: string, id: string, isActive: boolean) {
    const result = await prisma.product.updateMany({ where: { id, companyId }, data: { isActive } });
    if (result.count === 0) throw new Error("Producto no encontrado");
  },
};
