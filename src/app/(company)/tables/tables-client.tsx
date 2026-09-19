"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

type TableStatus = "LIBRE" | "OCUPADA" | "CUENTA" | "LIMPIEZA";
type TableRow = { id: string; name: string; capacity: number | null; status: TableStatus };
type OrderItemRow = { id: string; quantity: number; lineTotal: string; product: { name: string } };
type OpenOrder = { id: string; subtotal: string; total: string; items: OrderItemRow[] };

const STATUS_LABEL: Record<TableStatus, string> = {
  LIBRE: "Libre",
  OCUPADA: "Ocupada",
  CUENTA: "Cuenta",
  LIMPIEZA: "Limpieza",
};

const STATUS_COLOR: Record<TableStatus, string> = {
  LIBRE: "bg-sage/15 text-sage border-sage/30",
  OCUPADA: "bg-ember/15 text-ember-dark border-ember/30",
  CUENTA: "bg-marigold/20 text-marigold-dark border-marigold/40",
  LIMPIEZA: "bg-ink-100 text-muted border-line",
};

export function TablesClient({ initialTables }: { initialTables: TableRow[] }) {
  const router = useRouter();
  const [tables, setTables] = useState<TableRow[]>(initialTables);
  const [newName, setNewName] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ticketTable, setTicketTable] = useState<TableRow | null>(null);
  const [ticketOrder, setTicketOrder] = useState<OpenOrder | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  async function createTable() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), capacity: newCapacity || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la mesa");
      setTables((prev) => [...prev, data.table]);
      setNewName("");
      setNewCapacity("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la mesa");
    } finally {
      setBusy(false);
    }
  }

  async function removeTable(tableId: string) {
    if (!confirm("¿Eliminar esta mesa?")) return;
    const res = await fetch(`/api/tables/${tableId}`, { method: "DELETE" });
    if (res.ok) setTables((prev) => prev.filter((t) => t.id !== tableId));
  }

  async function advanceBussing(tableId: string) {
    // Solo para el ciclo post-cobro: Cuenta → Limpieza → Libre. Ocupada ya
    // no avanza así — se cierra desde el ticket (ver openTicket/closeTab).
    const res = await fetch(`/api/tables/${tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    const data = await res.json();
    if (res.ok) setTables((prev) => prev.map((t) => (t.id === tableId ? data.table : t)));
  }

  async function handleTableClick(table: TableRow) {
    if (table.status === "LIBRE") {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/tables/${table.id}/open`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo abrir la mesa");
        router.push(`/pos?tableId=${table.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo abrir la mesa");
        setBusy(false);
      }
      return;
    }

    if (table.status === "OCUPADA") {
      setTicketTable(table);
      setLoadingTicket(true);
      try {
        const res = await fetch(`/api/tables/${table.id}/order`);
        const data = await res.json();
        setTicketOrder(data.order);
      } finally {
        setLoadingTicket(false);
      }
      return;
    }

    // CUENTA / LIMPIEZA: sigue siendo el ciclo manual de antes.
    advanceBussing(table.id);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Mesas</h1>
          <p className="text-muted text-sm">
            Libre: toca para abrir la cuenta. Ocupada: toca para ver el ticket y cobrar. Cuenta/Limpieza: toca para avanzar.
          </p>
        </div>
      </div>

      <div className="flex items-end gap-2 mb-6 bg-white border border-line rounded-md p-4">
        <div className="flex-1">
          <label className="block text-xs text-muted mb-1">Nombre de la mesa</label>
          <input
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            placeholder="Mesa 5 / Terraza 2"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-muted mb-1">Capacidad</label>
          <input
            type="number"
            min="1"
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            value={newCapacity}
            onChange={(e) => setNewCapacity(e.target.value)}
          />
        </div>
        <button
          onClick={createTable}
          disabled={busy || !newName.trim()}
          className="rounded-md bg-ember text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Agregar mesa
        </button>
      </div>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tables.map((table) => (
          <div
            key={table.id}
            className={clsx("border rounded-lg p-4 text-center cursor-pointer transition-colors", STATUS_COLOR[table.status])}
            onClick={() => handleTableClick(table)}
          >
            <p className="font-display text-lg font-semibold">{table.name}</p>
            {table.capacity && <p className="text-xs opacity-70">{table.capacity} personas</p>}
            <p className="text-xs font-medium mt-2">{STATUS_LABEL[table.status]}</p>
            {table.status === "LIBRE" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTable(table.id);
                }}
                className="text-xs underline opacity-60 hover:opacity-100 mt-2"
              >
                Eliminar
              </button>
            )}
          </div>
        ))}
        {tables.length === 0 && <p className="text-muted text-sm col-span-full">Aún no hay mesas registradas.</p>}
      </div>

      {ticketTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-xl font-semibold">{ticketTable.name}</p>
              <button
                onClick={() => {
                  setTicketTable(null);
                  setTicketOrder(null);
                }}
                className="text-muted text-sm"
              >
                Cerrar
              </button>
            </div>

            {loadingTicket ? (
              <p className="text-muted text-sm">Cargando...</p>
            ) : !ticketOrder || ticketOrder.items.length === 0 ? (
              <p className="text-muted text-sm mb-4">Todavía no se ha mandado ningún producto a esta mesa.</p>
            ) : (
              <div className="mb-4 max-h-64 overflow-y-auto">
                {ticketOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm py-1 border-b border-line last:border-0">
                    <span>
                      {item.quantity}x {item.product.name}
                    </span>
                    <span>${Number(item.lineTotal).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2">
                  <span>Total</span>
                  <span>${Number(ticketOrder.total).toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push(`/pos?tableId=${ticketTable.id}`)}
                className="w-full rounded-md border border-line px-4 py-3 text-sm font-medium"
              >
                Agregar productos
              </button>
              <button
                onClick={() => setCloseOpen(true)}
                disabled={!ticketOrder || ticketOrder.items.length === 0}
                className="w-full rounded-md bg-ember text-white px-4 py-3 text-sm font-medium disabled:opacity-50"
              >
                Cobrar mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {closeOpen && ticketOrder && ticketTable && (
        <CloseTabModal
          order={ticketOrder}
          onClose={() => setCloseOpen(false)}
          onDone={() => {
            setCloseOpen(false);
            setTicketTable(null);
            setTicketOrder(null);
            router.refresh();
            setTables((prev) => prev.map((t) => (t.id === ticketTable.id ? { ...t, status: "CUENTA" } : t)));
          }}
        />
      )}
    </div>
  );
}

function CloseTabModal({
  order,
  onClose,
  onDone,
}: {
  order: OpenOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "OTHER" | "MERCADOPAGO">("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = Number(order.total);
  const cashReceivedNum = parseFloat(cashReceived || "0");
  const change = method === "CASH" ? cashReceivedNum - total : 0;

  async function confirm() {
    if (method === "CASH" && cashReceivedNum < total) {
      setError("El efectivo recibido no puede ser menor al total");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${order.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: method,
          cashReceived: method === "CASH" ? cashReceivedNum : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cobrar la mesa");

      if (method === "MERCADOPAGO" && data.mpCheckout?.checkoutUrl) {
        window.open(data.mpCheckout.checkoutUrl, "_blank");
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cobrar la mesa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <p className="font-display text-xl font-semibold mb-1">Cobrar mesa</p>
        <p className="text-3xl font-display font-semibold mb-5">${total.toFixed(2)} MXN</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {(["CASH", "CARD", "TRANSFER", "OTHER"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-md border py-3 text-sm font-medium ${method === m ? "bg-ember text-white border-ember" : "border-line"}`}
            >
              {m === "CASH" ? "Efectivo" : m === "CARD" ? "Tarjeta" : m === "TRANSFER" ? "Transferencia" : "Otro"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMethod("MERCADOPAGO")}
            className={`col-span-2 rounded-md border py-3 text-sm font-medium ${method === "MERCADOPAGO" ? "bg-ember text-white border-ember" : "border-line"}`}
          >
            Mercado Pago (link/QR)
          </button>
        </div>

        {method === "CASH" && (
          <div className="mb-4">
            <label className="block text-xs text-muted mb-1">Efectivo recibido</label>
            <input
              type="number"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
            />
            {cashReceivedNum >= total && cashReceivedNum > 0 && (
              <p className="text-xs text-muted mt-1">Cambio: ${change.toFixed(2)}</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-md border border-line px-4 py-3 text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={saving}
            className="flex-1 rounded-md bg-ember text-white px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Cobrando..." : "Confirmar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}
