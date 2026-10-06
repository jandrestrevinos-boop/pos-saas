import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { hasFeature, isLoyaltyOnly } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { loyaltyService } from "@/modules/loyalty/service";
import { LoyaltyAdminClient } from "./loyalty-admin-client";

export const dynamic = "force-dynamic";

export default async function ClientesFrecuentesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");
  const companyId = session.user.companyId;

  if (!hasPermission(session.user.permissions, PERMISSIONS.LOYALTY_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions, { loyaltyOnly: await isLoyaltyOnly(companyId) }));
  }

  if (!(await hasFeature(companyId, FEATURE_KEYS.CLIENTES_FRECUENTES))) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold mb-1">Clientes frecuentes</h1>
        <p className="text-muted text-sm max-w-md mt-6">
          El programa de clientes frecuentes no está incluido en tu plan. Contacta a Tappy para activarlo como
          complemento.
        </p>
      </div>
    );
  }

  const [program, stats, customers] = await Promise.all([
    loyaltyService.getProgram(companyId),
    loyaltyService.stats(companyId),
    loyaltyService.listCustomers(companyId),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Clientes frecuentes</h1>
      <p className="text-muted text-sm mb-8">
        Premia a quien te visita seguido: tarjeta digital con QR, visitas y descuento automático.
      </p>
      <LoyaltyAdminClient
        initialProgram={JSON.parse(JSON.stringify(program))}
        initialStats={stats}
        initialCustomers={JSON.parse(JSON.stringify(customers))}
      />
    </div>
  );
}
