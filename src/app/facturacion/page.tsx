import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { billingService } from "@/modules/billing/service";
import { FacturacionClient } from "./facturacion-client";

/**
 * Pantalla de pago del plan. Vive FUERA del grupo (company) a propósito:
 * el layout de (company) bloquea a las empresas con demo/plan vencido y las
 * manda justo aquí, así que esta ruta no puede tener ese mismo candado.
 */
export default async function FacturacionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!session.user.companyId) redirect("/plataforma/dashboard");

  const overview = await billingService.getOverview(session.user.companyId);
  const canPay = hasPermission(session.user.permissions, PERMISSIONS.SETTINGS_MANAGE);

  return (
    <div className="min-h-screen bg-paper">
      <FacturacionClient overview={JSON.parse(JSON.stringify(overview))} canPay={canPay} />
    </div>
  );
}
