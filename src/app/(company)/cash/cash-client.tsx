"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { formatMxn } from "@/lib/format";
import { CutReportView, PrintButton } from "@/components/cash/cut-report";
import type { CutReport } from "@/modules/cash/report";

type Movement = { id: string; type: string; amount: string; reason: string | null; createdAt: string; user: { name: string } };
type OpenStatus = {
  open: true;
  register: { id: string; openedAt: string; openingCash: string; movements: Movement[] };
  salesTotals: { cash: number; card: number; transfer: number; other: number; cashTips?: number };
  expectedCash: number;
};
type ClosedStatus = { open: false; requireOpenCashDay?: boolean };
type Status = OpenStatus | ClosedStatus | null;

const MOVEMENT_LABELS: Record<string, string> = { CASH_IN: "Entrada", CASH_OUT: "Retiro", REFUND: "Devolución" };

export function CashClient({ userName, canReportX, canReportZ }: { userName: string; canReportX: boolean; canReportZ: boolean }) {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const res = await fetch("/api/cash/status");
    if (res.ok) setStatus(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  return (
    <div>
      <WhatsAppPendingOrders />

      {!status?.open ? (
        <OpenRegisterForm onOpened={refresh} requireOpenCashDay={status?.requireOpenCashDay ?? false} />
      ) : (
        <OpenRegisterView
          status={status}
          userName={userName}
          canReportX={canReportX}
          canReportZ={canReportZ}
          onChange={refresh}
        />
      )}
    </div>
  );
}

// ---------- Pedidos de WhatsApp pendientes de pago ----------

type PendingOrderItem = {
  id: string;
  quantity: number;
  product: { name: string };
  menuChoices?: { id: string; name: string; isExtra?: boolean; extraPriceAtSale?: string | number }[];
};

// Menús completos: "Comida (Arroz, Puré de papa - extra)" para que quien cobra vea qué lleva y qué cobra aparte.
function itemLabel(i: PendingOrderItem): string {
  const choices = (i.menuChoices ?? []).map((c) => (c.isExtra || Number(c.extraPriceAtSale ?? 0) > 0 ? `${c.name} - extra` : c.name));
  return choices.length > 0 ? `${i.product.name} (${choices.join(", ")})` : i.product.name;
}
type PendingOrder = {
  id: string;
  orderNumber: number;
  total: string;
  createdAt: string;
  items: PendingOrderItem[];
  whatsAppCart: { session: { phoneNumber: string } } | null;
};

function WhatsAppPendingOrders() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [paying, setPaying] = useState<PendingOrder | null>(null);
  const [flash, setFlash] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  async function poll() {
    try {
      const res = await fetch("/api/whatsapp/pending-orders");
      if (!res.ok) return;
      const data = await res.json();
      const list: PendingOrder[] = data.orders ?? [];

      const newOnes = list.filter((o) => !knownIds.current.has(o.id));
      if (!firstLoad.current && newOnes.length > 0) {
        setFlash(true);
        setTimeout(() => setFlash(false), 2500);
      }
      firstLoad.current = false;
      knownIds.current = new Set(list.map((o) => o.id));

      setOrders(list);
    } catch {
      // silencioso — se reintenta en el siguiente ciclo, no vale la pena
      // interrumpir al cajero por un fallo de red pasajero
    }
  }

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 6000);
    return () => clearInterval(interval);
  }, []);

  if (orders.length === 0) return null;

  return (
    <Card
      className={`p-5 mb-6 border-2 transition-colors duration-500 ${
        flash ? "border-ember bg-ember/10 animate-pulse" : "border-ember/40"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg font-semibold">📱 Pedidos de WhatsApp por cobrar</p>
        <span className="text-xs font-medium bg-ember/15 text-ember-dark px-2 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between bg-ink-100 rounded-md px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                <span className="font-mono text-ember-dark">#{o.orderNumber}</span> ·{" "}
                {o.items.map((i) => `${i.quantity}× ${itemLabel(i)}`).join(", ")}
              </p>
              <p className="text-xs text-muted">
                {o.whatsAppCart?.session.phoneNumber ?? "Cliente"} · hace{" "}
                {Math.max(1, Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000))} min
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-semibold">{formatMxn(o.total)}</span>
              <Button onClick={() => setPaying(o)}>Cobrar</Button>
            </div>
          </div>
        ))}
      </div>

      {paying && (
        <PayOrderModal
          order={paying}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            poll();
          }}
        />
      )}
    </Card>
  );
}

function PayOrderModal({ order, onClose, onPaid }: { order: PendingOrder; onClose: () => void; onPaid: () => void }) {
  const [method, setMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "OTHER">("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const total = Number(order.total);
  const received = parseFloat(cashReceived) || 0;
  const change = method === "CASH" ? received - total : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch(`/api/whatsapp/pending-orders/${order.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: method,
        cashReceived: method === "CASH" ? received : undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo cobrar el pedido");
      return;
    }
    onPaid();
  }

  return (
    <Modal open onClose={onClose} title="Cobrar pedido de WhatsApp">
      <div className="mb-4 bg-ink-100 rounded-md p-4">
        {order.items.map((i) => (
          <p key={i.id} className="text-sm">
            {i.quantity}× {itemLabel(i)}
          </p>
        ))}
        <p className="font-mono text-xl font-semibold mt-2">{formatMxn(order.total)}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Field label="Método de pago">
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="CASH">Efectivo</option>
            <option value="CARD">Tarjeta</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="OTHER">Otro</option>
          </select>
        </Field>

        {method === "CASH" && (
          <Field label="Efectivo recibido (MXN)">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              autoFocus
              className={inputClass}
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder={total.toFixed(2)}
            />
          </Field>
        )}

        {method === "CASH" && cashReceived && (
          <p className={`text-sm mb-4 ${change >= 0 ? "text-sage" : "text-ember-dark"}`}>
            {change >= 0 ? `Cambio: ${formatMxn(change)}` : "El efectivo recibido no alcanza"}
          </p>
        )}

        {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Cobrando..." : "Confirmar cobro"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Apertura / turno de caja (sin cambios de lógica) ----------

function OpenRegisterForm({ onOpened, requireOpenCashDay }: { onOpened: () => void; requireOpenCashDay: boolean }) {
  const [openingCash, setOpeningCash] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/cash/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingCash: parseFloat(openingCash) || 0 }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo abrir la caja");
      return;
    }
    onOpened();
  }

  return (
    <Card className="max-w-sm p-6">
      <p className="font-display text-xl font-semibold mb-1">La caja está cerrada</p>
      <p className="text-sm text-muted mb-5">
        {requireOpenCashDay
          ? "Registra el fondo inicial en efectivo para abrir el día. No se puede vender hasta que la caja esté abierta."
          : "Registra el fondo inicial en efectivo para abrir el día. Si vendes sin abrirla, el día se abre solo con la primera venta (fondo $0)."}
      </p>
      <form onSubmit={handleOpen}>
        <Field label="Monto inicial (MXN)">
          <input
            required
            type="number"
            min="0"
            step="0.01"
            autoFocus
            className={inputClass}
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Abriendo..." : "Abrir caja"}
        </Button>
      </form>
    </Card>
  );
}

