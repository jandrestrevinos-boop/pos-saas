"use client";

import { useEffect, useState } from "react";
import { formatMxn } from "@/lib/format";

/**
 * Piezas compartidas de la pantalla de cobro (POS y Mesas): selector de método de pago
 * con sub-opciones de Tarjeta, y selector de propina.
 */

export type CheckoutMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER" | "MERCADOPAGO" | "MERCADOPAGO_TERMINAL";

export const round2 = (n: number) => Math.round(n * 100) / 100;

const btn = (active: boolean, extra = "") =>
  `rounded-md border py-3 text-sm font-medium ${extra} ${active ? "bg-ember text-white border-ember" : "border-line"}`;

const subBtn = (active: boolean) =>
  `rounded-md border py-2 text-sm font-medium ${active ? "bg-ember text-white border-ember" : "border-line"}`;

export function PaymentMethodPicker({
  method,
  onChange,
  mercadoPagoEnabled,
  terminalLinked,
}: {
  method: CheckoutMethod;
  onChange: (method: CheckoutMethod) => void;
  mercadoPagoEnabled: boolean;
  terminalLinked: boolean;
}) {
  const cardGroup = method === "CARD" || method === "MERCADOPAGO_TERMINAL";

  return (
    <div className="grid grid-cols-2 gap-2 mb-5">
      <button type="button" onClick={() => onChange("CASH")} className={btn(method === "CASH")}>
        Efectivo
      </button>

      <button
        type="button"
        onClick={() => {
          // Si ya estaba dentro de Tarjeta no se cambia la sub-opción; si no, entra con la terminal de Mercado Pago (si hay una vinculada) o con terminal libre.
          if (!cardGroup) onChange(terminalLinked ? "MERCADOPAGO_TERMINAL" : "CARD");
        }}
        className={btn(cardGroup)}
      >
        Tarjeta
      </button>

      {cardGroup && terminalLinked && (
        <div className="col-span-2 rounded-md border border-line p-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onChange("MERCADOPAGO_TERMINAL")}
            className={subBtn(method === "MERCADOPAGO_TERMINAL")}
          >
            Terminal Mercado Pago
          </button>
          <button type="button" onClick={() => onChange("CARD")} className={subBtn(method === "CARD")}>
            Otra terminal
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange("TRANSFER")}
        className={btn(method === "TRANSFER", mercadoPagoEnabled ? "" : "col-span-2")}
      >
        Transferencia
      </button>

      {mercadoPagoEnabled && (
        <button
          type="button"
          onClick={() => onChange("MERCADOPAGO")}
          className={btn(method === "MERCADOPAGO", "px-2 leading-tight")}
        >
          Mercado Pago (link/QR)
        </button>
      )}
    </div>
  );
}

/** Tarjeta (terminal libre) y transferencia: Tappy no puede verificar el cobro por su cuenta, así que el cajero captura una referencia que se pueda comprobar después. */
export function needsReference(method: CheckoutMethod) {
  return method === "CARD" || method === "TRANSFER";
}

export const MIN_REFERENCE_LENGTH = 4;

export function ReferenceInput({
  method,
  value,
  onChange,
}: {
  method: CheckoutMethod;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!needsReference(method)) return null;
  const isCard = method === "CARD";

  return (
    <div className="mb-5">
      <label className="block text-xs text-muted mb-1">
        {isCard ? "Número de autorización (voucher de la terminal)" : "Clave de rastreo o folio de la transferencia"} *
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        autoComplete="off"
        placeholder={isCard ? "Ej. 123456" : "Ej. clave de rastreo del SPEI"}
        className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono"
      />
      <p className="text-xs text-muted mt-1">
        {isCard
          ? "Confirma en la terminal que el cobro fue aprobado y captura el número que sale en el voucher."
          : "Confirma en tu banco que el dinero ya llegó antes de capturar la clave."}
      </p>
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
