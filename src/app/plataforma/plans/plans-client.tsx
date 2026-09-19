"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { formatMxn } from "@/lib/format";
import { FEATURE_CATALOG, featureLabel, VALID_FEATURE_KEYS } from "@/lib/plan-features";

type Plan = {
  id: string;
  name: string;
  priceMxn: string;
  maxBranches: number;
  maxUsers: number;
  maxCashRegisters: number;
  features: string[] | null;
  _count: { subscriptions: number };
};

const PLAN_ACCENTS: Record<string, string> = {
  Básico: "border-sage",
  Profesional: "border-ember ring-2 ring-ember/20",
  Empresarial: "border-marigold",
};

export function PlansClient({ initialPlans }: { initialPlans: Plan[] }) {
  const [plans, setPlans] = useState(initialPlans);
  const [editing, setEditing] = useState<Plan | null>(null);

function buildDisplayFeatures(plan: Plan): string[] {
  // No tocar lo que ya funciona: cualquier string guardado que no sea una
  // key del catálogo nuevo (ej. las labels viejas de prisma/seed.ts como
  // "Auditoría" o "Pantalla de cocina (sin impresora)") se muestra tal cual,
  // sin filtrarlo. Solo las keys nuevas del catálogo se traducen a su label.
  const nonCapacity = (plan.features ?? []).map((f) => (VALID_FEATURE_KEYS.has(f) ? featureLabel(f) : f));

  if (plan.name === "Empresarial") {
    return ["Multi-sucursal", `Hasta ${plan.maxCashRegisters} cajas`, `Hasta ${plan.maxUsers} usuarios`, ...nonCapacity];
  }

  return [
    `${plan.maxBranches} sucursal${plan.maxBranches === 1 ? "" : "es"}`,
    `Hasta ${plan.maxCashRegisters} caja${plan.maxCashRegisters === 1 ? "" : "s"}`,
    `Hasta ${plan.maxUsers} usuario${plan.maxUsers === 1 ? "" : "s"}`,
    ...nonCapacity,
  ];
}

  function handleUpdated(updated: Plan) {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setEditing(null);
  }

  return (
    <>
      <div className="grid md:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <Card key={plan.id} className={`p-6 border-2 ${PLAN_ACCENTS[plan.name] ?? "border-line"}`}>
            {plan.name === "Profesional" && (
              <p className="text-xs font-semibold uppercase tracking-wide text-ember-dark mb-2">Plan estrella</p>
            )}
            <p className="font-display text-xl font-semibold mb-1">{plan.name}</p>
            <p className="font-display text-3xl font-semibold mb-1">
              {formatMxn(plan.priceMxn)}
              <span className="text-sm font-sans font-normal text-muted">/mes</span>
            </p>
            <p className="text-xs text-muted mb-4">
              {plan._count.subscriptions} {plan._count.subscriptions === 1 ? "empresa suscrita" : "empresas suscritas"}
            </p>

            <ul className="space-y-1.5 mb-5 text-sm">
              {buildDisplayFeatures(plan).map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button variant="secondary" onClick={() => setEditing(plan)} className="w-full">
              Editar
            </Button>
          </Card>
        ))}
      </div>

      {editing && <EditPlanModal plan={editing} onClose={() => setEditing(null)} onSaved={handleUpdated} />}
    </>
  );
}

function EditPlanModal({ plan, onClose, onSaved }: { plan: Plan; onClose: () => void; onSaved: (p: Plan) => void }) {
  const [priceMxn, setPriceMxn] = useState(plan.priceMxn);
  const [maxBranches, setMaxBranches] = useState(String(plan.maxBranches));
  const [maxUsers, setMaxUsers] = useState(String(plan.maxUsers));
  const [maxCashRegisters, setMaxCashRegisters] = useState(String(plan.maxCashRegisters));
  const [checkedFeatures, setCheckedFeatures] = useState<Set<string>>(
    new Set((plan.features ?? []).filter((f) => VALID_FEATURE_KEYS.has(f)))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleFeature(feature: string) {
    setCheckedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(feature)) next.delete(feature);
      else next.add(feature);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    // Conserva cualquier feature que ya estuviera guardada y que no forme
    // parte de este catálogo (por si hay algo custom cargado desde el
    // seed), y sobreescribe únicamente las del catálogo con lo marcado.
    const preservedNonCatalog = (plan.features ?? []).filter((f) => !VALID_FEATURE_KEYS.has(f));
    const features = [
      ...preservedNonCatalog,
      ...FEATURE_CATALOG.filter((f) => checkedFeatures.has(f.key)).map((f) => f.key),
    ];

    const res = await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceMxn: parseFloat(priceMxn) || 0,
        maxBranches: parseInt(maxBranches, 10) || 1,
        maxUsers: parseInt(maxUsers, 10) || 1,
        maxCashRegisters: parseInt(maxCashRegisters, 10) || 1,
        features,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo actualizar el plan");
      return;
    }
    onSaved({ ...plan, ...data.plan });
  }

  return (
    <Modal open onClose={onClose} title={`Editar plan ${plan.name}`}>
      <form onSubmit={handleSubmit}>
        <Field label="Precio mensual (MXN)">
          <input required type="number" min="0" step="1" className={inputClass} value={priceMxn} onChange={(e) => setPriceMxn(e.target.value)} />
        </Field>
        <Field label="Sucursales permitidas">
          <input required type="number" min="1" className={inputClass} value={maxBranches} onChange={(e) => setMaxBranches(e.target.value)} />
        </Field>
        <Field label="Usuarios permitidos">
          <input required type="number" min="1" className={inputClass} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} />
        </Field>
        <Field label="Cajas permitidas">
          <input required type="number" min="1" className={inputClass} value={maxCashRegisters} onChange={(e) => setMaxCashRegisters(e.target.value)} />
        </Field>

        <Field label="Características incluidas">
          <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto border border-line rounded-md p-3">
            {FEATURE_CATALOG.map((feature) => (
              <label key={feature.key} className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checkedFeatures.has(feature.key)}
                  onChange={() => toggleFeature(feature.key)}
                />
                <span className="flex-1">{feature.label}</span>
                {feature.status !== "live" && (
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      feature.status === "partial" ? "bg-marigold/20 text-marigold-dark" : "bg-ink-100 text-muted"
                    }`}
                  >
                    {feature.status === "partial" ? "parcial" : "sin construir"}
                  </span>
                )}
              </label>
            ))}
          </div>
        </Field>

        {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
