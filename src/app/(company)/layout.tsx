import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { hasPermission, PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { requireBillingAccess } from "@/lib/billing-gate";
import Link from "next/link";
import { alertsService } from "@/modules/alerts/service";
import { getTenantContext, resolveBranchId } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";

const BASE_NAV_ITEMS: { href: string; label: string; permission?: PermissionKey }[] = [
  { href: "/pos", label: "Punto de Venta", permission: PERMISSIONS.SALES_CREATE },
  { href: "/kitchen", label: "Cocina", permission: PERMISSIONS.KITCHEN_VIEW },
  { href: "/dashboard", label: "Dashboard", permission: PERMISSIONS.REPORTS_VIEW },
  { href: "/cash", label: "Caja", permission: PERMISSIONS.CASH_OPEN },
  { href: "/reports", label: "Reportes", permission: PERMISSIONS.REPORTS_VIEW },
  { href: "/sales-history", label: "Historial de ventas", permission: PERMISSIONS.REPORTS_VIEW },
  { href: "/audit-log", label: "Auditoría", permission: PERMISSIONS.SETTINGS_MANAGE },
  { href: "/inventory", label: "Inventario", permission: PERMISSIONS.INVENTORY_MANAGE },
  { href: "/products", label: "Productos", permission: PERMISSIONS.PRODUCTS_MANAGE },
  { href: "/categories", label: "Categorías", permission: PERMISSIONS.CATEGORIES_MANAGE },
  { href: "/branches", label: "Sucursales", permission: PERMISSIONS.BRANCHES_MANAGE },
  { href: "/users", label: "Usuarios", permission: PERMISSIONS.USERS_MANAGE },
  { href: "/settings", label: "Configuración", permission: PERMISSIONS.SETTINGS_MANAGE },
  // El restaurante puede ver su plan y pagar su mensualidad en cualquier momento,
  // no solo cuando el demo ya venció.
  { href: "/facturacion", label: "Mi plan y pagos", permission: PERMISSIONS.SETTINGS_MANAGE },
];

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.companyId) {
    redirect("/login");
  }

  // Candado de cobro: demo / periodo pagado vencido (+ gracia) => /facturacion.
  const billing = await requireBillingAccess(session.user.companyId);
  const showBillingBanner =
    billing.state === "GRACE" || (billing.state === "DEMO" && billing.daysLeft !== null && billing.daysLeft <= 5);

  // El nav en sí no reemplaza el gating real (page.tsx de cada ruta valida
  // hasFeature/hasPermission de nuevo) — esto es solo para no mostrar un
  // link a algo que la empresa no tiene contratado, o que este usuario no
  // puede abrir por su rol (mesero/cajero no ven Reportes ni Dashboard,
  // cocinero solo ve Cocina, etc.).
  const tablesEnabled = await hasFeature(session.user.companyId, FEATURE_KEYS.GESTION_MESAS);
  const dashboardEmpresarialEnabled = await hasFeature(session.user.companyId, FEATURE_KEYS.DASHBOARD_EMPRESARIAL);

  let navItems: { href: string; label: string; permission?: PermissionKey }[] = tablesEnabled
    ? [
        BASE_NAV_ITEMS[0],
        { href: "/tables", label: "Mesas", permission: PERMISSIONS.TABLES_MANAGE },
        ...BASE_NAV_ITEMS.slice(1),
      ]
    : BASE_NAV_ITEMS;

  if (dashboardEmpresarialEnabled && hasPermission(session.user.permissions, PERMISSIONS.REPORTS_VIEW)) {
    const dashboardIndex = navItems.findIndex((item) => item.href === "/dashboard");
    navItems = [
      ...navItems.slice(0, dashboardIndex + 1),
      { href: "/dashboard-empresarial", label: "Dashboard empresarial", permission: PERMISSIONS.REPORTS_VIEW },
      ...navItems.slice(dashboardIndex + 1),
    ];
  }

  // Alertas (stock bajo / agotado / caja abierta de más): el nav muestra cuántas hay.
  if (hasPermission(session.user.permissions, PERMISSIONS.INVENTORY_MANAGE)) {
    const alertCount = await alertsService.count(session.user.companyId);
    const inventoryIndex = navItems.findIndex((item) => item.href === "/inventory");
    const alertItem = {
      href: "/alerts",
      label: alertCount > 0 ? `Alertas (${alertCount})` : "Alertas",
      permission: PERMISSIONS.INVENTORY_MANAGE,
    };
    navItems = [...navItems.slice(0, inventoryIndex + 1), alertItem, ...navItems.slice(inventoryIndex + 1)];
  }

  // Sucursal activa: si la empresa tiene varias sucursales activas, el nav muestra
  // dónde se está operando, y quien administra sucursales puede cambiar de una a otra.
  const activeBranches = await prisma.branch.findMany({
    where: { companyId: session.user.companyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const tenantCtx = await getTenantContext();
  const activeBranchId = await resolveBranchId(tenantCtx, session.user.companyId);
  const hasManyBranches = activeBranches.length > 1;
  const canSwitchBranch = hasManyBranches && hasPermission(session.user.permissions, PERMISSIONS.BRANCHES_MANAGE);
  const activeBranchName = activeBranches.find((b) => b.id === activeBranchId)?.name ?? null;

  const visibleNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(session.user.permissions, item.permission)
  );

  return (
    <div className="min-h-screen flex">
      <SidebarNav
        items={visibleNavItems}
        brand="Mi Restaurante"
        userName={session.user.name ?? ""}
        branchSwitcher={canSwitchBranch ? { branches: activeBranches, activeId: activeBranchId } : undefined}
        branchName={hasManyBranches && !canSwitchBranch ? activeBranchName : null}
      />
      <main className="flex-1 p-8 bg-paper">
        {showBillingBanner && (
          <div className="mb-6 rounded-md border border-marigold/40 bg-marigold/10 px-4 py-3 text-sm">
            {billing.state === "GRACE" ? (
              <span>
                Tu plan venció. Tienes <strong>{billing.graceDaysLeft} {billing.graceDaysLeft === 1 ? "día" : "días"}</strong> para
                regularizar tu pago antes de que se bloquee el acceso.{" "}
              </span>
            ) : (
              <span>
                Tu demo termina en <strong>{billing.daysLeft} {billing.daysLeft === 1 ? "día" : "días"}</strong>.{" "}
              </span>
            )}
            <Link href="/facturacion" className="underline font-medium">
              Ir a facturación
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
