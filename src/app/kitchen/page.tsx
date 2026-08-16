import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { kitchenService } from "@/modules/kitchen/service";
import { KitchenClient } from "./kitchen-client";
import Link from "next/link";

export default async function KitchenPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  const enabled = await kitchenService.isEnabledForCompany(session.user.companyId);

  if (!enabled) {
    return (
      <div className="h-screen flex items-center justify-center bg-paper">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl font-semibold mb-2">Función no incluida en tu plan</p>
          <p className="text-muted text-sm mb-6">
            La Pantalla de Cocina está disponible en los planes Profesional y Empresarial. Súbete de plan para
            reemplazar tu impresora de comandas por una tablet en cocina.
          </p>
          <Link href="/dashboard" className="inline-block rounded-md bg-ember text-white px-5 py-3 text-sm font-medium">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <KitchenClient />;
}
