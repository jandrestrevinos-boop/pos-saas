import { prisma } from "@/lib/prisma";

type ReportOrder = {
  userId: string;
  total: number | string;
  user: { name: string };
  payments: { method: string; amount: number | string }[];
  items: {
    productId: string;
    quantity: number;
    lineTotal: number | string;
    product: { name: string; categoryId: string; cost: number | string | null; category: { name: string } };
  }[];
};

export const reportsService = {
  async salesReport(companyId: string, from: Date, to: Date) {
    const orders = (await prisma.order.findMany({
      where: { companyId, createdAt: { gte: from, lte: to }, status: { not: "CANCELED" } },
      include: {
        items: { include: { product: { include: { category: true } } } },
        payments: true,
        user: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })) as unknown as ReportOrder[];

    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    const byPaymentMethod: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0, OTHER: 0 };
    for (const order of orders) {
      for (const payment of order.payments) {
        byPaymentMethod[payment.method] = (byPaymentMethod[payment.method] ?? 0) + Number(payment.amount);
      }
    }

    let totalCost = 0;
    let itemsWithoutCost = 0;

    const productTotals = new Map<string, { name: string; quantity: number; revenue: number; cost: number }>();
    const categoryTotals = new Map<string, { name: string; revenue: number; cost: number }>();

    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId;
        const hasCost = item.product.cost !== null && item.product.cost !== undefined;
        const unitCost = hasCost ? Number(item.product.cost) : 0;
        const lineCost = unitCost * item.quantity;
        totalCost += lineCost;
        if (!hasCost) itemsWithoutCost += item.quantity;

        const current = productTotals.get(key) ?? { name: item.product.name, quantity: 0, revenue: 0, cost: 0 };
        current.quantity += item.quantity;
        current.revenue += Number(item.lineTotal);
        current.cost += lineCost;
        productTotals.set(key, current);

        const catKey = item.product.categoryId;
        const catCurrent = categoryTotals.get(catKey) ?? { name: item.product.category.name, revenue: 0, cost: 0 };
        catCurrent.revenue += Number(item.lineTotal);
        catCurrent.cost += lineCost;
        categoryTotals.set(catKey, catCurrent);
      }
    }

    const totalProfit = totalSales - totalCost;
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    const topProducts = [...productTotals.values()]
      .map((p) => ({ ...p, profit: p.revenue - p.cost }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    const byCategory = [...categoryTotals.values()]
      .map((c) => ({ ...c, profit: c.revenue - c.cost }))
      .sort((a, b) => b.revenue - a.revenue);

    const byUser = new Map<string, { name: string; total: number; count: number }>();
    for (const order of orders) {
      const current = byUser.get(order.userId) ?? { name: order.user.name, total: 0, count: 0 };
      current.total += Number(order.total);
      current.count += 1;
      byUser.set(order.userId, current);
    }

    return {
      totalSales,
      totalOrders,
      avgTicket,
      totalCost,
      totalProfit,
      profitMargin,
      itemsWithoutCost,
      byPaymentMethod,
      topProducts,
      byCategory,
      byUser: [...byUser.values()].sort((a, b) => b.total - a.total),
      orders,
    };
  },

  /**
   * Datos para el Dashboard empresarial: reusa salesReport() para no
   * duplicar la lógica de costos/categorías/etc., y le agrega encima las
   * series de tiempo (día, hora, día de la semana) que salesReport no
   * calcula, más Food Cost % y margen de contribución por producto.
   */
  async enterpriseDashboard(companyId: string, days: number = 30) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);

    const report = await this.salesReport(companyId, from, to);

    const dailyMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }

    const hourly = Array(24).fill(0) as number[];
    const weekdayTotals = Array(7).fill(0) as number[]; // 0=domingo...6=sábado (Date.getDay())

    for (const order of report.orders as unknown as { createdAt: Date; total: number | string }[]) {
      const date = new Date(order.createdAt);
      const dayKey = date.toISOString().slice(0, 10);
      if (dailyMap.has(dayKey)) dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + Number(order.total));
      hourly[date.getHours()] += Number(order.total);
      weekdayTotals[date.getDay()] += Number(order.total);
    }

    const dailyTrend = [...dailyMap.entries()].map(([date, total]) => ({ date, total }));

    const foodCostPercent = report.totalSales > 0 ? (report.totalCost / report.totalSales) * 100 : 0;

    const contributionMargin = report.topProducts
      .map((p) => ({
        name: p.name,
        marginTotal: p.revenue - p.cost,
        marginPercent: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.marginTotal - a.marginTotal);

    return {
      totalSales: report.totalSales,
      totalOrders: report.totalOrders,
      avgTicket: report.avgTicket,
      totalCost: report.totalCost,
      totalProfit: report.totalProfit,
      profitMargin: report.profitMargin,
      foodCostPercent,
      byPaymentMethod: report.byPaymentMethod,
      topProducts: report.topProducts,
      byCategory: report.byCategory,
      byUser: report.byUser,
      contributionMargin,
      dailyTrend,
      hourly,
      weekdayTotals,
      days,
    };
  },
};