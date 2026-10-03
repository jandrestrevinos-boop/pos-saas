import { redirect } from "next/navigation";
import { billingService } from "@/modules/billing/service";

/**
 * Candado de cobro para páginas de empresa: si el demo / periodo pagado ya
 * venció (y se acabó la gracia), manda a /facturacion. Se usa en el layout
 * de (company), en /pos y en /kitchen. Devuelve el estado para que el layout
 * pueda mostrar el aviso de "tu demo termina en X días".
 */
export async function requireBillingAccess(companyId: string) {
  const access = await billingService.getAccess(companyId);
  if (!access.allowed) {
    redirect("/facturacion");
  }
  return access;
}
