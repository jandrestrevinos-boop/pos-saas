import { prisma } from "@/lib/prisma";
import { parseNumber, pickAlias, type RawRow } from "./parse";

const A = {
  date: ["fecha", "fecha y hora", "fecha de venta", "date"],
  folio: ["folio", "ticket", "recibo", "numero de recibo", "no de recibo", "receipt number"],
  product: ["producto", "articulo", "nombre del producto", "item", "item name"],
  qty: ["cantidad", "qty", "quantity"],
  price: ["precio unitario", "precio", "price", "unit price"],
  method: ["metodo de pago", "forma de pago", "tipo de pago", "payment type"],
  cashier: ["cajero", "empleado", "employee"],
  branch: ["sucursal", "tienda", "store"],
};

const EXAMPLE_FOLIO = "a-1001";
const IMPORT_CATEGORY = "Importados (historial)";
const MAX_LOCAL_OFFSET_HOURS = 6; // Monterrey = UTC-6 todo el año

type Method = "CASH" | "CARD" | "TRANSFER" | "MERCADOPAGO" | "OTHER";

function mapMethod(raw: string | undefined): Method {
  const v = (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (v.includes("efectivo") || v === "cash") return "CASH";
  if (v.includes("tarjeta") || v.includes("card") || v.includes("credito") || v.includes("debito")) return "CARD";
  if (v.includes("transfer") || v.includes("spei")) return "TRANSFER";
  if (v.includes("mercado")) return "MERCADOPAGO";
  return "OTHER";
}

/** Acepta AAAA-MM-DD [HH:mm[:ss]] y DD/MM/AAAA [HH:mm]. Hora local de Monterrey (UTC-6). */
export function parseSaleDate(raw: string): Date | null {
  const s = raw.trim();
  let y: number, mo: number, d: number, h = 12, mi = 0, sec = 0;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?Z?$/);
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[4] !== undefined) [h, mi, sec] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  } else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[4] !== undefined) [h, mi, sec] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || sec > 59) return null;
  const utc = Date.UTC(y, mo - 1, d, h, mi, sec) + MAX_LOCAL_OFFSET_HOURS * 3600 * 1000;
  const date = new Date(utc);
  if (date.getUTCFullYear() < 2000) return null;
  if (date.getTime() > Date.now() + 24 * 3600 * 1000) return null;
  return date;
}

interface Line {
  line: number;
  folio: string;
  date?: Date;
  product: string;
  qty?: number;
  price?: number;
  method: Method;
  cashier?: string;
  branchName?: string;
  errors: string[];
}

export interface SalesPreviewRow {
  line: number;
  folio: string;
  product: string;
  errors: string[];
}

export interface SalesImportAnalysis {
  tickets: number; // por importar
  lines: number;
  total: number;
  from: string | null;
  to: string | null;
  alreadyImported: number; // folios que ya estaban
  newProducts: string[]; // se crean inactivos
  errorRows: SalesPreviewRow[];
  errors: number;
}

export interface SalesImportResult {
  tickets: number;
  lines: number;
  total: number;
  productsCreated: number;
  alreadyImported: number;
  skippedWithErrors: number;
}

function parseLine(raw: RawRow, line: number): Line {
  const errors: string[] = [];
  const folio = pickAlias(raw, A.folio) ?? "";
  const product = pickAlias(raw, A.product) ?? "";
  if (!folio) errors.push("Falta el folio");
  if (!product) errors.push("Falta el producto");

  const dateRaw = pickAlias(raw, A.date);
  let date: Date | undefined;
  if (!dateRaw) errors.push("Falta la fecha");
  else {
    date = parseSaleDate(dateRaw) ?? undefined;
    if (!date) errors.push("Fecha inválida (usa AAAA-MM-DD HH:MM, y no puede ser futura)");
  }

  const q = parseNumber(pickAlias(raw, A.qty));
  if (q === undefined) errors.push("Falta la cantidad");
  else if (Number.isNaN(q) || q <= 0 || !Number.isInteger(q)) errors.push("La cantidad debe ser un entero mayor a 0");

  const p = parseNumber(pickAlias(raw, A.price));
  if (p === undefined) errors.push("Falta el precio unitario");
  else if (Number.isNaN(p) || p < 0 || p >= 100_000_000) errors.push("El precio unitario no es válido");

  return {
    line,
    folio,
    date,
    product,
    qty: q !== undefined && Number.isInteger(q) && q > 0 ? q : undefined,
    price: p !== undefined && !Number.isNaN(p) && p >= 0 ? p : undefined,
    method: mapMethod(pickAlias(raw, A.method)),
    cashier: pickAlias(raw, A.cashier),
    branchName: pickAlias(raw, A.branch),
    errors,
  };
}

