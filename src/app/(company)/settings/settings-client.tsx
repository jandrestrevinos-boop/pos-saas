"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function SettingsClient({
  pagosIntegradosEnabled,
  mercadoPagoConnected,
  mercadoPagoLiveMode,
  whatsappEnabled,
  whatsappConnected,
  whatsappPhoneNumberId,
  whatsappWelcomeMessage,
}: {
  pagosIntegradosEnabled: boolean;
  mercadoPagoConnected: boolean;
  mercadoPagoLiveMode: boolean | null;
  whatsappEnabled: boolean;
  whatsappConnected: boolean;
  whatsappPhoneNumberId: string;
  whatsappWelcomeMessage: string;
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

      {connected && <TerminalsSection />}

      <WhatsAppSection
        enabled={whatsappEnabled}
        initialConnected={whatsappConnected}
        initialPhoneNumberId={whatsappPhoneNumberId}
        initialWelcomeMessage={whatsappWelcomeMessage}
      />
    </div>
  );
}

function TerminalsSection() {
  const [terminals, setTerminals] = useState<
    { id: string; pos_id?: number; store_id?: string; operating_mode: string }[]
  >([]);
  const [linked, setLinked] = useState<{ id: string; terminalId: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});

  async function loadTerminals() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mercadopago/terminals");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las terminales");
      setTerminals(data.terminals ?? []);
      setLinked(data.linked ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las terminales");
    } finally {
      setLoading(false);
    }
  }

  async function linkTerminal(t: { id: string; pos_id?: number; store_id?: string }) {
    const label = labels[t.id]?.trim();
    if (!label) return;
    setError("");
    try {
      const res = await fetch("/api/mercadopago/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminalId: t.id, label, posId: t.pos_id, storeId: t.store_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo vincular la terminal");
      await loadTerminals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular la terminal");
    }
  }

  async function unlink(id: string) {
    await fetch(`/api/mercadopago/terminals/${id}`, { method: "DELETE" });
    await loadTerminals();
  }

  return (
    <div className="bg-white border border-line rounded-lg p-5 mt-4">
      <h2 className="font-display text-lg font-semibold mb-1">Terminales físicas (Point)</h2>
      <p className="text-muted text-sm mb-4">
        Vincula cada terminal Point a la sucursal donde está — así el POS sabe a cuál mandar el cobro.
      </p>

      {linked.length > 0 && (
        <div className="mb-4 space-y-2">
          {linked.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm bg-sage/10 rounded-md px-3 py-2">
              <span>
                <strong>{l.label}</strong> — {l.terminalId}
              </span>
              <button onClick={() => unlink(l.id)} className="text-xs underline text-muted">
                Desvincular
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={loadTerminals} disabled={loading} className="text-sm underline text-ember-dark mb-4">
        {loading ? "Buscando..." : "Buscar terminales disponibles"}
      </button>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-3">{error}</p>}

      {terminals
        .filter((t) => !linked.some((l) => l.terminalId === t.id))
        .map((t) => (
          <div key={t.id} className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted flex-1 truncate">{t.id}</span>
            <input
              className="w-32 rounded-md border border-line px-2 py-1 text-sm"
              placeholder="Ej. Caja 1"
              value={labels[t.id] ?? ""}
              onChange={(e) => setLabels((prev) => ({ ...prev, [t.id]: e.target.value }))}
            />
            <button
              onClick={() => linkTerminal(t)}
              disabled={!labels[t.id]?.trim()}
              className="rounded-md bg-ember text-white px-3 py-1 text-xs font-medium disabled:opacity-50"
            >
              Vincular a esta sucursal
            </button>
          </div>
        ))}
    </div>
  );
}

function WhatsAppSection({
  enabled,
  initialConnected,
  initialPhoneNumberId,
  initialWelcomeMessage,
}: {
  enabled: boolean;
  initialConnected: boolean;
  initialPhoneNumberId: string;
  initialWelcomeMessage: string;
}) {
  const [connected, setConnected] = useState(initialConnected);
  const [editing, setEditing] = useState(!initialConnected);
  const [phoneNumberId, setPhoneNumberId] = useState(initialPhoneNumberId);
  const [accessToken, setAccessToken] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState(initialWelcomeMessage);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!phoneNumberId.trim() || (!connected && !accessToken.trim())) {
      setError("Phone Number ID y token son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, accessToken: accessToken || undefined, welcomeMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la configuración");
      setConnected(true);
      setEditing(false);
      setAccessToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("¿Desconectar WhatsApp? Tu restaurante dejará de recibir y responder mensajes hasta que lo vuelvas a conectar.")) return;
    setDisconnecting(true);
    const res = await fetch("/api/whatsapp/config", { method: "DELETE" });
    setDisconnecting(false);
    if (res.ok) {
      setConnected(false);
      setEditing(true);
    }
  }

  return (
    <div className="bg-white border border-line rounded-lg p-5 mt-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg font-semibold">WhatsApp Business</h2>
        {connected && (
          <span className="text-xs bg-sage/15 text-sage px-2 py-0.5 rounded-full font-medium">
            Conectado
          </span>
        )}
      </div>
      <p className="text-muted text-sm mb-4">
        Conecta tu número de WhatsApp Business para recibir y responder pedidos directo por WhatsApp. El Phone
        Number ID y el token de acceso los sacas de tu propia app en Meta for Developers.
      </p>

      {!enabled ? (
        <p className="text-sm text-muted bg-ink-100 rounded-md px-3 py-2">
          WhatsApp Business no está incluido en tu plan actual. Contacta a soporte para agregarlo.
        </p>
      ) : editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Phone Number ID</label>
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              placeholder="Ej. 1371323052721018"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Token de acceso</label>
            <input
              type="password"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              placeholder={connected ? "•••••••••••• (déjalo vacío para no cambiarlo)" : "Pega tu token de Meta"}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Mensaje de bienvenida</label>
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-ember text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {connected && (
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium"
          >
            Editar configuración
          </button>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Desconectar
          </button>
        </div>
      )}
    </div>
  );
}
