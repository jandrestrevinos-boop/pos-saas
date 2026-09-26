import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.REPORTS_VIEW)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Reportes</h1>
      <p className="text-muted text-sm mb-8">Ventas por rango de fechas, producto y método de pago.</p>
      <ReportsClient />
    </div>
  );
}
