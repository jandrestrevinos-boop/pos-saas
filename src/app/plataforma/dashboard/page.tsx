import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui";
import { formatMxn } from "@/lib/format";
import { CompaniesByPlanChart } from "./companies-by-plan-chart";

export default async function PlataformaDashboard() {
  const [totalCompanies, activeCompanies, suspendedCompanies, totalBranches, totalUsers, plans] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: "ACTIVE" } }),
    prisma.company.count({ where: { status: "SUSPENDED" } }),
    prisma.branch.count(),
    prisma.user.count(),
    prisma.plan.findMany({
      include: {
        subscriptions: {
          where: { status: { in: ["ACTIVE", "TRIALING"] } },
          include: { company: { select: { status: true } } },
        },
      },
      orderBy: { priceMxn: "asc" },
    }),
  ]);

  let monthlyPlatformRevenue = 0;
  const companiesByPlan = plans.map((plan: (typeof plans)[number]) => {
    const activeSubs = plan.subscriptions.filter((s: (typeof plan.subscriptions)[number]) => s.company.status === "ACTIVE");
    monthlyPlatformRevenue += activeSubs.length * Number(plan.priceMxn);
    return { name: plan.name, count: activeSubs.length };
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Dashboard general</h1>
      <p className="text-muted text-sm mb-8">Vista global de la plataforma.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Ingreso mensual de la plataforma"
          value={formatMxn(monthlyPlatformRevenue)}
          sublabel="Suma de planes de empresas activas"
        />
        <StatCard label="Empresas totales" value={totalCompanies} />
        <StatCard label="Empresas activas" value={activeCompanies} />
        <StatCard label="Empresas suspendidas" value={suspendedCompanies} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Sucursales" value={totalBranches} />
        <StatCard label="Usuarios registrados" value={totalUsers} />
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Empresas por plan</p>
      <CompaniesByPlanChart data={companiesByPlan} />
    </div>
  );
}