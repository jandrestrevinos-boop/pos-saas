"use client";

import { useState } from "react";
import { QrScanner } from "./qr-scanner";

export type LoyaltyCustomer = {
  id: string;
  name: string;
  phone: string | null;
  shortCode: string | null;
  visits: number;
  required: number;
  rewardAvailable: boolean;
  visitedToday: boolean;
  programActive: boolean;
  discountText: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
};

/** Cliente identificado en Caja y si se canjea su descuento en esta venta. */
export type LoyaltySelection = { customer: LoyaltyCustomer; redeem: boolean };

/**
 * Bloque "Cliente frecuente" para Caja (Mostrador y Mesa): escanea la tarjeta (o teclea el
 * código), muestra sus visitas y permite canjear su descuento. La visita se suma sola al cobrar.
 */
export function PosLoyaltyPanel({
  value,
  onChange,
}: {
  value: LoyaltySelection | null;
  onChange: (v: LoyaltySelection | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  async function lookup(raw: string) {
    if (busy || !raw.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/loyalty/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: raw.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "No se encontró la tarjeta");
      return;
    }
    navigator.vibrate?.(60);
    onChange({ customer: data.customer, redeem: false });
    setOpen(false);
    setCode("");
  }

  if (value) {
    const c = value.customer;
    return (
      <div className="rounded-lg border border-line bg-paper px-3 py-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted">
              Cliente frecuente · {c.visits}/{c.required} visitas
            </p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-xs text-muted underline shrink-0">
            Quitar
          </button>
        </div>

        {!c.programActive ? (
          <p className="text-xs text-muted mt-2">El programa está pausado: no se sumará visita.</p>
        ) : (
          <>
            {c.rewardAvailable && (
              <label className="flex items-center gap-2 mt-2 text-sm font-medium text-sage">
                <input
                  type="checkbox"
                  checked={value.redeem}
                  onChange={(e) => onChange({ ...value, redeem: e.target.checked })}
                />
                Canjear {c.discountText}
              </label>
            )}
            <p className="text-[11px] text-muted mt-1">
              {c.visitedToday
                ? "Ya sumó su visita de hoy: esta compra no suma otra."
                : "La visita se suma automáticamente al cobrar."}
            </p>
          </>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-line py-2 text-sm text-muted hover:text-ink"
      >
        + Cliente frecuente
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Cliente frecuente</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted underline">
          Cerrar
        </button>
      </div>
      <QrScanner onCode={lookup} paused={busy} />
      <div className="flex gap-2 mt-3">
        <input
          className="flex-1 rounded-md border border-line px-2 py-2 text-sm font-mono uppercase tracking-widest"
          placeholder="Código"
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          type="button"
          onClick={() => lookup(code)}
          disabled={busy || !code.trim()}
          className="rounded-md bg-ember text-white px-3 text-sm font-medium disabled:opacity-40"
        >
          Buscar
        </button>
      </div>
      {error && <p className="text-xs text-ember-dark mt-2">{error}</p>}
    </div>
  );
}
