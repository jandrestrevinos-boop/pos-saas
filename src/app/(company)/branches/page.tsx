import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { getTenantContext, resolveBranchId } from "@/lib/tenant-context";
import { branchesService } from "@/modules/branches/service";
import { BranchesClient } from "./branches-client";

export default async function BranchesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.BRANCHES_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  const ctx = await getTenantContext();
  const [{ branches, limit, activeCount }, activeBranchId] = await Promise.all([
    branchesService.overview(session.user.companyId),
    resolveBranchId(ctx, session.user.companyId),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Sucursales</h1>
      <p className="text-muted text-sm mb-8">
        Ubicaciones de tu restaurante.
        {limit !== null && (
          <span className="ml-2 text-xs font-medium">
            ({activeCount} de {limit} sucursales de tu plan)
          </span>
        )}
      </p>
      <BranchesClient
        initialBranches={JSON.parse(JSON.stringify(branches))}
        limit={limit}
        activeBranchId={activeBranchId}
      />
    </div>
  );
}