interface Ticket {
  folio: string;
  localId: string;
  date: Date;
  method: Method;
  branchId: string;
  cashier?: string;
  lines: Line[];
  total: number;
}

interface Analysis {
  tickets: Ticket[];
  summary: SalesImportAnalysis;
  productIdByName: Map<string, string>;
  newProductPrices: Map<string, { name: string; price: number }>;
}

const localIdOf = (companyId: string, folio: string) => `import:${companyId}:${folio}`;

async function analyze(companyId: string, rows: RawRow[], defaultBranchId: string | null): Promise<Analysis> {
  if (!defaultBranchId) throw new Error("No hay una sucursal activa para asignar las ventas.");

  const lines: Line[] = rows.map((r, i) => parseLine(r, i + 2)).filter((l) => l.folio.toLowerCase() !== EXAMPLE_FOLIO);

  const branches: { id: string; name: string }[] = await prisma.branch.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });
  const branchByName = new Map(branches.map((b) => [b.name.trim().toLowerCase(), b.id]));

  // Un ticket con cualquier renglón con error se omite completo (su total quedaría mal).
  const badFolios = new Set(lines.filter((l) => l.errors.length > 0 && l.folio).map((l) => l.folio));
  for (const l of lines) {
    if (l.errors.length === 0 && badFolios.has(l.folio)) l.errors.push("Otra fila con el mismo folio tiene error");
  }

  const existingLocalIds = new Set<string>(
    (
      await prisma.order.findMany({
        where: { companyId, localId: { startsWith: `import:${companyId}:` } },
        select: { localId: true },
      })
    ).map((o: { localId: string }) => o.localId)
  );

  const products: { id: string; name: string }[] = await prisma.product.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });
  const productIdByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p.id]));

  const byFolio = new Map<string, Line[]>();
  for (const l of lines) {
    if (l.errors.length > 0) continue;
    const arr = byFolio.get(l.folio) ?? [];
    arr.push(l);
    byFolio.set(l.folio, arr);
  }

  const tickets: Ticket[] = [];
  let alreadyImported = 0;
  const newProductPrices = new Map<string, { name: string; price: number }>();

  for (const [folio, ls] of byFolio) {
    const localId = localIdOf(companyId, folio);
    if (existingLocalIds.has(localId)) {
      alreadyImported++;
      continue;
    }
    const first = ls[0];
    tickets.push({
      folio,
      localId,
      date: first.date as Date,
      method: first.method,
      branchId: (first.branchName && branchByName.get(first.branchName.trim().toLowerCase())) || defaultBranchId,
      cashier: first.cashier,
      lines: ls,
      total: ls.reduce((s, l) => s + (l.qty as number) * (l.price as number), 0),
    });
    for (const l of ls) {
      const key = l.product.trim().toLowerCase();
      if (!productIdByName.has(key) && !newProductPrices.has(key)) {
        newProductPrices.set(key, { name: l.product.trim(), price: l.price as number });
      }
    }
  }

  const errorRows = lines
    .filter((l) => l.errors.length > 0)
    .map((l) => ({ line: l.line, folio: l.folio, product: l.product, errors: l.errors }));
  const times = tickets.map((t) => t.date.getTime());

  return {
    tickets,
    productIdByName,
    newProductPrices,
    summary: {
      tickets: tickets.length,
      lines: tickets.reduce((s, t) => s + t.lines.length, 0),
      total: Math.round(tickets.reduce((s, t) => s + t.total, 0) * 100) / 100,
      from: times.length ? new Date(Math.min(...times)).toISOString() : null,
      to: times.length ? new Date(Math.max(...times)).toISOString() : null,
      alreadyImported,
      newProducts: [...newProductPrices.values()].map((p) => p.name),
      errorRows: errorRows.slice(0, 200),
      errors: errorRows.length,
    },
  };
}

