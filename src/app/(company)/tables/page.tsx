import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantContext, resolveBranchId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { tablesService } from "@/modules/tables/service";
import { TablesClient } from "./tables-client";
import Link from "next/link";

export default async function TablesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  const enabled = await hasFeature(session.user.companyId, FEATURE_KEYS.GESTION_MESAS);

  if (!enabled) {
    return (
      <div className="h-screen flex items-center justify-center bg-paper">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl font-semibold mb-2">Función no incluida en tu plan</p>
          <p className="text-muted text-sm mb-6">
            Gestión de mesas no está activa para tu empresa. Contacta a soporte para agregarla a tu plan.
          </p>
          <Link href="/dashboard" className="inline-block rounded-md bg-ember text-white px-5 py-3 text-sm font-medium">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!hasPermission(session.user.permissions, PERMISSIONS.TABLES_MANAGE)) {
    redirect("/dashboard");
  }

  const ctx = await getTenantContext();
  const branchId = await resolveBranchId(ctx, session.user.companyId);
  const tables = branchId ? await tablesService.list(session.user.companyId, branchId) : [];

  return <TablesClient initialTables={JSON.parse(JSON.stringify(tables))} />;
}
