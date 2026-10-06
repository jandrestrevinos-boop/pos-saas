"use client";

import { useState } from "react";
import { Button, Card, StatCard } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { QrImage, downloadQrPng } from "@/components/loyalty/qr-image";

type Program = {
  isActive: boolean;
  visitsRequired: number;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  oneVisitPerDay: boolean;
  signupToken: string;
  displayName: string | null;
};
type Stats = { customers: number; visits30d: number; redemptions30d: number; pendingRewards: number };
type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  cardToken: string | null;
  shortCode: string | null;
  visitsInCycle: number;
  lastVisitAt: string | null;
};

export function LoyaltyAdminClient({
  initialProgram,
  initialStats,
  initialCustomers,
}: {
  initialProgram: Program;
  initialStats: Stats;
  initialCustomers: CustomerRow[];
}) {
  const [program, setProgram] = useState(initialProgram);
  const [stats] = useState(initialStats);
  const [customers, setCustomers] = useState(initialCustomers);

  // formulario de configuración
  const [isActive, setIsActive] = useState(program.isActive);
  const [visitsRequired, setVisitsRequired] = useState(String(program.visitsRequired));
  const [discountType, setDiscountType] = useState(program.discountType);
  const [discountValue, setDiscountValue] = useState(String(program.discountValue));
  const [oneVisitPerDay, setOneVisitPerDay] = useState(program.oneVisitPerDay);
  const [displayName, setDisplayName] = useState(program.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [search, setSearch] = useState("");
  const [cardModal, setCardModal] = useState<CustomerRow | null>(null);
  const [copied, setCopied] = useState(false);

  const signupPath = `/registro/${program.signupToken}`;

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/loyalty/program", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isActive,
        visitsRequired: Number(visitsRequired),
        discountType,
        discountValue: Number(discountValue),
        oneVisitPerDay,
        displayName: displayName.trim() || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage({ ok: false, text: data.error ?? "No se pudo guardar" });
      return;
    }
    setProgram(data.program);
    setMessage({ ok: true, text: "Cambios guardados" });
  }

  async function rotateSignup() {
    if (
      !window.confirm(
        "Se generará un QR de registro nuevo y el que tienes impreso dejará de funcionar. Las tarjetas de tus clientes NO cambian. ¿Continuar?"
      )
    )
      return;
    const res = await fetch("/api/loyalty/program/rotate-token", { method: "POST" });
    const data = await res.json();
    if (res.ok) setProgram(data.program);
    else setMessage({ ok: false, text: data.error ?? "No se pudo generar el QR" });
  }

  async function runSearch(q: string) {
    setSearch(q);
    const res = await fetch(`/api/loyalty/customers?q=${encodeURIComponent(q)}`);
    if (res.ok) setCustomers((await res.json()).customers);
  }

  function cardUrl(c: CustomerRow) {
    return `${window.location.origin}/tarjeta/${c.cardToken}`;
  }

  async function copyCardLink(c: CustomerRow) {
    await navigator.clipboard.writeText(cardUrl(c));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function whatsappLink(c: CustomerRow) {
    const text = `Hola ${c.name}, esta es tu tarjeta de cliente frecuente: ${cardUrl(c)}`;
    const phone = c.phone ? `52${c.phone}` : "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Clientes registrados" value={stats.customers} />
        <StatCard label="Visitas (30 días)" value={stats.visits30d} />
        <StatCard label="Descuentos canjeados (30 días)" value={stats.redemptions30d} />
        <StatCard label="Con descuento disponible" value={stats.pendingRewards} tone="sage" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Configuración</h2>
          <form onSubmit={saveConfig}>
            <label className="flex items-center gap-2 text-sm mb-5">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Programa activo (si lo pausas no se registran visitas ni canjes)
            </label>

            <Field label="Visitas necesarias para el descuento">
              <input
                className={inputClass}
                type="number"
                min={2}
                max={50}
                value={visitsRequired}
                onChange={(e) => setVisitsRequired(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de descuento">
                <select
                  className={inputClass}
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")}
                >
                  <option value="PERCENT">Porcentaje (%)</option>
                  <option value="FIXED">Monto fijo (MXN)</option>
                </select>
              </Field>
              <Field label={discountType === "PERCENT" ? "Porcentaje" : "Monto (MXN)"}>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={discountType === "PERCENT" ? 100 : undefined}
                  step="any"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Nombre en la tarjeta (opcional)">
              <input
                className={inputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Si lo dejas vacío se usa el nombre de tu empresa"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm mb-5">
              <input type="checkbox" checked={oneVisitPerDay} onChange={(e) => setOneVisitPerDay(e.target.checked)} />
              Máximo una visita por cliente al día
            </label>

            {message && (
              <p
                className={`text-sm rounded-md px-3 py-2 mb-4 ${
                  message.ok ? "bg-sage-light text-sage" : "bg-ember/10 text-ember-dark"
                }`}
              >
                {message.text}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-xl font-semibold mb-1">QR de registro del mostrador</h2>
          <p className="text-sm text-muted mb-4">
            Imprímelo y ponlo en el mostrador o las mesas. El cliente lo escanea con su celular, deja su nombre y
            celular y recibe su tarjeta digital.
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white border border-line rounded-lg p-3">
              <QrImage path={signupPath} size={200} />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => downloadQrPng(signupPath, "qr-registro-clientes.png")}>
                Descargar QR (PNG)
              </Button>
              <Button variant="ghost" onClick={rotateSignup}>
                Generar QR nuevo
              </Button>
            </div>
            <p className="text-[11px] text-muted break-all text-center">
              {typeof window !== "undefined" ? window.location.origin : ""}
              {signupPath}
            </p>
          </div>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display text-xl font-semibold">Clientes</h2>
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="Buscar por nombre, celular o código"
            value={search}
            onChange={(e) => runSearch(e.target.value)}
          />
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Celular</th>
                <th className="px-5 py-3 font-medium">Visitas</th>
                <th className="px-5 py-3 font-medium">Última visita</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Aún no hay clientes registrados. Comparte el QR del mostrador para empezar.
                  </td>
                </tr>
              )}
              {customers.map((c) => {
                const ready = c.visitsInCycle >= program.visitsRequired;
                return (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium">{c.name}</td>
                    <td className="px-5 py-3 text-muted">{c.phone ?? "—"}</td>
                    <td className="px-5 py-3">
                      {c.visitsInCycle}/{program.visitsRequired}
                      {ready && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-sage/15 text-sage">
                          Descuento disponible
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString("es-MX") : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" onClick={() => setCardModal(c)}>
                        Ver tarjeta
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <Modal open={!!cardModal} onClose={() => setCardModal(null)} title={cardModal?.name ?? "Tarjeta"}>
        {cardModal?.cardToken && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white border border-line rounded-lg p-3">
              <QrImage path={`/tarjeta/${cardModal.cardToken}`} size={200} />
            </div>
            {cardModal.shortCode && (
              <p className="text-xs text-muted">
                Código: <span className="font-mono tracking-widest text-ink">{cardModal.shortCode}</span>
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => copyCardLink(cardModal)}>
                {copied ? "¡Copiado!" : "Copiar enlace"}
              </Button>
              <a
                href={whatsappLink(cardModal)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium bg-ember text-white hover:bg-ember-dark"
              >
                Enviar por WhatsApp
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
