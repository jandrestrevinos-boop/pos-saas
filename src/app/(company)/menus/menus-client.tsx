"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMxn } from "@/lib/format";

type Menu = {
  id: string;
  name: string;
  price: number;
  baseCost: number;
  worstCost: number;
  worstFoodCostPercent: number | null;
  isActive: boolean;
  categoryId: string;
  category: string;
  groups: {
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    options: { id: string; optionProductId: string; name: string; extraPrice: number; cost: number; isActive: boolean }[];
  }[];
};

type Simple = { id: string; name: string };
type GroupForm = {
  name: string;
  minSelect: string;
  maxSelect: string;
  options: { optionProductId: string; extraPrice: string }[];
};

const inputBase = "rounded-md border border-line px-3 py-2 text-sm";
const inputCls = `w-full ${inputBase}`;

export function MenusClient({ categories, products }: { categories: Simple[]; products: Simple[] }) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingMenu, setEditingMenu] = useState<Menu | "new" | null>(null);
  const [editingGroups, setEditingGroups] = useState<Menu | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/menus");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los menús");
      setMenus(data.menus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los menús");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  return (
    <div>
      <button onClick={() => setEditingMenu("new")} className="rounded-md bg-ember text-white px-5 py-2.5 text-sm font-medium mb-5">
        Nuevo menú
      </button>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="space-y-4">
        {menus.map((m) => (
          <div key={m.id} className={`bg-paper-raised border border-line rounded-lg p-5 ${m.isActive ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-display text-lg font-semibold">
                  {m.name} {!m.isActive && <span className="text-xs text-muted font-sans">(inactivo)</span>}
                </p>
                <p className="text-xs text-muted">{m.category}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg">{formatMxn(m.price)}</p>
                <p className="text-xs text-muted">
                  Costo base {formatMxn(m.baseCost)} · peor caso {formatMxn(m.worstCost)}
                  {m.worstFoodCostPercent !== null && ` (${m.worstFoodCostPercent.toFixed(0)}% Food Cost)`}
                </p>
              </div>
            </div>

            {m.groups.length === 0 ? (
              <p className="text-sm text-muted mb-3">Este menú todavía no tiene grupos de opciones.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {m.groups.map((g) => (
                  <div key={g.id} className="text-sm">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-muted">
                      {" "}
                      ({g.minSelect === g.maxSelect ? `elige ${g.maxSelect}` : `de ${g.minSelect} a ${g.maxSelect}`}):{" "}
                    </span>
                    {g.options.map((o, i) => (
                      <span key={o.id}>
                        {o.name}
                        <span className="text-muted">{o.extraPrice > 0 ? ` +${formatMxn(o.extraPrice)}` : " (incluida)"}</span>
                        {i < g.options.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-4 text-sm">
              <button onClick={() => setEditingGroups(m)} className="text-ember underline">
                Opciones y guarniciones
              </button>
              <button onClick={() => setEditingMenu(m)} className="text-ember underline">
                Editar menú
              </button>
            </div>
          </div>
        ))}
        {menus.length === 0 && (
          <p className="text-sm text-muted">Todavía no hay menús. Crea el primero, por ejemplo una &quot;Comida corrida&quot;.</p>
        )}
      </div>

      {editingMenu && (
        <MenuModal
          menu={editingMenu === "new" ? null : editingMenu}
          categories={categories}
          onClose={() => setEditingMenu(null)}
          onSaved={() => {
            setEditingMenu(null);
            load();
          }}
        />
      )}

      {editingGroups && (
        <GroupsModal
          menu={editingGroups}
          products={products}
          onClose={() => setEditingGroups(null)}
          onSaved={() => {
            setEditingGroups(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MenuModal({
  menu,
  categories,
  onClose,
  onSaved,
}: {
  menu: Menu | null;
  categories: Simple[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(menu?.name ?? "");
  const [categoryId, setCategoryId] = useState(menu?.categoryId ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(menu ? String(menu.price) : "");
  const [isActive, setIsActive] = useState(menu?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(menu ? `/api/menus/${menu.id}` : "/api/menus", {
        method: menu ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, categoryId, price, isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el menú");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el menú");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-950/60 flex items-center justify-center z-50 p-4">
      <div className="bg-paper-raised rounded-lg w-full max-w-md p-6 space-y-4">
        <p className="font-display text-xl font-semibold">{menu ? "Editar menú" : "Nuevo menú"}</p>
        <div>
          <label className="text-xs text-muted">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ej. Comida corrida" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted">Categoría</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Precio fijo</label>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
          </div>
        </div>
        {menu && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo en el Punto de Venta
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-md border border-line py-2.5 text-sm">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-md bg-ember text-white py-2.5 text-sm font-medium disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupsModal({
  menu,
  products,
  onClose,
  onSaved,
}: {
  menu: Menu;
  products: Simple[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [groups, setGroups] = useState<GroupForm[]>(
    menu.groups.map((g) => ({
      name: g.name,
      minSelect: String(g.minSelect),
      maxSelect: String(g.maxSelect),
      options: g.options.map((o) => ({ optionProductId: o.optionProductId, extraPrice: String(o.extraPrice) })),
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateGroup(gi: number, patch: Partial<GroupForm>) {
    setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function updateOption(gi: number, oi: number, patch: Partial<GroupForm["options"][number]>) {
    setGroups((prev) =>
      prev.map((g, i) => (i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : g))
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      for (const g of groups) {
        const label = g.name.trim() || "sin nombre";
        if (!g.name.trim()) throw new Error("Cada grupo necesita un nombre (por ejemplo: Guarnición)");
        if (!g.options.some((o) => o.optionProductId)) {
          throw new Error(`En el grupo "${label}" falta elegir un producto en la lista de opciones (el desplegable "Elige un producto...")`);
        }
      }
      const body = {
        groups: groups.map((g) => ({
          name: g.name,
          minSelect: Number(g.minSelect),
          maxSelect: Number(g.maxSelect),
          options: g.options.filter((o) => o.optionProductId).map((o) => ({ optionProductId: o.optionProductId, extraPrice: Number(o.extraPrice || 0) })),
        })),
      };
      const res = await fetch(`/api/menus/${menu.id}/groups`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron guardar las opciones");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar las opciones");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-950/60 flex items-center justify-center z-50 p-4">
      <div className="bg-paper-raised rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-line">
          <p className="font-display text-xl font-semibold">Opciones de: {menu.name}</p>
          <p className="text-xs text-muted">
            Cada grupo es algo que el cliente elige (guarnición, sopa, bebida) y dentro van las opciones. Ejemplo: grupo &quot;Guarnición&quot; con las opciones
            arroz y puré de papa. Cargo extra en 0 = incluida en {formatMxn(menu.price)}.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {groups.map((g, gi) => (
            <div key={gi} className="border border-line rounded-md p-4 space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted">Grupo</label>
                  <input value={g.name} onChange={(e) => updateGroup(gi, { name: e.target.value })} className={inputCls} placeholder="Ej. Guarnición" />
                </div>
                <div className="w-20">
                  <label className="text-xs text-muted">Mín.</label>
                  <input type="number" min="0" value={g.minSelect} onChange={(e) => updateGroup(gi, { minSelect: e.target.value })} className={inputCls} />
                </div>
                <div className="w-20">
                  <label className="text-xs text-muted">Máx.</label>
                  <input type="number" min="1" value={g.maxSelect} onChange={(e) => updateGroup(gi, { maxSelect: e.target.value })} className={inputCls} />
                </div>
                <button onClick={() => setGroups((prev) => prev.filter((_, i) => i !== gi))} className="text-red-600 text-sm underline pb-2">
                  Quitar
                </button>
              </div>

              {g.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <select value={o.optionProductId} onChange={(e) => updateOption(gi, oi, { optionProductId: e.target.value })} className={`${inputBase} flex-1 min-w-0`}>
                    <option value="">Elige un producto...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted">Extra $</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={o.extraPrice}
                    onChange={(e) => updateOption(gi, oi, { extraPrice: e.target.value })}
                    className={`${inputBase} w-24 shrink-0`}
                  />
                  <button
                    onClick={() => updateGroup(gi, { options: g.options.filter((_, j) => j !== oi) })}
                    className="text-red-600 text-lg leading-none px-1"
                    aria-label="Quitar opción"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateGroup(gi, { options: [...g.options, { optionProductId: "", extraPrice: "0" }] })}
                className="text-ember underline text-sm"
              >
                + Agregar opción
              </button>
            </div>
          ))}

          <button
            onClick={() => setGroups((prev) => [...prev, { name: "", minSelect: "1", maxSelect: "1", options: [{ optionProductId: "", extraPrice: "0" }] }])}
            className="rounded-md border border-line px-4 py-2 text-sm"
          >
            + Nuevo grupo
          </button>
        </div>

        <div className="px-6 py-4 border-t border-line space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-md border border-line py-2.5 text-sm">
              Cancelar
            </button>
            <button onClick={save} disabled={saving} className="flex-1 rounded-md bg-ember text-white py-2.5 text-sm font-medium disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar opciones"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
