import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { CortesZClient } from "./cortes-z-client";

export default async function CortesZPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.CASH_REPORT_Z)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Cortes Z</h1>
      <p className="text-muted text-sm mb-8">
        Cierres de día por sucursal, con su folio consecutivo. Cada corte se guarda tal como se hizo y no cambia.
      </p>
      <CortesZClient />
    </div>
  );
}
