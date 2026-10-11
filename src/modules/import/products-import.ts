import { prisma } from "@/lib/prisma";
import { inventoryService } from "@/modules/inventory/service";
import { parseNumber, parseYesNo, type RawRow } from "./parse";

// Encabezados aceptados (ya normalizados: minúsculas, sin acentos) -> campo interno.
const ALIASES: Record<string, string[]> = {
  name: ["nombre", "producto", "articulo", "nombre del producto", "nombre del articulo", "name", "item name"],
  category: ["categoria", "category"],
  price: ["precio", "precio de venta", "price", "default price"],
  cost: ["costo", "cost"],
  sku: ["sku", "clave"],
  barcode: ["codigo de barras", "codigo barras", "barcode"],
  description: ["descripcion", "description"],
  stock: ["existencia inicial", "existencia", "stock", "inventario"],
  active: ["activo", "active"],
};

// Fila de ejemplo de la plantilla: si el cliente olvida borrarla, se ignora.
const EXAMPLE = { name: "tacos al pastor (orden)", sku: "tac-001" };

export type ProductRowStatus = "create" | "update" | "error" | "skip";

export interface ProductPreviewRow {
  line: number; // número de fila en el archivo (encabezado = 1)
  status: ProductRowStatus;
  name: string;
  category: string;
  price?: number;
  errors: string[];
}

export interface ProductImportAnalysis {
  rows: ProductPreviewRow[];
  toCreate: number;
  toUpdate: number;
  errors: number;
  newCategories: string[];
}

interface ParsedProduct {
  line: number;
  name: string;
  category: string;
  price?: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  description?: string;
  stock?: number;
  isActive?: boolean;
  errors: string[];
}

function pick(row: RawRow, field: keyof typeof ALIASES): string | undefined {
  for (const alias of ALIASES[field]) {
    const v = row[alias];
    if (v !== undefined && v.trim() !== "") return v.trim();
  }
  return undefined;
}

function parseRow(row: RawRow, line: number): ParsedProduct {
  const errors: string[] = [];
  const name = pick(row, "name") ?? "";
  const category = pick(row, "category") ?? "";

  if (!name) errors.push("Falta el nombre");
  if (!category) errors.push("Falta la categoría");

  const price = parseNumber(pick(row, "price"));
  if (price === undefined) errors.push("Falta el precio");
  else if (Number.isNaN(price) || price <= 0) errors.push("El precio debe ser un número mayor a 0");
  else if (price >= 100_000_000) errors.push("El precio es demasiado grande");

  const cost = parseNumber(pick(row, "cost"));
  if (cost !== undefined && (Number.isNaN(cost) || cost < 0)) errors.push("El costo debe ser un número igual o mayor a 0");

  const stockRaw = parseNumber(pick(row, "stock"));
  if (stockRaw !== undefined && (Number.isNaN(stockRaw) || stockRaw < 0)) {
    errors.push("La existencia debe ser un número igual o mayor a 0");
  }

  if (name.length > 191) errors.push("El nombre es demasiado largo");

  return {
    line,
    name,
    category,
    price: price !== undefined && !Number.isNaN(price) ? price : undefined,
    cost: cost !== undefined && !Number.isNaN(cost) ? cost : undefined,
    sku: pick(row, "sku"),
    barcode: pick(row, "barcode"),
    description: pick(row, "description"),
    stock:
      stockRaw !== undefined && !Number.isNaN(stockRaw) && stockRaw >= 0 ? Math.floor(stockRaw) : undefined,
    isActive: parseYesNo(pick(row, "active")),
    errors,
  };
}

interface Analysis {
  parsed: ParsedProduct[];
  statuses: ProductRowStatus[];
  matchedIds: (string | null)[];
  newCategories: string[];
  summary: ProductImportAnalysis;
}

