import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { productsService } from "@/modules/products/service";
import { categoriesService } from "@/modules/categories/service";
import { getTenantContext, resolveBranchId } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";
import { ProductsTable } from "./products-table";

export default async function ProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  const companyId = session.user.companyId;

  const ctx = await getTenantContext();
  const [rawProducts, categories, branchId, branchCount] = await Promise.all([
    productsService.list(companyId),
    categoriesService.list(companyId),
    resolveBranchId(ctx, companyId),
    prisma.branch.count({ where: { companyId, isActive: true } }),
  ]);

  // La existencia es por sucursal: la tabla muestra la de la sucursal donde se opera
  // (en empresas de una sola sucursal coincide con el total de siempre).
  const branchStocks = branchId
    ? await prisma.branchStock.findMany({ where: { branchId, product: { companyId } }, select: { productId: true, stock: true } })
    : [];
  const stockByProduct = new Map(branchStocks.map((s) => [s.productId, s.stock]));
  const products = rawProducts.map((p) => (p.tracksInventory ? { ...p, stock: stockByProduct.get(p.id) ?? 0 } : p));
  const multiBranch = branchCount > 1;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Productos</h1>
      <p className="text-muted text-sm mb-8">El catálogo que verán tus cajeros en el punto de venta.</p>

      {categories.length === 0 ? (
        <p className="text-sm text-muted bg-marigold/10 border border-marigold/30 rounded-md px-4 py-3">
          Necesitas crear al menos una categoría antes de agregar productos.{" "}
          <a href="/categories" className="underline font-medium">
            Ir a Categorías
          </a>
        </p>
      ) : (
        <ProductsTable
          initialProducts={JSON.parse(JSON.stringify(products))}
          categories={JSON.parse(JSON.stringify(categories))}
          multiBranch={multiBranch}
        />
      )}
    </div>
  );
}
