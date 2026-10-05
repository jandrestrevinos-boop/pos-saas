"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { clsx } from "clsx";

export function SidebarNav({
  items,
  brand,
  userName,
  branchSwitcher,
  branchName,
}: {
  items: { href: string; label: string }[];
  brand: string;
  userName: string;
  /** Solo para quien administra sucursales y la empresa tiene más de una activa. */
  branchSwitcher?: { branches: { id: string; name: string }[]; activeId: string | null };
  /** Nombre de la sucursal donde se opera (se muestra si la empresa tiene varias). */
  branchName?: string | null;
}) {
  const pathname = usePathname();

  async function changeBranch(branchId: string) {
    const res = await fetch("/api/branches/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId }),
    });
    if (res.ok) window.location.reload();
  }

  return (
    <aside className="w-60 shrink-0 bg-ink-950 text-white flex flex-col justify-between min-h-screen">
      <div>
        <div className="px-6 py-6 border-b border-ink-line">
          <p className="font-display text-lg font-semibold">{brand}</p>
          {branchSwitcher ? (
            <div className="mt-3">
              <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Sucursal</label>
              <select
                value={branchSwitcher.activeId ?? ""}
                onChange={(e) => changeBranch(e.target.value)}
                className="w-full rounded-md bg-white/10 border border-white/10 text-sm text-white px-2 py-1.5"
              >
                {branchSwitcher.branches.map((b) => (
                  <option key={b.id} value={b.id} className="text-ink">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            branchName && <p className="text-xs text-white/50 mt-1">{branchName}</p>
          )}
        </div>
        <nav className="px-3 py-4 flex flex-col gap-1">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-ember text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="px-6 py-5 border-t border-ink-line">
        <p className="text-xs text-white/40 mb-2 truncate">{userName}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-white/60 hover:text-white"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
