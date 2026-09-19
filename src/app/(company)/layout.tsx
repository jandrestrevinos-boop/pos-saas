import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";

const BASE_NAV_ITEMS = [
  { href: "/pos", label: "Punto de Venta" },
  { href: "/kitchen", label: "Cocina" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cash", label: "Caja" },
  { href: "/reports", label: "Reportes" },
  { href: "/inventory", label: "Inventario" },
  { href: "/products", label: "Productos" },
  { href: "/categories", label: "Categorías" },
  { href: "/branches", label: "Sucursales" },
  { href: "/users", label: "Usuarios" },
  { href: "/settings", label: "Configuración" },
];

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.companyId) {
    redirect("/login");
  }

  // El nav en sí no reemplaza el gating real (page.tsx de cada ruta valida
  // hasFeature/hasPermission de nuevo) — esto es solo para no mostrar un
  // link a algo que la empresa no tiene contratado.
  const tablesEnabled = await hasFeature(session.user.companyId, FEATURE_KEYS.GESTION_MESAS);
  const navItems = tablesEnabled
    ? [
        BASE_NAV_ITEMS[0],
        { href: "/tables", label: "Mesas" },
        ...BASE_NAV_ITEMS.slice(1),
      ]
    : BASE_NAV_ITEMS;

  return (
    <div className="min-h-screen flex">
      <SidebarNav items={navItems} brand="Mi Restaurante" userName={session.user.name ?? ""} />
      <main className="flex-1 p-8 bg-paper">{children}</main>
    </div>
  );
}
