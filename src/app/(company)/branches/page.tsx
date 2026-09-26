import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Card, StatusBadge } from "@/components/ui";

export default async function BranchesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.BRANCHES_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  const branches = await prisma.branch.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { createdAt: "asc" },
  });
  type BranchRow = (typeof branches)[number];

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Sucursales</h1>
      <p className="text-muted text-sm mb-8">Ubicaciones de tu restaurante.</p>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Sucursal</th>
              <th className="px-5 py-3 font-medium">Dirección</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b: BranchRow) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-medium">{b.name}</td>
                <td className="px-5 py-3 text-muted">{b.address ?? "—"}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={b.isActive ? "active" : "inactive"} label={b.isActive ? "Activa" : "Inactiva"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted mt-4">
        Crear y editar sucursales adicionales llega en la siguiente iteración — por ahora cada empresa nace con su
        sucursal principal.
      </p>
    </div>
  );
}
