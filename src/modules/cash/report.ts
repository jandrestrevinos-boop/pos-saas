import { prisma } from "@/lib/prisma";

/**
 * Cortes X y Z de caja (día por sucursal).
 *
 * "Día" = un CashRegister: desde que se abre (con su fondo) hasta el corte Z. Así la
 * fecha operativa no depende de la medianoche: un restaurante que cierra de madrugada
 * sigue en el mismo día hasta que alguien hace el Z.
 *
 * Las ventas del día son los PAGOS APROBADOS cuyo createdAt cae dentro de la ventana
 * [openedAt, ahora/cierre] de ventas no canceladas de esa sucursal. Se cuenta por el
 * momento del cobro (no de la creación del pedido) para que una cuenta de mesa o un
 * pedido de WhatsApp cobrados hoy cuenten hoy, aunque hayan nacido antes.
 */

export const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  "CARD:ZETTLE": "Tarjeta · Zettle",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "Mercado Pago",
  MERCADOPAGO_TERMINAL: "Terminal Mercado Pago",
  OTHER: "Otro",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  COMER_AQUI: "Comer aquí",
  PARA_LLEVAR: "Para llevar",
  DOMICILIO: "Domicilio",
};

const MOVEMENT_LABELS: Record<string, string> = {
  CASH_IN: "Entrada",
  CASH_OUT: "Retiro",
  REFUND: "Devolución",
  SALE: "Venta",
};

export type CancelledSale = { orderNumber: number; amount: number; cashAmount: number; cancelledAt: string };

export type CutReport = {
  kind: "X" | "Z";
  companyName: string;
  branchName: string;
  registerId: string;
  folio: number | null;
  openedAt: string;
  generatedAt: string;
  openedBy: string | null;
  generatedBy: string | null;
  autoOpened: boolean;
  // tips / totalCollected son opcionales porque los cortes Z viejos guardados no los traen.
  // "total" = ventas SIN propina; totalCollected = ventas + propinas (lo que entró en total).
  sales: {
    tickets: number;
    subtotal: number;
    discounts: number;
    total: number;
    averageTicket: number;
    tips?: number;
    totalCollected?: number;
  };
  byMethod: { method: string; label: string; count: number; amount: number }[];
  byOrderType: { type: string; label: string; count: number; amount: number }[];
  byCashier: { name: string; tickets: number; amount: number }[];
  promotions: { name: string; count: number; amount: number }[];
  // Cancelaciones registradas durante este día. "sameDay" = la venta también se cobró hoy
  // (ya no está en las ventas de arriba). "previousDays" = ajuste: la venta pertenece a un día
  // ya cerrado con Z (ese Z no se modifica); si se devolvió efectivo, registrar una Devolución.
  cancellations: {
    sameDay: { count: number; amount: number; items: CancelledSale[] };
    previousDays: { count: number; amount: number; cashAmount: number; items: CancelledSale[] };
  };
  cash: {
    opening: number;
    sales: number;
    cashIn: number;
    cashOut: number;
    tips?: number; // propinas cobradas en efectivo: están en la caja y entran al efectivo esperado
    expected: number;
    counted: number | null;
    difference: number | null;
  };
  movements: { type: string; label: string; amount: number; reason: string | null; user: string; createdAt: string }[];
  // Lo que impide hacer el Z (openTabs, pendingPayments) o solo se informa (whatsappUnpaid).
  pending: { openTabs: number; pendingPayments: number; whatsappUnpaid: number };
};

