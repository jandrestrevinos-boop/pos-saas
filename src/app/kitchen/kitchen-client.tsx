"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type OrderItem = { id: string; quantity: number; product: { name: string } };
type Order = {
  id: string;
  orderNumber: number;
  status: "PENDING" | "IN_PREPARATION" | "READY";
  createdAt: string;
  items: OrderItem[];
  user: { name: string };
};

const COLUMNS: { status: Order["status"]; label: string; accent: string }[] = [
  { status: "PENDING", label: "Pendiente", accent: "border-ember" },
  { status: "IN_PREPARATION", label: "En preparación", accent: "border-marigold" },
  { status: "READY", label: "Listo", accent: "border-sage" },
];

const ACTION_LABEL: Record<Order["status"], string> = {
  PENDING: "Empezar a preparar",
  IN_PREPARATION: "Marcar listo",
  READY: "Entregar",
};

function minutesAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

export function KitchenClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/kitchen/orders");
    if (res.ok) setOrders((await res.json()).orders);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // se actualiza sola cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  async function advance(orderId: string) {
    // Actualización optimista: mueve la tarjeta de inmediato en pantalla,
    // sin esperar la respuesta del servidor, para que se sienta instantáneo.
    setOrders((prev) => prev.filter((o) => o.id !== orderId || nextStatus(o.status) !== "DELIVERED"));
    await fetch(`/api/kitchen/orders/${orderId}`, { method: "PATCH" });
    load();
  }

  function nextStatus(status: Order["status"]) {
    return status === "PENDING" ? "IN_PREPARATION" : status === "IN_PREPARATION" ? "READY" : "DELIVERED";
  }

  return (
    <div className="h-screen flex flex-col bg-ink-950">
      <header className="flex items-center justify-between px-6 py-4 border-b border-ink-line shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-white/50 hover:text-white">
            ← Salir
          </Link>
          <p className="font-display text-lg font-semibold text-white">Cocina</p>
        </div>
        <p className="text-xs text-white/40 font-mono">Se actualiza sola cada 5s</p>
      </header>

      {loading ? (
        <p className="text-white/50 text-sm p-6">Cargando...</p>
      ) : (
        <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-hidden">
          {COLUMNS.map((col) => {
            const columnOrders = orders.filter((o) => o.status === col.status);
            return (
              <div key={col.status} className="flex flex-col overflow-hidden">
                <p className="text-white/70 text-sm font-medium uppercase tracking-wide mb-3 px-1">
                  {col.label} <span className="text-white/40">({columnOrders.length})</span>
                </p>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {columnOrders.length === 0 ? (
                    <p className="text-white/30 text-sm px-1">Sin pedidos</p>
                  ) : (
                    columnOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => advance(order.id)}
                        className={`w-full text-left bg-ink-800 border-l-4 ${col.accent} rounded-md p-4 active:scale-[0.98] transition-transform`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-display text-xl font-semibold text-white">#{order.orderNumber}</p>
                          <p className="text-xs text-white/40 font-mono">{minutesAgo(order.createdAt)} min</p>
                        </div>
                        <ul className="space-y-1 mb-3">
                          {order.items.map((item) => (
                            <li key={item.id} className="text-sm text-white/90">
                              <span className="font-mono text-marigold">{item.quantity}x</span> {item.product.name}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-white/40 mb-2">{order.user.name}</p>
                        <p className="text-xs font-medium text-white/70 bg-white/10 rounded px-2 py-1.5 text-center">
                          Tocar para: {ACTION_LABEL[col.status]}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