async function analyze(companyId: string, rows: RawRow[]): Promise<Analysis> {
  const existing: { id: string; name: string; sku: string | null }[] = await prisma.product.findMany({
    where: { companyId },
    select: { id: true, name: true, sku: true },
  });
  const categories: { id: string; name: string }[] = await prisma.category.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });

  const bySku = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const p of existing) {
    if (p.sku) bySku.set(p.sku.trim().toLowerCase(), p.id);
    byName.set(p.name.trim().toLowerCase(), p.id);
  }
  const catNames = new Set(categories.map((c) => c.name.trim().toLowerCase()));

  const parsed: ParsedProduct[] = [];
  const statuses: ProductRowStatus[] = [];
  const matchedIds: (string | null)[] = [];
  const seenKeys = new Map<string, number>();
  const newCats = new Map<string, string>(); // lower -> nombre original

  rows.forEach((raw, i) => {
    const line = i + 2;
    const p = parseRow(raw, line);
    parsed.push(p);

    // Fila de ejemplo de la plantilla
    if (p.name.toLowerCase() === EXAMPLE.name && (p.sku ?? "").toLowerCase() === EXAMPLE.sku) {
      statuses.push("skip");
      matchedIds.push(null);
      return;
    }

    // Duplicados dentro del mismo archivo
    const key = p.sku ? `sku:${p.sku.toLowerCase()}` : `name:${p.name.toLowerCase()}`;
    if (p.name) {
      const first = seenKeys.get(key);
      if (first !== undefined) p.errors.push(`Repetido en el archivo (ya aparece en la fila ${first})`);
      else seenKeys.set(key, line);
    }

    if (p.errors.length > 0) {
      statuses.push("error");
      matchedIds.push(null);
      return;
    }

    const id =
      (p.sku ? bySku.get(p.sku.toLowerCase()) : undefined) ?? (!p.sku ? byName.get(p.name.toLowerCase()) : undefined) ?? null;
    matchedIds.push(id);
    statuses.push(id ? "update" : "create");

    const cl = p.category.toLowerCase();
    if (!catNames.has(cl) && !newCats.has(cl)) newCats.set(cl, p.category);
  });

  const previewRows: ProductPreviewRow[] = parsed.map((p, i) => ({
    line: p.line,
    status: statuses[i],
    name: p.name,
    category: p.category,
    price: p.price,
    errors: p.errors,
  }));

  return {
    parsed,
    statuses,
    matchedIds,
    newCategories: [...newCats.values()],
    summary: {
      rows: previewRows,
      toCreate: statuses.filter((s) => s === "create").length,
      toUpdate: statuses.filter((s) => s === "update").length,
      errors: statuses.filter((s) => s === "error").length,
      newCategories: [...newCats.values()],
    },
  };
}

/** Vista previa: no escribe nada en la base de datos. */
export async function previewProductsImport(companyId: string, rows: RawRow[]): Promise<ProductImportAnalysis> {
  return (await analyze(companyId, rows)).summary;
}

export interface ProductImportResult {
  created: number;
  updated: number;
  skippedWithErrors: number;
  categoriesCreated: number;
}

/**
 * Importa solo las filas válidas (las que tienen error se omiten y se reportan).
 * Vuelve a validar todo en el servidor: no confía en la vista previa.
 * `ctx.branchId`: sucursal donde se carga la existencia inicial (igual que productsService.create).
 */
export async function commitProductsImport(
  companyId: string,
  rows: RawRow[],
  ctx: { branchId: string | null; userId: string }
): Promise<ProductImportResult> {
  const a = await analyze(companyId, rows);

  // 1) Categorías nuevas
  const existingCats: { id: string; name: string }[] = await prisma.category.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });
  const catId = new Map<string, string>(existingCats.map((c) => [c.name.trim().toLowerCase(), c.id]));
  let categoriesCreated = 0;
  for (const name of a.newCategories) {
    const c = await prisma.category.create({ data: { companyId, name } });
    catId.set(name.toLowerCase(), c.id);
    categoriesCreated++;
  }

  // 2) Productos
  let created = 0;
  let updated = 0;

  for (let i = 0; i < a.parsed.length; i++) {
    const status = a.statuses[i];
    if (status !== "create" && status !== "update") continue;
    const p = a.parsed[i];
    const categoryId = catId.get(p.category.toLowerCase());
    if (!categoryId || p.price === undefined) continue; // no debería pasar tras analyze()

    if (status === "create") {
      const hasStock = p.stock !== undefined;
      const product = await prisma.product.create({
        data: {
          companyId,
          categoryId,
          name: p.name,
          price: p.price,
          cost: p.cost,
          sku: p.sku,
          barcode: p.barcode,
          description: p.description,
          isActive: p.isActive ?? true,
          tracksInventory: hasStock,
          stock: p.stock ?? 0,
        },
      });
      if (ctx.branchId && hasStock && (p.stock ?? 0) > 0) {
        await inventoryService.seedInitialStock(product.id, ctx.branchId, ctx.userId, p.stock as number);
      }
      created++;
    } else {
      const id = a.matchedIds[i] as string;
      // Solo se pisan los campos que el archivo trae con valor.
      const data: Record<string, unknown> = { categoryId, price: p.price };
      if (p.cost !== undefined) data.cost = p.cost;
      if (p.barcode !== undefined) data.barcode = p.barcode;
      if (p.description !== undefined) data.description = p.description;
      if (p.isActive !== undefined) data.isActive = p.isActive;
      if (p.sku !== undefined) data.name = p.name; // emparejó por SKU: el nombre puede haber cambiado
      if (p.stock !== undefined) data.tracksInventory = true;

      await prisma.product.updateMany({ where: { id, companyId }, data });
      if (p.stock !== undefined && ctx.branchId) {
        await inventoryService.setBranchStock(companyId, ctx.branchId, ctx.userId, id, p.stock);
      }
      updated++;
    }
  }

  await prisma.auditLog.create({
    data: {
      companyId,
      userId: ctx.userId,
      action: "IMPORT",
      entity: "Product",
      newData: { created, updated, skippedWithErrors: a.summary.errors, categoriesCreated },
    },
  });

  return { created, updated, skippedWithErrors: a.summary.errors, categoriesCreated };
}
