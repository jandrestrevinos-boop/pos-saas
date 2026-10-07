"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { describePromotion, type PromotionKind, type PromotionScope } from "@/lib/promotions";

type Option = { id: string; name: string };
type Promo = {
  id: string;
  name: string;
  kind: PromotionKind;
  scope: PromotionScope;
  value: number | null;
  buyQty: number | null;
  payQty: number | null;
  minSubtotal: number | null;
  productIds: string[];
  categoryIds: string[];
  couponCode: string | null;
  maxUses: number | null;
  usesCount: number;
  startsAt: string | null;
  endsAt: string | null;
  weekdays: number[];
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
};

type Form = {
  name: string;
  kind: PromotionKind;
  scope: PromotionScope;
  value: string;
  buyQty: string;
  payQty: string;
  minSubtotal: string;
  productIds: string[];
  categoryIds: string[];
  couponCode: string;
  maxUses: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const EMPTY: Form = {
  name: "", kind: "PERCENT_OFF", scope: "PRODUCTS", value: "", buyQty: "2", payQty: "1", minSubtotal: "",
  productIds: [], categoryIds: [], couponCode: "", maxUses: "", startDate: "", endDate: "", weekdays: [], startTime: "", endTime: "",
};

const inputCls = "w-full rounded-md border border-line px-3 py-2 text-sm";
const labelCls = "block text-xs text-muted mb-1";

// Las fechas de vigencia se capturan como día completo en hora de México (UTC-6, sin horario de verano).
const dayStart = (d: string) => (d ? `${d}T00:00:00-06:00` : null);
const dayEnd = (d: string) => (d ? `${d}T23:59:59-06:00` : null);
const toDay = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10) : "");

function toForm(p: Promo): Form {
  return {
    name: p.name, kind: p.kind, scope: p.scope,
    value: p.value?.toString() ?? "", buyQty: p.buyQty?.toString() ?? "2", payQty: p.payQty?.toString() ?? "1",
    minSubtotal: p.minSubtotal?.toString() ?? "", productIds: p.productIds, categoryIds: p.categoryIds,
    couponCode: p.couponCode ?? "", maxUses: p.maxUses?.toString() ?? "",
    startDate: toDay(p.startsAt), endDate: toDay(p.endsAt), weekdays: p.weekdays,
    startTime: p.startTime ?? "", endTime: p.endTime ?? "",
  };
}

function toPayload(f: Form) {
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    name: f.name,
    kind: f.kind,
    scope: f.scope,
    value: f.kind === "BUY_X_PAY_Y" ? null : num(f.value),
    buyQty: f.kind === "BUY_X_PAY_Y" ? num(f.buyQty) : null,
    payQty: f.kind === "BUY_X_PAY_Y" ? num(f.payQty) : null,
    minSubtotal: f.scope === "TICKET" ? num(f.minSubtotal) : null,
    productIds: f.productIds,
    categoryIds: f.categoryIds,
    couponCode: f.couponCode.trim() || null,
    maxUses: num(f.maxUses),
    startsAt: dayStart(f.startDate),
    endsAt: dayEnd(f.endDate),
    weekdays: f.weekdays,
    startTime: f.startTime || null,
    endTime: f.endTime || null,
    isActive: true,
  };
}

function schedule(p: Promo): string {
  const parts: string[] = [];
  if (p.weekdays.length > 0 && p.weekdays.length < 7) parts.push(p.weekdays.map((d) => DAY_LABELS[d]).join(", "));
  if (p.startTime && p.endTime) parts.push(`${p.startTime} a ${p.endTime}`);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
  if (p.startsAt && p.endsAt) parts.push(`${fmt(p.startsAt)} al ${fmt(p.endsAt)}`);
  else if (p.startsAt) parts.push(`desde ${fmt(p.startsAt)}`);
  else if (p.endsAt) parts.push(`hasta ${fmt(p.endsAt)}`);
  return parts.length > 0 ? parts.join(" · ") : "Siempre";
}

function Check({ options, selected, onChange }: { options: Option[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="max-h-44 overflow-y-auto rounded-md border border-line p-2 space-y-1">
      {options.length === 0 && <p className="text-xs text-muted px-1">No hay opciones disponibles.</p>}
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-sm px-1">
          <input
            type="checkbox"
            checked={selected.includes(o.id)}
            onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))}
          />
          {o.name}
        </label>
      ))}
    </div>
  );
}

