"use client";

import { useEffect, useState, Fragment } from "react";
import { formatMxn } from "@/lib/format";
import { Card } from "@/components/ui";

type OrderItem = { id: string; quantity: number; lineTotal: string; product: { name: string } };
type Payment = { id: string; method: string; status: string; amount: string };
type OrderRow = {
  id: string;
  orderNumber: number;
  status: string;
  orderType: string;
  total: string;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
  user: { name: string } | null;
  table: { name: string } | null;
  branch: { name: string } | null;
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
  MERCADOPAGO: "Mercado Pago (link/QR)",
  MERCADOPAGO_TERMINAL: "Mercado Pago (terminal)",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  COMER_AQUI: "Comer aquí",
  PARA_LLEVAR: "Para llevar",
  DOMICILIO: "A domicilio",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function SalesHistoryClient() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/sales-history?from=${from}&to=${to}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 5000); // en tiempo real: se actualiza sola cada 5 segundos
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function cancelOrder(orderId: string) {
    if (!confirm("¿Cancelar esta venta? Se repone el inventario, pero si ya se cobró de verdad (tarjeta, Mercado Pago), el reembolso hay que hacerlo aparte.")) {
      return;
    }
    setCancellingId(orderId);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cancelar la venta");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la venta");
    } finally {
      setCancellingId(null);
    }
  }

  function setPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-muted mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm" />
        </div>
        <button onClick={() => setPreset(1)} className="text-sm underline text-muted">Hoy</button>
        <button onClick={() => setPreset(7)} className="text-sm underline text-muted">7 días</button>
        <button onClick={() => setPreset(30)} className="text-sm underline text-muted">30 días</button>
      </div>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted text-sm">Cargando...</p>
      ) : orders.length === 0 ? (
        <p className="text-muted text-sm">No hay ventas en este rango.</p>
      ) : (
        <Card className="ticket-edge overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper text-xs uppercase text-muted">
              <tr>
                <th className="text-left px-4 py-3">Folio</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Método</th>
                <th className="text-left px-4 py-3">Cajero</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">​</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Fragment key={order.id}>
                  <tr
                    className="border-t border-line cursor-pointer hover:bg-paper"
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  >
                    <td className="px-4 py-3 font-mono">#{order.orderNumber}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(order.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      {order.table ? `Mesa ${order.table.name}` : ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}
                    </td>
                    <td className="px-4 py-3">
                      {order.payments.map((p) => PAYMENT_LABELS[p.method] ?? p.method).join(", ")}
                    </td>
                    <td className="px-4 py-3">{order.user?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatMxn(order.total)}</td>
                    <td className="px-4 py-3">
                      {order.status === "CANCELED" ? (
                        <span className="text-xs bg-ember/10 text-ember-dark px-2 py-0.5 rounded-full">Cancelada</span>
                      ) : (
                        <span className="text-xs bg-sage-light text-sage px-2 py-0.5 rounded-full">Completada</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {order.status !== "CANCELED" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelOrder(order.id);
                          }}
                          disabled={cancellingId === order.id}
                          className="text-xs underline text-ember-dark disabled:opacity-50"
                        >
                          {cancellingId === order.id ? "Cancelando..." : "Cancelar"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === order.id && (
                    <tr className="border-t border-line bg-paper">
                      <td colSpan={8} className="px-4 py-3">
                        <ul className="text-sm space-y-1">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex justify-between">
                              <span>{item.quantity}x {item.product.name}</span>
                              <span className="font-mono">{formatMxn(item.lineTotal)}</span>
                            </li>
                          ))}
                        </ul>
                        {order.branch?.name && <p className="text-xs text-muted mt-2">Sucursal: {order.branch.name}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
