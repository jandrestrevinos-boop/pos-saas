import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { SalesHistoryClient } from "./sales-history-client";

export default async function SalesHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.REPORTS_VIEW)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Historial de ventas</h1>
      <p className="text-muted text-sm mb-8">
        Cada venta aparece aquí en cuanto se cobra — la lista se actualiza sola cada 5 segundos.
      </p>
      <SalesHistoryClient />
    </div>
  );
}
