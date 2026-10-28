"use client";

import { useEffect, useState } from "react";
import { formatMxn } from "@/lib/format";

/**
 * Piezas compartidas de la pantalla de cobro (POS y Mesas): selector de método de pago
 * con sub-opciones de Tarjeta, y selector de propina.
 */

export type CheckoutMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER" | "MERCADOPAGO" | "MERCADOPAGO_TERMINAL";
// Solo cuando method = CARD: con qué terminal se cobró. null = otra terminal (banco, Clip, etc.).
export type CardProvider = "ZETTLE" | null;

export const round2 = (n: number) => Math.round(n * 100) / 100;

const btn = (active: boolean, extra = "") =>
  `rounded-md border py-3 text-sm font-medium ${extra} ${active ? "bg-ember text-white border-ember" : "border-line"}`;

const subBtn = (active: boolean) =>
  `rounded-md border py-2 text-sm font-medium ${active ? "bg-ember text-white border-ember" : "border-line"}`;

export function PaymentMethodPicker({
  method,
  cardProvider,
  onChange,
  mercadoPagoEnabled,
  terminalLinked,
}: {
  method: CheckoutMethod;
  cardProvider: CardProvider;
  onChange: (method: CheckoutMethod, cardProvider: CardProvider) => void;
  mercadoPagoEnabled: boolean;
  terminalLinked: boolean;
}) {
  const cardGroup = method === "CARD" || method === "MERCADOPAGO_TERMINAL";

  return (
    <div className="grid grid-cols-2 gap-2 mb-5">
      <button type="button" onClick={() => onChange("CASH", null)} className={btn(method === "CASH")}>
        Efectivo
      </button>

      <button
        type="button"
        onClick={() => {
          // Si ya estaba dentro de Tarjeta no se cambia la sub-opción; si no, entra con la terminal de Mercado Pago (si hay) o con "Otra terminal".
          if (!cardGroup) onChange(terminalLinked ? "MERCADOPAGO_TERMINAL" : "CARD", null);
        }}
        className={btn(cardGroup)}
      >
        Tarjeta
      </button>

      {cardGroup && (
        <div className="col-span-2 rounded-md border border-line p-2 flex flex-col gap-2">
          {terminalLinked && (
            <button
              type="button"
              onClick={() => onChange("MERCADOPAGO_TERMINAL", null)}
              className={subBtn(method === "MERCADOPAGO_TERMINAL")}
            >
              Terminal Mercado Pago
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange("CARD", "ZETTLE")}
            className={subBtn(method === "CARD" && cardProvider === "ZETTLE")}
          >
            Terminal Zettle (PayPal)
          </button>
          <button
            type="button"
            onClick={() => onChange("CARD", null)}
            className={subBtn(method === "CARD" && cardProvider === null)}
          >
            Otra terminal
          </button>
          {method === "CARD" && cardProvider === "ZETTLE" && (
            <p className="text-xs text-muted">
              Cobra el monto en tu terminal Zettle y después presiona Confirmar para registrar la venta.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange("TRANSFER", null)}
        className={btn(method === "TRANSFER", mercadoPagoEnabled ? "" : "col-span-2")}
      >
        Transferencia
      </button>

      {mercadoPagoEnabled && (
        <button
          type="button"
          onClick={() => onChange("MERCADOPAGO", null)}
          className={btn(method === "MERCADOPAGO", "px-2 leading-tight")}
        >
          Mercado Pago (link/QR)
        </button>
      )}
    </div>
  );
}

type TipMode = "none" | 10 | 15 | 20 | "custom";

function computeTip(mode: TipMode, custom: string, base: number): number {
  if (mode === "none") return 0;
  if (mode === "custom") {
    const n = parseFloat(custom);
    return Number.isFinite(n) && n > 0 ? round2(n) : 0;
  }
  return round2((Math.max(base, 0) * mode) / 100);
}

/**
 * Propina opcional: Sin propina / 10% / 15% / 20% (sobre `base`, el total ya con descuentos) o un monto libre.
 * Avisa el monto en pesos con onChange (pásale el setter de un useState, que es estable).
 */
export function TipPicker({ base, onChange }: { base: number; onChange: (tip: number) => void }) {
  const [mode, setMode] = useState<TipMode>("none");
  const [custom, setCustom] = useState("");

  const tip = computeTip(mode, custom, base);

  useEffect(() => {
    onChange(tip);
  }, [tip, onChange]);

  return (
    <div className="mb-5">
      <label className="block text-xs text-muted mb-1">Propina (opcional)</label>
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("none");
            setCustom("");
          }}
          className={`rounded-md border py-2 text-xs font-medium ${mode === "none" ? "bg-ember text-white border-ember" : "border-line"}`}
        >
          Sin propina
        </button>
        {([10, 15, 20] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setMode(p);
              setCustom("");
            }}
            className={`rounded-md border py-2 text-sm font-medium ${mode === p ? "bg-ember text-white border-ember" : "border-line"}`}
          >
            {p}%
          </button>
        ))}
      </div>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={custom}
        onChange={(e) => {
          setCustom(e.target.value);
          setMode("custom");
        }}
        placeholder="Otro monto (MXN)"
        className={`mt-2 w-full rounded-md border px-3 py-2 text-sm font-mono ${mode === "custom" && tip > 0 ? "border-ember" : "border-line"}`}
      />
      {tip > 0 && (
        <p className="text-xs text-muted mt-1">
          Propina: <span className="font-mono font-medium text-ink">{formatMxn(tip)}</span>
        </p>
      )}
    </div>
  );
}