function OpenRegisterView({
  status,
  userName,
  canReportX,
  canReportZ,
  onChange,
}: {
  status: OpenStatus;
  userName: string;
  canReportX: boolean;
  canReportZ: boolean;
  onChange: () => void;
}) {
  const [movementOpen, setMovementOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [xOpen, setXOpen] = useState(false);

  const totalSales = status.salesTotals.cash + status.salesTotals.card + status.salesTotals.transfer + status.salesTotals.other;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted">
          Día abierto desde{" "}
          <span className="font-medium text-ink">
            {new Date(status.register.openedAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
          </span>{" "}
          por {userName}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setMovementOpen(true)}>
            + Entrada / Retiro
          </Button>
          {(canReportX || canReportZ) && (
            <Button variant="secondary" onClick={() => setXOpen(true)}>
              Corte X
            </Button>
          )}
          {canReportZ && <Button onClick={() => setCloseOpen(true)}>Corte Z · Cerrar día</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Ventas efectivo</p>
          <p className="font-display text-2xl font-semibold mt-1.5">{formatMxn(status.salesTotals.cash)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Ventas tarjeta</p>
          <p className="font-display text-2xl font-semibold mt-1.5">{formatMxn(status.salesTotals.card)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Ventas transferencia + otro</p>
          <p className="font-display text-2xl font-semibold mt-1.5">
            {formatMxn(status.salesTotals.transfer + status.salesTotals.other)}
          </p>
        </Card>
        <Card className="p-5 ticket-edge">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total vendido</p>
          <p className="font-display text-2xl font-semibold mt-1.5">{formatMxn(totalSales)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 max-w-md">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Fondo inicial</p>
          <p className="font-mono text-xl mt-1.5">{formatMxn(status.register.openingCash)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Efectivo esperado en caja</p>
          <p className="font-mono text-xl mt-1.5">{formatMxn(status.expectedCash)}</p>
          {(status.salesTotals.cashTips ?? 0) > 0 && (
            <p className="text-xs text-muted mt-1">
              Incluye {formatMxn(status.salesTotals.cashTips ?? 0)} de propinas en efectivo
            </p>
          )}
        </Card>
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Movimientos manuales</p>
      <Card className="overflow-hidden">
        {status.register.movements.length === 0 ? (
          <p className="text-sm text-muted p-5">Sin movimientos manuales todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Monto</th>
                <th className="px-5 py-3 font-medium">Motivo</th>
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Hora</th>
              </tr>
            </thead>
            <tbody>
              {status.register.movements.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">{MOVEMENT_LABELS[m.type] ?? m.type}</td>
                  <td className="px-5 py-3 font-mono">{formatMxn(m.amount)}</td>
                  <td className="px-5 py-3 text-muted">{m.reason ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{m.user.name}</td>
                  <td className="px-5 py-3 text-muted text-xs">
                    {new Date(m.createdAt).toLocaleTimeString("es-MX", { timeStyle: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {movementOpen && <MovementModal onClose={() => setMovementOpen(false)} onDone={() => { setMovementOpen(false); onChange(); }} />}
      {xOpen && <XReportModal onClose={() => setXOpen(false)} />}
      {closeOpen && (
        <CloseModal expectedCash={status.expectedCash} onClose={() => setCloseOpen(false)} onDone={() => { setCloseOpen(false); onChange(); }} />
      )}
    </div>
  );
}

function MovementModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<"CASH_IN" | "CASH_OUT" | "REFUND">("CASH_IN");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/cash/movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, amount: parseFloat(amount) || 0, reason }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo registrar");
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Registrar movimiento">
      <form onSubmit={handleSubmit}>
        <Field label="Tipo">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="CASH_IN">Entrada de efectivo</option>
            <option value="CASH_OUT">Retiro de efectivo</option>
            <option value="REFUND">Devolución</option>
          </select>
        </Field>
        <Field label="Monto (MXN)">
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            autoFocus
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Motivo (opcional)">
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compra de hielo, cambio, etc." />
        </Field>
        {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Corte X (parcial, no cierra nada) ----------

function XReportModal({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<CutReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/cash/report-x");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo generar el corte X");
      return;
    }
    setReport(data.report);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Modal open onClose={onClose} title="Corte X">
      {loading && <p className="text-sm text-muted">Generando corte...</p>}
      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}
      {report && <CutReportView report={report} />}
      <div className="no-print flex justify-end gap-2 mt-5">
        <Button type="button" variant="secondary" onClick={load} disabled={loading}>
          Actualizar
        </Button>
        {report && <PrintButton />}
        <Button type="button" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}

// ---------- Corte Z (cierra el día de la sucursal) ----------

function CloseModal({ expectedCash, onClose, onDone }: { expectedCash: number; onClose: () => void; onDone: () => void }) {
  const [countedCash, setCountedCash] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<CutReport | null>(null);

  const countedNum = parseFloat(countedCash) || 0;
  const difference = countedNum - expectedCash;

  async function handleClose() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/cash/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countedCash: countedNum }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo hacer el corte Z");
      return;
    }
    setReport(data.report);
  }

  if (report) {
    return (
      <Modal open onClose={onDone} title="Corte Z hecho">
        <CutReportView report={report} />
        <div className="no-print flex justify-end gap-2 mt-5">
          <PrintButton />
          <Button onClick={onDone}>Listo</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Corte Z · Cerrar día">
      <p className="text-sm text-muted mb-4">
        Al confirmar se cierra el día de esta sucursal y se guarda el corte con un folio consecutivo. Ya no se puede
        modificar.
      </p>
      <p className="text-sm text-muted mb-1">Efectivo esperado en caja</p>
      <p className="font-mono text-2xl mb-5">{formatMxn(expectedCash)}</p>

      <Field label="Efectivo contado">
        <input
          required
          type="number"
          min="0"
          step="0.01"
          autoFocus
          className={inputClass}
          value={countedCash}
          onChange={(e) => setCountedCash(e.target.value)}
          placeholder="0.00"
        />
      </Field>

      {countedCash && (
        <p className={`text-sm mb-4 ${Math.abs(difference) < 0.01 ? "text-sage" : "text-ember-dark"}`}>
          {Math.abs(difference) < 0.01
            ? "Cuadra exacto."
            : difference > 0
              ? `Sobrante de ${formatMxn(difference)}`
              : `Faltante de ${formatMxn(Math.abs(difference))}`}
        </p>
      )}

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleClose} disabled={saving || !countedCash}>
          {saving ? "Cerrando..." : "Confirmar corte Z"}
        </Button>
      </div>
    </Modal>
  );
}
