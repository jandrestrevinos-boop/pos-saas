import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { categoriesService } from "@/modules/categories/service";
import { productsService } from "@/modules/products/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getTenantContext, resolveBranchId } from "@/lib/tenant-context";
import { cashService } from "@/modules/cash/service";
import { PosClient } from "./pos-client";
import Link from "next/link";

export default async function PosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.SALES_CREATE)) {
    redirect("/dashboard");
  }

  const ctx = await getTenantContext();
  const branchId = await resolveBranchId(ctx, session.user.companyId);
  const cashStatus = branchId ? await cashService.getStatus(branchId) : { open: false as const };

  if (!cashStatus.open) {
    return (
      <div className="h-screen flex items-center justify-center bg-paper">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl font-semibold mb-2">La caja está cerrada</p>
          <p className="text-muted text-sm mb-6">Necesitas abrir la caja antes de poder registrar ventas.</p>
          <Link href="/cash" className="inline-block rounded-md bg-ember text-white px-5 py-3 text-sm font-medium">
            Ir a Caja
          </Link>
        </div>
      </div>
    );
  }

  const [categories, products] = await Promise.all([
    categoriesService.list(session.user.companyId),
    productsService.list(session.user.companyId),
  ]);

  const activeProducts = products.filter((p: (typeof products)[number]) => p.isActive);

  return (
    <PosClient
      categories={JSON.parse(JSON.stringify(categories.filter((c: (typeof categories)[number]) => c.isActive)))}
      products={JSON.parse(JSON.stringify(activeProducts))}
      userName={session.user.name ?? ""}
    />
  );
}
