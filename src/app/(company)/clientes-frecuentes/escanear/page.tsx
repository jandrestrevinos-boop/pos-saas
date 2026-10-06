import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { hasFeature, isLoyaltyOnly } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { ScanClient } from "./scan-client";

export const dynamic = "force-dynamic";

export default async function EscanearPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");
  const companyId = session.user.companyId;

  if (!hasPermission(session.user.permissions, PERMISSIONS.LOYALTY_SCAN)) {
    redirect(getHomeRoute(session.user.permissions, { loyaltyOnly: await isLoyaltyOnly(companyId) }));
  }

  if (!(await hasFeature(companyId, FEATURE_KEYS.CLIENTES_FRECUENTES))) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold mb-1">Escanear cliente</h1>
        <p className="text-muted text-sm max-w-md mt-6">El programa de clientes frecuentes no está incluido en tu plan.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Escanear cliente</h1>
      <p className="text-muted text-sm mb-6">Escanea la tarjeta del cliente para sumar su visita o canjear su descuento.</p>
      <ScanClient />
    </div>
  );
}
