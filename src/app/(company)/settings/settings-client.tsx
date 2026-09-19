"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function SettingsClient({
  pagosIntegradosEnabled,
  mercadoPagoConnected,
  mercadoPagoLiveMode,
}: {
  pagosIntegradosEnabled: boolean;
  mercadoPagoConnected: boolean;
  mercadoPagoLiveMode: boolean | null;
}) {
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(mercadoPagoConnected);
  const [liveMode, setLiveMode] = useState(mercadoPagoLiveMode);
  const [disconnecting, setDisconnecting] = useState(false);
  const mpResult = searchParams.get("mp");

  useEffect(() => {
    if (mpResult === "conectado") {
      fetch("/api/mercadopago/account")
        .then((res) => res.json())
        .then((data) => {
          setConnected(data.connected);
          setLiveMode(data.liveMode);
        });
    }
  }, [mpResult]);

  async function disconnect() {
    if (!confirm("¿Desconectar tu cuenta de Mercado Pago? Los cobros integrados dejarán de funcionar hasta que la vuelvas a conectar.")) return;
    setDisconnecting(true);
    const res = await fetch("/api/mercadopago/account", { method: "DELETE" });
    setDisconnecting(false);
    if (res.ok) setConnected(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold mb-1">Configuración</h1>
      <p className="text-muted text-sm mb-8">Integraciones y ajustes de tu cuenta.</p>

      <div className="bg-white border border-line rounded-lg p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg font-semibold">Mercado Pago</h2>
          {connected && (
            <span className="text-xs bg-sage/15 text-sage px-2 py-0.5 rounded-full font-medium">
              Conectado{liveMode === false ? " (modo prueba)" : ""}
            </span>
          )}
        </div>
        <p className="text-muted text-sm mb-4">
          Conecta tu propia cuenta de Mercado Pago para cobrar con tarjeta directo desde el Punto de Venta. El
          dinero de tus ventas entra directo a tu cuenta — Tappy no cobra comisión adicional.
        </p>

        {mpResult === "error" && (
          <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">
            No se pudo completar la conexión con Mercado Pago. Intenta de nuevo.
          </p>
        )}

        {!pagosIntegradosEnabled ? (
          <p className="text-sm text-muted bg-ink-100 rounded-md px-3 py-2">
            Pagos integrados no está incluido en tu plan actual. Contacta a soporte para agregarlo.
          </p>
        ) : connected ? (
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Desconectar cuenta
          </button>
        ) : (
          <a
            href="/api/mercadopago/oauth/authorize"
            className="inline-block rounded-md bg-ember text-white px-4 py-2 text-sm font-medium"
          >
            Conectar con Mercado Pago
          </a>
        )}
      </div>
    </div>
  );
}
