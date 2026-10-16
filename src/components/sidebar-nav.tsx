"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { clsx } from "clsx";

export function SidebarNav({
  items,
  brand,
  logoUrl,
  userName,
  branchSwitcher,
  branchName,
}: {
  items: { href: string; label: string }[];
  brand: string;
  /** Logo de la empresa (opcional). */
  logoUrl?: string | null;
  userName: string;
  /** Solo para quien administra sucursales y la empresa tiene más de una activa. */
  branchSwitcher?: { branches: { id: string; name: string }[]; activeId: string | null };
  /** Nombre de la sucursal donde se opera (se muestra si la empresa tiene varias). */
  branchName?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Se resalta solo la opción más específica (ej. "/clientes-frecuentes/escanear" y no también "/clientes-frecuentes").
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const activeLabel = items.find((i) => i.href === activeHref)?.label ?? brand;
  const currentBranchName = branchSwitcher
    ? branchSwitcher.branches.find((b) => b.id === branchSwitcher.activeId)?.name ?? null
    : branchName ?? null;

  async function changeBranch(branchId: string) {
    const res = await fetch("/api/branches/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId }),
    });
    if (res.ok) window.location.reload();
  }

  // Celular/tablet: el panel se cierra solo al cambiar de pantalla.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Con el panel abierto: no se mueve la página de atrás, Escape lo cierra, y si la
  // pantalla crece hasta el tamaño de computadora (ej. girar la tablet) se cierra solo.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (desktop.matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  // Mismo contenido para el menú lateral (computadora) y para el panel deslizable (celular/tablet).
  const content = (
    <>
      <div>
        <div className="px-6 py-6 border-b border-ink-line">
          {logoUrl && (
            <div className="mb-3 inline-flex rounded-md bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={brand} className="max-h-10 max-w-[10rem] object-contain" />
            </div>
          )}
          <p className="font-display text-lg font-semibold">{brand}</p>
          {branchSwitcher ? (
            <div className="mt-3">
              <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Sucursal</label>
              <select
                value={branchSwitcher.activeId ?? ""}
                onChange={(e) => changeBranch(e.target.value)}
                className="w-full rounded-md bg-white/10 border border-white/10 text-sm text-white px-2 py-2 lg:py-1.5"
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
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "rounded-md px-3 py-3 lg:py-2 text-sm font-medium transition-colors",
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
          className="text-sm lg:text-xs text-white/60 hover:text-white py-2 lg:py-0"
        >
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Computadora (1024px o más): menú lateral fijo, igual que antes. Si el menú es más largo
          que la pantalla, se desplaza solo y "Cerrar sesión" siempre queda a la vista. */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-ink-950 text-white flex-col justify-between lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        {content}
      </aside>

      {/* Celular y tablet: barra superior con botón de menú. */}
      <header
        className="lg:hidden sticky top-0 z-40 bg-ink-950 text-white border-b border-ink-line"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-2 h-14 px-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={open}
            className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-white/10"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold leading-tight truncate">{activeLabel}</p>
            <p className="text-[11px] text-white/50 leading-tight truncate">
              {[brand, currentBranchName].filter(Boolean).join(" · ")}
            </p>
          </div>
          {logoUrl && (
            <div className="shrink-0 rounded-md bg-white p-1 mr-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={brand} className="h-7 max-w-[5rem] object-contain" />
            </div>
          )}
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={() => setOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-ink-950 text-white flex flex-col justify-between overflow-y-auto animate-drawer-in"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="absolute top-2 right-2 h-11 w-11 inline-flex items-center justify-center rounded-md text-2xl leading-none text-white/70 hover:text-white hover:bg-white/10"
            >
              ×
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
