import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { CashClient } from "./cash-client";

export default async function CashPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.CASH_OPEN)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Caja</h1>
      <p className="text-muted text-sm mb-8">Apertura, movimientos y corte de tu sucursal.</p>
      <CashClient userName={session!.user.name ?? ""} />
    </div>
  );
}
