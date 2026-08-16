import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui";

export default async function PlataformaDashboard() {
  const [totalCompanies, activeCompanies, suspendedCompanies, totalBranches, totalUsers] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: "ACTIVE" } }),
    prisma.company.count({ where: { status: "SUSPENDED" } }),
    prisma.branch.count(),
    prisma.user.count(),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Dashboard general</h1>
      <p className="text-muted text-sm mb-8">Vista global de la plataforma.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Empresas totales" value={totalCompanies} />
        <StatCard label="Empresas activas" value={activeCompanies} />
        <StatCard label="Empresas suspendidas" value={suspendedCompanies} />
        <StatCard label="Sucursales" value={totalBranches} />
        <StatCard label="Usuarios registrados" value={totalUsers} />
      </div>
    </div>
  );
}
