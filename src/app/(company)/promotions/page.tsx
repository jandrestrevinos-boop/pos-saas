import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { PromotionsClient } from "./promotions-client";

export default async function PromotionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  const companyId = session.user.companyId;
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, categoryId: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Promociones</h1>
      <p className="text-muted text-sm mb-8">
        Descuentos que el Punto de Venta aplica solos, por horario o con un cupón que escribe el cajero.
      </p>
      <PromotionsClient products={products} categories={categories} />
    </div>
  );
}