/** Vista previa: no escribe nada. */
export async function previewSalesImport(
  companyId: string,
  rows: RawRow[],
  defaultBranchId: string | null
): Promise<SalesImportAnalysis> {
  return (await analyze(companyId, rows, defaultBranchId)).summary;
}

/**
 * Importa tickets históricos como ventas ya cerradas (DELIVERED) con pago APPROVED.
 * NO toca inventario, caja, cocina ni clientes frecuentes. Es idempotente: cada ticket
 * se identifica con localId "import:<empresa>:<folio>", así que re-subir el mismo archivo
 * no duplica nada (los folios ya importados se omiten).
 */
export async function commitSalesImport(
  companyId: string,
  rows: RawRow[],
  ctx: { branchId: string | null; userId: string }
): Promise<SalesImportResult> {
  const a = await analyze(companyId, rows, ctx.branchId);

  // Productos que no existían: se crean INACTIVOS para no ensuciar el menú del POS.
  let productsCreated = 0;
  if (a.newProductPrices.size > 0) {
    const cats: { id: string; name: string }[] = await prisma.category.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    let cat = cats.find((c) => c.name.trim().toLowerCase() === IMPORT_CATEGORY.toLowerCase());
    if (!cat) cat = await prisma.category.create({ data: { companyId, name: IMPORT_CATEGORY, isActive: false } });
    for (const [key, p] of a.newProductPrices) {
      const created = await prisma.product.create({
        data: { companyId, categoryId: (cat as { id: string }).id, name: p.name, price: p.price, isActive: false },
      });
      a.productIdByName.set(key, created.id);
      productsCreated++;
    }
  }

  const BATCH = 10;
  for (let i = 0; i < a.tickets.length; i += BATCH) {
    await Promise.all(
      a.tickets.slice(i, i + BATCH).map((t) =>
        prisma.order.create({
          data: {
            localId: t.localId,
            companyId,
            branchId: t.branchId,
            userId: ctx.userId,
            status: "DELIVERED" as const,
            isOpenTab: false,
            orderType: "COMER_AQUI" as const,
            notes: `Venta importada (folio ${t.folio})${t.cashier ? ` - Cajero: ${t.cashier}` : ""}`,
            subtotal: t.total,
            discount: 0,
            tax: 0,
            total: t.total,
            createdAt: t.date,
            items: {
              create: t.lines.map((l) => ({
                productId: a.productIdByName.get(l.product.trim().toLowerCase()) as string,
                quantity: l.qty as number,
                unitPriceAtSale: l.price as number,
                lineTotal: (l.qty as number) * (l.price as number),
                status: "DELIVERED" as const,
                roundNumber: 1,
                createdAt: t.date,
              })),
            },
            payments: { create: { method: t.method, status: "APPROVED" as const, amount: t.total, createdAt: t.date } },
          },
        })
      )
    );
  }

  const result: SalesImportResult = {
    tickets: a.summary.tickets,
    lines: a.summary.lines,
    total: a.summary.total,
    productsCreated,
    alreadyImported: a.summary.alreadyImported,
    skippedWithErrors: a.summary.errors,
  };

  await prisma.auditLog.create({
    data: {
      companyId,
      userId: ctx.userId,
      action: "IMPORT",
      entity: "Order",
      newData: {
        tickets: result.tickets,
        lines: result.lines,
        total: result.total,
        productsCreated: result.productsCreated,
        alreadyImported: result.alreadyImported,
        skippedWithErrors: result.skippedWithErrors,
      },
    },
  });
  return result;
}
