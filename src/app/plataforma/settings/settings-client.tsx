"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

type Settings = { id: string; blockCancellationWithPendingFinancing: boolean };

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

  return (
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
  );
}
