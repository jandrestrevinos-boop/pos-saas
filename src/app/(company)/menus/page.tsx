import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { MenusClient } from "./menus-client";

export default async function MenusPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  const companyId = session.user.companyId;
  if (!(await hasFeature(companyId, FEATURE_KEYS.MENUS_COMPLETOS))) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="font-display text-2xl font-semibold mb-2">Función no incluida en tu plan</p>
        <p className="text-muted text-sm mb-6">
          Los menús completos no están activos para tu empresa. Contacta a soporte para agregarlos a tu plan.
        </p>
        <Link href="/products" className="inline-block rounded-md bg-ember text-white px-5 py-3 text-sm font-medium">
          Ir a Productos
        </Link>
      </div>
    );
  }

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    // Las opciones de un menú son productos normales (con su propia receta/costo), nunca otros menús.
    prisma.product.findMany({ where: { companyId, isActive: true, isMenu: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Menús completos</h1>
      <p className="text-muted text-sm mb-8">
        Arma comidas con precio fijo: elige qué guarniciones, sopas o bebidas lleva cada una. Las opciones con cargo extra 0 van incluidas
        en el precio; las demás suman al total al elegirlas.
      </p>
      <MenusClient categories={categories} products={products} />
    </div>
  );
}
