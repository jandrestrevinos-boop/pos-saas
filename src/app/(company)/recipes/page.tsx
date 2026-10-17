import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { RecipesClient } from "./recipes-client";

export default async function RecipesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  if (!(await hasFeature(session.user.companyId, FEATURE_KEYS.COSTEO_RECETA))) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="font-display text-2xl font-semibold mb-2">Función no incluida en tu plan</p>
        <p className="text-muted text-sm mb-6">
          El costeo por receta no está activo para tu empresa. Contacta a soporte para agregarlo a tu plan.
        </p>
        <Link href="/products" className="inline-block rounded-md bg-ember text-white px-5 py-3 text-sm font-medium">
          Ir a Productos
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Insumos y recetas</h1>
      <p className="text-muted text-sm mb-8">
        Da de alta tus insumos con su costo y arma la receta de cada platillo: Tappy calcula su costo, margen y Food Cost %, y
        ese costo alimenta tus reportes y el dashboard.
      </p>
      <RecipesClient />
    </div>
  );
}
