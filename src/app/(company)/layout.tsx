import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { hasPermission, PERMISSIONS, type PermissionKey } from "@/lib/permissions";

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
];

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.companyId) {
    redirect("/login");
  }

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

  const visibleNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(session.user.permissions, item.permission)
  );

  return (
    <div className="min-h-screen flex">
      <SidebarNav items={visibleNavItems} brand="Mi Restaurante" userName={session.user.name ?? ""} />
      <main className="flex-1 p-8 bg-paper">{children}</main>
    </div>
  );
}
