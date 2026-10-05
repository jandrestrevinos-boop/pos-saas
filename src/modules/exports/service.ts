import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export const EXPORT_DATASETS = ["sales", "products", "movements", "customers"] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

const MAX_ROWS = 20000;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PREPARATION: "En preparación",
  READY: "Lista",
  DELIVERED: "Entregada",
  CANCELED: "Cancelada",
};
const TYPE_LABELS: Record<string, string> = { COMER_AQUI: "Comer aquí", PARA_LLEVAR: "Para llevar", DOMICILIO: "A domicilio" };
const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
  MERCADOPAGO: "Mercado Pago (link/QR)",
  MERCADOPAGO_TERMINAL: "Mercado Pago (terminal)",
};
const MOVEMENT_LABELS: Record<string, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste", WASTE: "Merma" };

export const exportsService = {
  /** Devuelve { filename, csv } listo para responder. Todo filtrado por companyId. */
  async build(companyId: string, dataset: ExportDataset, range: { from?: Date; to?: Date }) {
    const stamp = new Date().toISOString().slice(0, 10);

    if (dataset === "sales") {
      const orders = await prisma.order.findMany({
        where: {
          companyId,
          isOpenTab: false,
          createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) },
        },
        include: {
          items: { include: { product: { select: { name: true } } } },
          payments: { select: { method: true, status: true, amount: true } },
          user: { select: { name: true } },
          table: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      });

      const csv = toCsv(
        ["Folio", "Fecha", "Sucursal", "Atendió", "Mesa", "Tipo", "Estatus", "Productos", "Subtotal", "Descuento", "Impuesto", "Total", "Pago"],
        orders.map((o) => [
          o.orderNumber,
          o.createdAt,
          o.branch?.name ?? "",
          o.user?.name ?? "",
          o.table?.name ?? "",
          TYPE_LABELS[o.orderType] ?? o.orderType,
          STATUS_LABELS[o.status] ?? o.status,
          o.items.map((i) => `${i.quantity} x ${i.product.name}`).join("; "),
          Number(o.subtotal),
          Number(o.discount),
          Number(o.tax),
          Number(o.total),
          o.payments
            .filter((p) => p.status === "APPROVED")
            .map((p) => `${METHOD_LABELS[p.method] ?? p.method} ${Number(p.amount).toFixed(2)}`)
            .join("; "),
        ])
      );
      return { filename: `tappy-ventas-${stamp}.csv`, csv, rows: orders.length };
    }

    if (dataset === "products") {
      const products = await prisma.product.findMany({
        where: { companyId },
        include: { category: { select: { name: true } } },
        orderBy: { name: "asc" },
        take: MAX_ROWS,
      });
      const csv = toCsv(
        ["Producto", "SKU", "Categoría", "Precio", "Costo", "Controla inventario", "Existencia", "Existencia mínima", "Activo"],
        products.map((p) => [
          p.name,
          p.sku ?? "",
          p.category.name,
          Number(p.price),
          p.cost === null ? "" : Number(p.cost),
          p.tracksInventory ? "Sí" : "No",
          p.tracksInventory ? p.stock : "",
          p.tracksInventory ? p.minStock : "",
          p.isActive ? "Sí" : "No",
        ])
      );
      return { filename: `tappy-productos-${stamp}.csv`, csv, rows: products.length };
    }

    if (dataset === "movements") {
      const movements = await prisma.inventoryMovement.findMany({
        where: {
          product: { companyId },
          createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) },
        },
        include: { product: { select: { name: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      });
      const csv = toCsv(
        ["Fecha", "Producto", "Tipo", "Cantidad", "Motivo", "Usuario"],
        movements.map((m) => [m.createdAt, m.product.name, MOVEMENT_LABELS[m.type] ?? m.type, m.quantity, m.reason ?? "", m.user.name])
      );
      return { filename: `tappy-movimientos-inventario-${stamp}.csv`, csv, rows: movements.length };
    }

    // customers
    const customers = await prisma.customer.findMany({
      where: { companyId },
      include: { _count: { select: { orders: true } } },
      orderBy: { name: "asc" },
      take: MAX_ROWS,
    });
    const csv = toCsv(
      ["Cliente", "Teléfono", "Correo", "Pedidos", "Alta"],
      customers.map((c) => [c.name, c.phone ?? "", c.email ?? "", c._count.orders, c.createdAt])
    );
    return { filename: `tappy-clientes-${stamp}.csv`, csv, rows: customers.length };
  },
};
