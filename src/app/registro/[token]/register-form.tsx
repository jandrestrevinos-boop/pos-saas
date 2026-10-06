"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Field, inputClass } from "@/components/ui/modal";

export function RegisterForm({ signupToken, restaurantName }: { signupToken: string; restaurantName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/loyalty/public/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupToken, name, phone, acceptedPrivacy: accepted }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo completar el registro");
      return;
    }
    router.push(`/tarjeta/${data.cardToken}`);
  }

  return (
    <form onSubmit={submit}>
      <Field label="Tu nombre">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </Field>
      <Field label="Tu celular (10 dígitos)">
        <input
          className={inputClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="81 1234 5678"
          required
        />
      </Field>

      <label className="flex items-start gap-2 text-xs text-muted mb-5">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
        <span>
          Acepto que {restaurantName} use mi nombre y celular únicamente para administrar mi tarjeta de clientes
          frecuentes y mis descuentos. Puedo pedir que borren mis datos en el mostrador.
        </span>
      </label>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}
      <Button type="submit" className="w-full" disabled={saving || !accepted}>
        {saving ? "Creando tarjeta..." : "Crear mi tarjeta"}
      </Button>
    </form>
  );
}
