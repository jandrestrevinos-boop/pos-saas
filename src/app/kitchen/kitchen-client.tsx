"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { id: string; quantity: number; product: { name: string } };
// Un "ticket" es una RONDA de una orden (no la orden completa) — así una
// mesa con cuenta abierta puede tener varios tickets activos a la vez, cada
// uno con su propio avance, sin que uno reviva a los demás.
type Ticket = {
  id: string; // "orderId:roundNumber"
  orderNumber: number;
  roundNumber: number;
  tableName: string | null;
  status: "PENDING" | "IN_PREPARATION" | "READY";
  createdAt: string;
  items: Item[];
  userName: string;
};

const COLUMNS: { status: Ticket["status"]; label: string; accent: string }[] = [
  { status: "PENDING", label: "Pendiente", accent: "border-ember" },
  { status: "IN_PREPARATION", label: "En preparación", accent: "border-marigold" },
  { status: "READY", label: "Listo", accent: "border-sage" },
];

const ACTION_LABEL: Record<Ticket["status"], string> = {
  PENDING: "Empezar a preparar",
  IN_PREPARATION: "Marcar listo",
  READY: "Entregar",
};

function minutesAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

export function KitchenClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/kitchen/orders");
    if (res.ok) setTickets((await res.json()).tickets);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // se actualiza sola cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  async function advance(ticketId: string) {
    // Actualización optimista: mueve la tarjeta de inmediato en pantalla,
    // sin esperar la respuesta del servidor, para que se sienta instantáneo.
    setTickets((prev) => prev.filter((t) => t.id !== ticketId || nextStatus(t.status) !== "DELIVERED"));
    await fetch(`/api/kitchen/orders/${ticketId}`, { method: "PATCH" });
    load();
  }

  function nextStatus(status: Ticket["status"]) {
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
            const columnTickets = tickets.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="flex flex-col overflow-hidden">
                <p className="text-white/70 text-sm font-medium uppercase tracking-wide mb-3 px-1">
                  {col.label} <span className="text-white/40">({columnTickets.length})</span>
                </p>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {columnTickets.length === 0 ? (
                    <p className="text-white/30 text-sm px-1">Sin pedidos</p>
                  ) : (
                    columnTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => advance(ticket.id)}
                        className={`w-full text-left bg-ink-800 border-l-4 ${col.accent} rounded-md p-4 active:scale-[0.98] transition-transform`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-display text-xl font-semibold text-white">
                            #{ticket.orderNumber}
                            {ticket.roundNumber > 1 && (
                              <span className="text-marigold text-sm font-mono ml-1.5">Ronda {ticket.roundNumber}</span>
                            )}
                          </p>
                          <p className="text-xs text-white/40 font-mono">{minutesAgo(ticket.createdAt)} min</p>
                        </div>
                        {ticket.tableName && <p className="text-xs text-white/50 mb-2">{ticket.tableName}</p>}
                        <ul className="space-y-1 mb-3">
                          {ticket.items.map((item) => (
                            <li key={item.id} className="text-sm text-white/90">
                              <span className="font-mono text-marigold">{item.quantity}x</span> {item.product.name}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-white/40 mb-2">{ticket.userName}</p>
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
