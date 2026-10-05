import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { alertsService, alertBranchScope, CASH_OPEN_ALERT_HOURS } from "@/modules/alerts/service";
import { getTenantContext } from "@/lib/tenant-context";
import { Card } from "@/components/ui";

export default async function AlertsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.INVENTORY_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  const ctx = await getTenantContext();
  const scope = await alertBranchScope(ctx, session.user.companyId);
  const { stockAlerts, cashAlerts, total } = await alertsService.getAlerts(session.user.companyId, scope);
  const showBranch = new Set(stockAlerts.map((a) => a.branchName)).size > 1 || scope === undefined;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Alertas</h1>
      <p className="text-muted text-sm mb-8">Lo que necesita tu atención hoy en inventario y caja.</p>

      {total === 0 && (
        <Card className="p-6 text-sm">
          <p className="font-medium mb-1">Todo en orden ✓</p>
          <p className="text-muted">
            No hay productos agotados ni por debajo de su mínimo, y ninguna caja lleva demasiado tiempo abierta. Para recibir
            avisos de stock bajo, define la existencia mínima de tus productos en{" "}
            <Link href="/products" className="underline">
              Productos
            </Link>
            .
          </p>
        </Card>
      )}

      {stockAlerts.length > 0 && (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Inventario ({stockAlerts.length})</p>
          <Card className="overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-5 py-3 font-medium">Categoría</th>
                  {showBranch && <th className="px-5 py-3 font-medium">Sucursal</th>}
                  <th className="px-5 py-3 font-medium">Existencia</th>
                  <th className="px-5 py-3 font-medium">Mínimo</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stockAlerts.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium">{a.name}</td>
                    <td className="px-5 py-3 text-muted">{a.category}</td>
                    {showBranch && <td className="px-5 py-3 text-muted">{a.branchName}</td>}
                    <td className="px-5 py-3 font-mono">{a.stock}</td>
                    <td className="px-5 py-3 font-mono text-muted">{a.minStock > 0 ? a.minStock : "—"}</td>
                    <td className="px-5 py-3">
                      <span className={a.level === "OUT" ? "text-ember-dark font-medium" : "text-marigold-dark font-medium"}>
                        {a.level === "OUT" ? "Agotado" : "Stock bajo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {cashAlerts.length > 0 && (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Caja ({cashAlerts.length})</p>
          <Card className="overflow-hidden">
            <ul className="text-sm">
              {cashAlerts.map((c) => (
                <li key={c.id} className="px-5 py-3 border-b border-line last:border-0">
                  <span className="font-medium">{c.branchName}</span>: una caja lleva abierta <strong>{c.hoursOpen} horas</strong> (más
                  de {CASH_OPEN_ALERT_HOURS}). ¿Se te olvidó hacer el corte?{" "}
                  <Link href="/cash" className="underline">
                    Ir a Caja
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
