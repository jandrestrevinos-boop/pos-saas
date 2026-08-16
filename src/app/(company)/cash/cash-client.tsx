"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { formatMxn } from "@/lib/format";

type Movement = { id: string; type: string; amount: string; reason: string | null; createdAt: string; user: { name: string } };
type OpenStatus = {
  open: true;
  register: { id: string; openedAt: string; openingCash: string; movements: Movement[] };
  salesTotals: { cash: number; card: number; transfer: number; other: number };
  expectedCash: number;
};
type ClosedStatus = { open: false };
type Status = OpenStatus | ClosedStatus | null;

const MOVEMENT_LABELS: Record<string, string> = { CASH_IN: "Entrada", CASH_OUT: "Retiro", REFUND: "Devolución" };

export function CashClient({ userName }: { userName: string }) {
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

  if (!status?.open) {
    return <OpenRegisterForm onOpened={refresh} />;
  }

  return <OpenRegisterView status={status} userName={userName} onChange={refresh} />;
}

function OpenRegisterForm({ onOpened }: { onOpened: () => void }) {
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
      <p className="text-sm text-muted mb-5">Registra el monto inicial en efectivo para abrir el turno.</p>
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

function OpenRegisterView({ status, userName, onChange }: { status: OpenStatus; userName: string; onChange: () => void }) {
  const [movementOpen, setMovementOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const totalSales = status.salesTotals.cash + status.salesTotals.card + status.salesTotals.transfer + status.salesTotals.other;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted">
          Turno abierto desde{" "}
          <span className="font-medium text-ink">
            {new Date(status.register.openedAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
          </span>{" "}
          por {userName}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setMovementOpen(true)}>
            + Entrada / Retiro
          </Button>
          <Button onClick={() => setCloseOpen(true)}>Cerrar caja</Button>
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

function CloseModal({ expectedCash, onClose, onDone }: { expectedCash: number; onClose: () => void; onDone: () => void }) {
  const [countedCash, setCountedCash] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ difference: number } | null>(null);

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
      setError(data.error ?? "No se pudo cerrar la caja");
      return;
    }
    setResult({ difference: Number(data.register.difference) });
  }

  if (result) {
    const isExact = Math.abs(result.difference) < 0.01;
    return (
      <Modal open onClose={onDone} title="Caja cerrada">
        <div className="text-center py-2">
          <p className={`font-display text-3xl font-semibold mb-2 ${isExact ? "text-sage" : "text-ember-dark"}`}>
            {isExact ? "Cuadró exacto" : formatMxn(Math.abs(result.difference))}
          </p>
          <p className="text-sm text-muted mb-6">
            {isExact ? "El efectivo contado coincide con lo esperado." : result.difference > 0 ? "Sobrante en caja." : "Faltante en caja."}
          </p>
          <Button onClick={onDone} className="w-full">
            Listo
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Cerrar caja">
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
          {saving ? "Cerrando..." : "Confirmar cierre"}
        </Button>
      </div>
    </Modal>
  );
}
