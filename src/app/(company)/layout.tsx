import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";

const NAV_ITEMS = [
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
];

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.companyId) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <SidebarNav items={NAV_ITEMS} brand="Mi Restaurante" userName={session.user.name ?? ""} />
      <main className="flex-1 p-8 bg-paper">{children}</main>
    </div>
  );
}
