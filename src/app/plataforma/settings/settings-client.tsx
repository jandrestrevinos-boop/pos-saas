"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

type Settings = { id: string; blockCancellationWithPendingFinancing: boolean; defaultTrialDays: number; graceDays: number };

export function SettingsClient({ initialSettings }: { initialSettings: Settings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    const res = await fetch("/api/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockCancellationWithPendingFinancing: !settings.blockCancellationWithPendingFinancing }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
    }
  }

  const [trialDays, setTrialDays] = useState(String(initialSettings.defaultTrialDays));
  const [graceDays, setGraceDays] = useState(String(initialSettings.graceDays));
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingMsg, setBillingMsg] = useState("");

  async function saveBilling() {
    setSavingBilling(true);
    setBillingMsg("");
    const res = await fetch("/api/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultTrialDays: Number(trialDays), graceDays: Number(graceDays) }),
    });
    setSavingBilling(false);
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      setBillingMsg("Guardado");
    } else {
      const data = await res.json();
      setBillingMsg(data.error ?? "No se pudo guardar");
    }
  }

  return (
    <div className="space-y-6">
    <Card className="p-6 max-w-xl">
      <p className="font-display text-lg font-semibold mb-1">Cobro de la suscripción</p>
      <p className="text-sm text-muted mb-4">
        Duración del demo para las empresas que des de alta a partir de ahora, y cuántos días de gracia tienen después de
        que vence el demo o el periodo pagado antes de que se les bloquee el acceso.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <label className="block text-sm">
          <span className="block font-medium mb-1.5">Días de demo</span>
          <input className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm" type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="block font-medium mb-1.5">Días de gracia</span>
          <input className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm" type="number" min={0} max={60} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={saveBilling} disabled={savingBilling}>
          Guardar
        </Button>
        {billingMsg && <span className="text-sm text-muted">{billingMsg}</span>}
      </div>
    </Card>

    <Card className="p-6 max-w-xl">
      <p className="font-display text-lg font-semibold mb-1">Cancelación de suscripción vs. financiamiento de hardware</p>
      <p className="text-sm text-muted mb-4">
        Define si una empresa puede cancelar TAPI mientras todavía tiene saldo de hardware pendiente. En cualquier
        caso, cancelar TAPI nunca borra ni modifica el saldo, calendario o historial de pagos del financiamiento.
      </p>

      <label className="flex items-start gap-3 mb-5 cursor-pointer">
        <input type="checkbox" className="mt-1" checked={settings.blockCancellationWithPendingFinancing} onChange={toggle} disabled={saving} />
        <span className="text-sm">
          <span className="font-medium text-ink">Bloquear cancelación mientras haya saldo pendiente</span>
          <br />
          <span className="text-muted">
            {settings.blockCancellationWithPendingFinancing
              ? "Activo: una empresa debe terminar de pagar su hardware antes de poder cancelar TAPI."
              : "Desactivado: una empresa puede cancelar TAPI aunque le quede saldo de hardware pendiente (el saldo se conserva igual, solo deja de bloquear)."}
          </span>
        </span>
      </label>
    </Card>
    </div>
  );
}