export function PromotionsClient({ products, categories }: { products: Option[]; categories: Option[] }) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/promotions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las promociones");
      setPromos(data.promotions);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las promociones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(editing.id ? `/api/promotions/${editing.id}` : "/api/promotions", {
        method: editing.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editing.form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la promoción");
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la promoción");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: Promo) {
    await fetch(`/api/promotions/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  }

  async function remove(p: Promo) {
    if (!window.confirm(`¿Eliminar la promoción "${p.name}"? Las ventas ya hechas conservan su descuento.`)) return;
    await fetch(`/api/promotions/${p.id}`, { method: "DELETE" });
    load();
  }

  const f = editing?.form;
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => { setFormError(""); setEditing({ id: null, form: EMPTY }); }} className="rounded-md bg-ember text-white px-4 py-2 text-sm font-medium">
          + Nueva promoción
        </button>
      </div>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2">{error}</p>}

      {editing && f && (
        <Card className="p-5 space-y-4">
          <p className="font-display text-lg font-semibold">{editing.id ? "Editar promoción" : "Nueva promoción"}</p>

          <div>
            <label className={labelCls}>Nombre (lo ve el cajero y sale en el ticket)</label>
            <input className={inputCls} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. 2x1 en tacos de los martes" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tipo de descuento</label>
              <select className={inputCls} value={f.kind} onChange={(e) => set({ kind: e.target.value as PromotionKind, scope: e.target.value === "BUY_X_PAY_Y" && f.scope === "TICKET" ? "PRODUCTS" : f.scope })}>
                <option value="PERCENT_OFF">Porcentaje (%)</option>
                <option value="AMOUNT_OFF">Monto fijo ($)</option>
                <option value="BUY_X_PAY_Y">Lleva X y paga Y (2x1, 3x2…)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Aplica a</label>
              <select className={inputCls} value={f.scope} onChange={(e) => set({ scope: e.target.value as PromotionScope })}>
                <option value="PRODUCTS">Productos específicos</option>
                <option value="CATEGORIES">Categorías</option>
                {f.kind !== "BUY_X_PAY_Y" && <option value="TICKET">Ticket completo</option>}
              </select>
            </div>
          </div>

          {f.kind === "BUY_X_PAY_Y" ? (
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div>
                <label className={labelCls}>Lleva (piezas)</label>
                <input type="number" min="2" className={inputCls} value={f.buyQty} onChange={(e) => set({ buyQty: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Paga (piezas)</label>
                <input type="number" min="0" className={inputCls} value={f.payQty} onChange={(e) => set({ payQty: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="max-w-xs">
              <label className={labelCls}>
                {f.kind === "PERCENT_OFF" ? "Porcentaje de descuento" : f.scope === "TICKET" ? "Monto de descuento ($)" : "Descuento por pieza ($)"}
              </label>
              <input type="number" min="0" step="0.01" className={inputCls} value={f.value} onChange={(e) => set({ value: e.target.value })} />
            </div>
          )}

          {f.scope === "PRODUCTS" && (
            <div>
              <label className={labelCls}>Productos</label>
              <Check options={products} selected={f.productIds} onChange={(productIds) => set({ productIds })} />
            </div>
          )}
          {f.scope === "CATEGORIES" && (
            <div>
              <label className={labelCls}>Categorías</label>
              <Check options={categories} selected={f.categoryIds} onChange={(categoryIds) => set({ categoryIds })} />
            </div>
          )}
          {f.scope === "TICKET" && (
            <div className="max-w-xs">
              <label className={labelCls}>Compra mínima para aplicar ($, opcional)</label>
              <input type="number" min="0" className={inputCls} value={f.minSubtotal} onChange={(e) => set({ minSubtotal: e.target.value })} />
            </div>
          )}

          <div className="border-t border-line pt-4 space-y-4">
            <p className="text-sm font-medium">Cuándo aplica</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Desde (opcional)</label>
                <input type="date" className={inputCls} value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Hasta (opcional)</label>
                <input type="date" className={inputCls} value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Días de la semana (sin marcar = todos)</label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set({ weekdays: f.weekdays.includes(i) ? f.weekdays.filter((x) => x !== i) : [...f.weekdays, i] })}
                    className={`rounded-md border px-3 py-1.5 text-sm ${f.weekdays.includes(i) ? "bg-ink-950 text-white border-ink-950" : "border-line"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div>
                <label className={labelCls}>Hora de inicio (opcional)</label>
                <input type="time" className={inputCls} value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Hora de fin</label>
                <input type="time" className={inputCls} value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted">Los horarios se toman en hora de Monterrey.</p>
          </div>

          <div className="border-t border-line pt-4 grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Código de cupón (opcional: si lo pones, solo aplica cuando el cajero lo escribe)</label>
              <input className={inputCls} value={f.couponCode} onChange={(e) => set({ couponCode: e.target.value.toUpperCase() })} placeholder="VERANO10" />
            </div>
            <div>
              <label className={labelCls}>Límite de usos del cupón (opcional)</label>
              <input type="number" min="1" className={inputCls} value={f.maxUses} onChange={(e) => set({ maxUses: e.target.value })} />
            </div>
          </div>

          {formError && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2">{formError}</p>}
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="rounded-md border border-line px-4 py-2 text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="rounded-md bg-ember text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
              {saving ? "Guardando..." : "Guardar promoción"}
            </button>
          </div>
        </Card>
      )}

      {loading && promos.length === 0 ? (
        <p className="text-muted text-sm">Cargando...</p>
      ) : promos.length === 0 ? (
        <p className="text-muted text-sm">Todavía no tienes promociones. Crea la primera con el botón de arriba.</p>
      ) : (
        <Card className="ticket-edge overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper text-xs uppercase text-muted">
              <tr>
                <th className="text-left px-4 py-3">Promoción</th>
                <th className="text-left px-4 py-3">Descuento</th>
                <th className="text-left px-4 py-3">Cuándo</th>
                <th className="text-left px-4 py-3">Cupón</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    {describePromotion(p)}
                    {p.scope === "TICKET" && p.minSubtotal ? <span className="text-muted"> (desde ${p.minSubtotal})</span> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{schedule(p)}</td>
                  <td className="px-4 py-3">
                    {p.couponCode ? (
                      <span className="font-mono">{p.couponCode}<span className="text-muted"> · {p.usesCount}{p.maxUses ? `/${p.maxUses}` : ""} usos</span></span>
                    ) : (
                      <span className="text-muted">Automática</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.isActive ? "Activa" : <span className="text-muted">Pausada</span>}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-3 text-xs">
                    <button className="underline" onClick={() => { setFormError(""); setEditing({ id: p.id, form: toForm(p) }); }}>Editar</button>
                    <button className="underline" onClick={() => toggle(p)}>{p.isActive ? "Pausar" : "Activar"}</button>
                    <button className="underline text-ember-dark" onClick={() => remove(p)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
