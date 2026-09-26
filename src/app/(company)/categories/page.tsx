import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { categoriesService } from "@/modules/categories/service";
import { CategoriesTable } from "./categories-table";

export default async function CategoriesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.CATEGORIES_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  const categories = await categoriesService.list(session.user.companyId);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Categorías</h1>
      <p className="text-muted text-sm mb-8">Organiza tu menú por secciones.</p>
      <CategoriesTable initialCategories={JSON.parse(JSON.stringify(categories))} />
    </div>
  );
}
