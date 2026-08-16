import { prisma } from "@/lib/prisma";

// Tipo mínimo explícito de lo que usamos de cada orden — evita depender de
// la inferencia automática completa de Prisma para este cálculo.
type ReportOrder = {
  userId: string;
  total: number | string;
  user: { name: string };
  payments: { method: string; amount: number | string }[];
  items: {
    productId: string;
    quantity: number;
    lineTotal: number | string;
    product: { name: string; categoryId: string; category: { name: string } };
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

    const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
    const categoryTotals = new Map<string, { name: string; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId;
        const current = productTotals.get(key) ?? { name: item.product.name, quantity: 0, revenue: 0 };
        current.quantity += item.quantity;
        current.revenue += Number(item.lineTotal);
        productTotals.set(key, current);

        const catKey = item.product.categoryId;
        const catCurrent = categoryTotals.get(catKey) ?? { name: item.product.category.name, revenue: 0 };
        catCurrent.revenue += Number(item.lineTotal);
        categoryTotals.set(catKey, catCurrent);
      }
    }

    const topProducts = [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const byCategory = [...categoryTotals.values()].sort((a, b) => b.revenue - a.revenue);

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
      byPaymentMethod,
      topProducts,
      byCategory,
      byUser: [...byUser.values()].sort((a, b) => b.total - a.total),
      orders,
    };
  },
};
