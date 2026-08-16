"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { clsx } from "clsx";

export function SidebarNav({
  items,
  brand,
  userName,
}: {
  items: { href: string; label: string }[];
  brand: string;
  userName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-ink-950 text-white flex flex-col justify-between min-h-screen">
      <div>
        <div className="px-6 py-6 border-b border-ink-line">
          <p className="font-display text-lg font-semibold">{brand}</p>
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
