import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, Button } from "@/components/ui";
import { formatMxn } from "@/lib/format";
import Link from "next/link";
import { MonthlyRevenueChart } from "./monthly-revenue-chart";

export default async function CompanyDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.REPORTS_VIEW)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  const companyId = session.user.companyId;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [productCount, categoryCount, branchCount, userCount, todayOrders, monthOrders] = await Promise.all([
    prisma.product.count({ where: { companyId } }),
    prisma.category.count({ where: { companyId } }),
    prisma.branch.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId } }),
    prisma.order.findMany({ where: { companyId, createdAt: { gte: startOfDay }, status: { not: "CANCELED" } } }),
    prisma.order.findMany({ where: { companyId, createdAt: { gte: startOfMonth }, status: { not: "CANCELED" } } }),
  ]);

  type OrderRow = (typeof todayOrders)[number];
  const todayTotal = todayOrders.reduce((sum: number, o: OrderRow) => sum + Number(o.total), 0);
  const monthTotal = monthOrders.reduce((sum: number, o: OrderRow) => sum + Number(o.total), 0);
  const avgTicket = todayOrders.length > 0 ? todayTotal / todayOrders.length : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
        <Link href="/pos">
          <Button>Abrir Punto de Venta</Button>
        </Link>
      </div>
      <p className="text-muted text-sm mb-8">Resumen de tu restaurante.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Ventas del día" value={formatMxn(todayTotal)} sublabel={`${todayOrders.length} ventas`} />
        <StatCard label="Ventas del mes" value={formatMxn(monthTotal)} />
        <StatCard label="Ticket promedio" value={todayOrders.length > 0 ? formatMxn(avgTicket) : "—"} />
        <StatCard label="Productos más vendidos" value="—" sublabel="Se activa en Fase 4" />
      </div><MonthlyRevenueChart />

      <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Catálogo actual</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Productos" value={productCount} />
        <StatCard label="Categorías" value={categoryCount} />
        <StatCard label="Sucursales" value={branchCount} />
        <StatCard label="Usuarios" value={userCount} />
      </div>
    </div>
  );
}