type BuildOptions = {
  kind: "X" | "Z";
  upTo: Date;
  generatedBy?: string | null;
  counted?: number | null;
  folio?: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

type PaymentRow = {
  method: string;
  cardProvider?: string | null;
  amount: unknown;
  orderId: string;
  order: {
    subtotal: unknown;
    discount: unknown;
    tip?: unknown;
    orderType: string;
    user: { name: string } | null;
    promotions: { name: string; amount: unknown }[];
  };
};

type MovementRow = {
  type: string;
  amount: unknown;
  reason: string | null;
  createdAt: Date;
  user: { name: string };
};

type CancelledOrderRow = {
  id: string;
  orderNumber: number;
  payments: { method: string; status: string; amount: unknown; createdAt: Date }[];
};

export const cashReportService = {
  async build(registerId: string, opts: BuildOptions): Promise<CutReport> {
    const register = await prisma.cashRegister.findUnique({
      where: { id: registerId },
      include: {
        branch: { select: { id: true, name: true, companyId: true, company: { select: { name: true } } } },
        movements: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!register) throw new Error("No se encontró el día de caja");

    const branchId = register.branchId;
    const companyId = register.branch.companyId;
    const window = { gte: register.openedAt, lte: opts.upTo };

    // ---- Ventas: pagos aprobados dentro de la ventana, de ventas no canceladas ----
    const payments = (await prisma.payment.findMany({
      where: {
        status: "APPROVED",
        createdAt: window,
        order: { branchId, status: { not: "CANCELED" } },
      },
      include: {
        order: {
          select: {
            subtotal: true,
            discount: true,
            tip: true,
            orderType: true,
            user: { select: { name: true } },
            promotions: { select: { name: true, amount: true } },
          },
        },
      },
    })) as unknown as PaymentRow[];

    const methodMap = new Map<string, { count: number; amount: number }>();
    const typeMap = new Map<string, { count: number; amount: number }>();
    const cashierMap = new Map<string, { tickets: Set<string>; amount: number }>();
    const promoMap = new Map<string, { count: number; amount: number }>();
    const seenOrders = new Set<string>();
    let subtotal = 0;
    let discounts = 0;
    let total = 0;
    let tips = 0; // propinas de todos los métodos (van aparte de las ventas)
    let cashTips = 0; // las que se cobraron en efectivo (están físicamente en la caja)

    for (const p of payments) {
      const amount = Number(p.amount);
      total += amount;

      // Tarjeta con Zettle se separa de las demás tarjetas; el resto agrupa por método.
      const methodKey = p.method === "CARD" && p.cardProvider ? `CARD:${p.cardProvider}` : p.method;
      const m = methodMap.get(methodKey) ?? { count: 0, amount: 0 };
      m.count += 1;
      m.amount += amount;
      methodMap.set(methodKey, m);

      const t = typeMap.get(p.order.orderType) ?? { count: 0, amount: 0 };
      t.amount += amount;
      typeMap.set(p.order.orderType, t);

      const cashierName = p.order.user?.name ?? "Sin dato";
      const c = cashierMap.get(cashierName) ?? { tickets: new Set<string>(), amount: 0 };
      c.tickets.add(p.orderId);
      c.amount += amount;
      cashierMap.set(cashierName, c);

      // Datos por pedido (una sola vez aunque tuviera más de un pago).
      if (!seenOrders.has(p.orderId)) {
        seenOrders.add(p.orderId);
        subtotal += Number(p.order.subtotal);
        discounts += Number(p.order.discount);
        const orderTip = Number(p.order.tip ?? 0);
        tips += orderTip;
        if (p.method === "CASH") cashTips += orderTip;
        t.count += 1;
        for (const promo of p.order.promotions) {
          const pr = promoMap.get(promo.name) ?? { count: 0, amount: 0 };
          pr.count += 1;
          pr.amount += Number(promo.amount);
          promoMap.set(promo.name, pr);
        }
      }
    }

    const tickets = seenOrders.size;

    // ---- Cancelaciones registradas durante este día ----
    const cancelLogs = (await prisma.auditLog.findMany({
      where: { companyId, action: "SALE_CANCEL", entity: "Order", createdAt: window },
      select: { entityId: true, createdAt: true },
    })) as unknown as { entityId: string | null; createdAt: Date }[];

    const cancelIds = cancelLogs.map((l) => l.entityId).filter((id): id is string => !!id);
    const cancelledOrders = (cancelIds.length
      ? await prisma.order.findMany({
          where: { id: { in: cancelIds }, branchId },
          select: {
            id: true,
            orderNumber: true,
            payments: { select: { method: true, status: true, amount: true, createdAt: true } },
          },
        })
      : []) as unknown as CancelledOrderRow[];
    const cancelledAt = new Map(cancelLogs.map((l) => [l.entityId, l.createdAt]));

    const sameDay: CancelledSale[] = [];
    const previousDays: CancelledSale[] = [];
    for (const o of cancelledOrders) {
      const approved = o.payments.filter((p) => p.status === "APPROVED");
      if (approved.length === 0) continue; // cancelar algo que nunca se cobró no mueve dinero
      const amount = approved.reduce((s, p) => s + Number(p.amount), 0);
      const cashAmount = approved.filter((p) => p.method === "CASH").reduce((s, p) => s + Number(p.amount), 0);
      const paidAt = Math.min(...approved.map((p) => p.createdAt.getTime()));
      const row: CancelledSale = {
        orderNumber: o.orderNumber,
        amount: round2(amount),
        cashAmount: round2(cashAmount),
        cancelledAt: (cancelledAt.get(o.id) ?? opts.upTo).toISOString(),
      };
      if (paidAt >= register.openedAt.getTime()) sameDay.push(row);
      else previousDays.push(row);
    }

    // ---- Efectivo ----
    const movements = register.movements as unknown as MovementRow[];
    const cashIn = movements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + Number(m.amount), 0);
    const cashOut = movements
      .filter((m) => m.type === "CASH_OUT" || m.type === "REFUND")
      .reduce((s, m) => s + Number(m.amount), 0);
    const cashSales = methodMap.get("CASH")?.amount ?? 0;
    const opening = Number(register.openingCash);
    const expected = opening + cashSales + cashTips + cashIn - cashOut;
    const counted = opts.counted ?? null;

    // ---- Pendientes ----
    const [openTabs, pendingPayments, whatsappUnpaid] = await Promise.all([
      prisma.order.count({ where: { branchId, isOpenTab: true, status: { not: "CANCELED" } } }),
      prisma.payment.count({
        where: { status: "PENDING", createdAt: window, order: { branchId, status: { not: "CANCELED" } } },
      }),
      prisma.order.count({
        where: {
          branchId,
          status: { not: "CANCELED" },
          whatsAppCart: { isNot: null },
          payments: { none: { status: "APPROVED" } },
        },
      }),
    ]);

    // ---- Quién abrió ----
    const openLog = (await prisma.auditLog.findFirst({
      where: { companyId, entity: "CashRegister", entityId: register.id, action: "CASH_OPEN" },
      select: { userId: true },
    })) as unknown as { userId: string | null } | null;
    const opener =
      openLog?.userId
        ? ((await prisma.user.findUnique({ where: { id: openLog.userId }, select: { name: true } })) as unknown as {
            name: string;
          } | null)
        : null;

    return {
      kind: opts.kind,
      companyName: register.branch.company.name,
      branchName: register.branch.name,
      registerId: register.id,
      folio: opts.folio ?? register.folio ?? null,
      openedAt: register.openedAt.toISOString(),
      generatedAt: opts.upTo.toISOString(),
      openedBy: opener?.name ?? null,
      generatedBy: opts.generatedBy ?? null,
      autoOpened: register.autoOpened,
      sales: {
        tickets,
        subtotal: round2(subtotal),
        discounts: round2(discounts),
        total: round2(total),
        averageTicket: tickets > 0 ? round2(total / tickets) : 0,
        tips: round2(tips),
        totalCollected: round2(total + tips),
      },
      byMethod: [...methodMap.entries()]
        .map(([method, v]) => ({ method, label: METHOD_LABELS[method] ?? method, count: v.count, amount: round2(v.amount) }))
        .sort((a, b) => b.amount - a.amount),
      byOrderType: [...typeMap.entries()]
        .map(([type, v]) => ({ type, label: ORDER_TYPE_LABELS[type] ?? type, count: v.count, amount: round2(v.amount) }))
        .sort((a, b) => b.amount - a.amount),
      byCashier: [...cashierMap.entries()]
        .map(([name, v]) => ({ name, tickets: v.tickets.size, amount: round2(v.amount) }))
        .sort((a, b) => b.amount - a.amount),
      promotions: [...promoMap.entries()]
        .map(([name, v]) => ({ name, count: v.count, amount: round2(v.amount) }))
        .sort((a, b) => b.amount - a.amount),
      cancellations: {
        sameDay: {
          count: sameDay.length,
          amount: round2(sameDay.reduce((s, r) => s + r.amount, 0)),
          items: sameDay,
        },
        previousDays: {
          count: previousDays.length,
          amount: round2(previousDays.reduce((s, r) => s + r.amount, 0)),
          cashAmount: round2(previousDays.reduce((s, r) => s + r.cashAmount, 0)),
          items: previousDays,
        },
      },
      cash: {
        opening: round2(opening),
        sales: round2(cashSales),
        tips: round2(cashTips),
        cashIn: round2(cashIn),
        cashOut: round2(cashOut),
        expected: round2(expected),
        counted: counted === null ? null : round2(counted),
        difference: counted === null ? null : round2(counted - expected),
      },
      movements: movements.map((m) => ({
        type: m.type,
        label: MOVEMENT_LABELS[m.type] ?? m.type,
        amount: round2(Number(m.amount)),
        reason: m.reason,
        user: m.user.name,
        createdAt: m.createdAt.toISOString(),
      })),
      pending: { openTabs, pendingPayments, whatsappUnpaid },
    };
  },
};
