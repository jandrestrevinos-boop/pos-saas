"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMxn } from "@/lib/format";
import { INGREDIENT_UNITS, effectiveUnitCost, recipeCost, foodCostPercent } from "@/lib/recipe-cost";

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  costPerUnit: string | number;
  wastePercent: string | number;
  isActive: boolean;
  _count?: { recipeItems: number };
};

type CostingRow = {
  id: string;
  name: string;
  category: string;
  isMenu: boolean;
  price: number;
  cost: number | null;
  hasRecipe: boolean;
  margin: number | null;
  foodCostPercent: number | null;
};

type RecipeLineForm = { ingredientId: string; quantity: string };

const inputCls = "w-full rounded-md border border-line px-3 py-2 text-sm";

function fcColor(pct: number | null): string {
  if (pct === null) return "text-muted";
  if (pct <= 35) return "text-sage";
  if (pct <= 45) return "text-marigold";
  return "text-red-600";
}

export function RecipesClient() {
  const [tab, setTab] = useState<"costeo" | "insumos">("costeo");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [costing, setCosting] = useState<CostingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | "new" | null>(null);
  const [recipeFor, setRecipeFor] = useState<CostingRow | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [ing, cost] = await Promise.all([fetch("/api/ingredients"), fetch("/api/recipes/costing")]);
      const ingData = await ing.json();
      const costData = await cost.json();
      if (!ing.ok) throw new Error(ingData.error ?? "No se pudieron cargar los insumos");
      if (!cost.ok) throw new Error(costData.error ?? "No se pudo cargar el costeo");
      setIngredients(ingData.ingredients);
      setCosting(costData.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la información");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => costing.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())),
    [costing, search]
  );

  async function removeIngredient(ing: Ingredient) {
    if (!confirm(`¿Eliminar "${ing.name}"?`)) return;
    const res = await fetch(`/api/ingredients/${ing.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo eliminar el insumo");
      return;
    }
    if (data.deactivated) setError("Ese insumo ya está en recetas, así que se desactivó en lugar de borrarse.");
    load();
  }

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {(["costeo", "insumos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-5 py-2.5 text-sm font-medium ${tab === t ? "bg-ink-950 text-white" : "bg-white border border-line"}`}
          >
            {t === "costeo" ? "Costeo por platillo" : `Insumos (${ingredients.length})`}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {tab === "costeo" && (
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar platillo..."
            className={`${inputCls} max-w-xs mb-4`}
          />
          <div className="bg-paper-raised border border-line rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className="px-5 py-3 font-medium">Platillo</th>
                  <th className="px-5 py-3 font-medium">Precio</th>
                  <th className="px-5 py-3 font-medium">Costo</th>
                  <th className="px-5 py-3 font-medium">Margen</th>
                  <th className="px-5 py-3 font-medium">Food Cost %</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted">
                        {p.category}
                        {p.isMenu && " · Menú"} · {p.hasRecipe ? "Con receta" : p.cost === null ? "Sin costo" : "Costo capturado a mano"}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono">{formatMxn(p.price)}</td>
                    <td className="px-5 py-3 font-mono">{p.cost === null ? "—" : formatMxn(p.cost)}</td>
                    <td className="px-5 py-3 font-mono">{p.margin === null ? "—" : formatMxn(p.margin)}</td>
                    <td className={`px-5 py-3 font-mono ${fcColor(p.foodCostPercent)}`}>
                      {p.foodCostPercent === null ? "—" : `${p.foodCostPercent.toFixed(1)}%`}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setRecipeFor(p)} className="text-ember underline text-sm">
                        {p.hasRecipe ? "Editar receta" : "Armar receta"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted">
                      No hay productos que coincidan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "insumos" && (
        <div>
          <button onClick={() => setEditingIngredient("new")} className="rounded-md bg-ember text-white px-5 py-2.5 text-sm font-medium mb-4">
            Nuevo insumo
          </button>
          <div className="bg-paper-raised border border-line rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className="px-5 py-3 font-medium">Insumo</th>
                  <th className="px-5 py-3 font-medium">Costo por unidad</th>
                  <th className="px-5 py-3 font-medium">Merma</th>
                  <th className="px-5 py-3 font-medium">Costo real</th>
                  <th className="px-5 py-3 font-medium">En recetas</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {ingredients.map((i) => (
                  <tr key={i.id} className={`border-b border-line last:border-0 ${i.isActive ? "" : "opacity-50"}`}>
                    <td className="px-5 py-3 font-medium">
                      {i.name}
                      {!i.isActive && <span className="ml-2 text-xs text-muted">(inactivo)</span>}
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {formatMxn(Number(i.costPerUnit))} / {i.unit}
                    </td>
                    <td className="px-5 py-3 font-mono">{Number(i.wastePercent)}%</td>
                    <td className="px-5 py-3 font-mono">
                      {formatMxn(effectiveUnitCost(Number(i.costPerUnit), Number(i.wastePercent)))} / {i.unit}
                    </td>
                    <td className="px-5 py-3">{i._count?.recipeItems ?? 0}</td>
                    <td className="px-5 py-3 text-right space-x-4">
                      <button onClick={() => setEditingIngredient(i)} className="text-ember underline">
                        Editar
                      </button>
                      <button onClick={() => removeIngredient(i)} className="text-red-600 underline">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {ingredients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted">
                      Todavía no hay insumos. Empieza con los principales (carne, tortilla, aceite...).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-3">
            La merma es el % que se pierde al limpiar o cocinar el insumo; el costo real por unidad ya la incluye. Si cambias el costo
            de un insumo, todas las recetas que lo usan se recalculan solas.
          </p>
        </div>
      )}

      {editingIngredient && (
        <IngredientModal
          ingredient={editingIngredient === "new" ? null : editingIngredient}
          onClose={() => setEditingIngredient(null)}
          onSaved={() => {
            setEditingIngredient(null);
            load();
          }}
        />
      )}

      {recipeFor && (
        <RecipeModal
          product={recipeFor}
          ingredients={ingredients.filter((i) => i.isActive)}
          onClose={() => setRecipeFor(null)}
          onSaved={() => {
            setRecipeFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function IngredientModal({
  ingredient,
  onClose,
  onSaved,
}: {
  ingredient: Ingredient | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(ingredient?.name ?? "");
  const [unit, setUnit] = useState(ingredient?.unit ?? "kg");
  const [costPerUnit, setCostPerUnit] = useState(ingredient ? String(Number(ingredient.costPerUnit)) : "");
  const [wastePercent, setWastePercent] = useState(ingredient ? String(Number(ingredient.wastePercent)) : "0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(ingredient ? `/api/ingredients/${ingredient.id}` : "/api/ingredients", {
        method: ingredient ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unit, costPerUnit, wastePercent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el insumo");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el insumo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-950/60 flex items-center justify-center z-50 p-4">
      <div className="bg-paper-raised rounded-lg w-full max-w-md p-6 space-y-4">
        <p className="font-display text-xl font-semibold">{ingredient ? "Editar insumo" : "Nuevo insumo"}</p>
        <div>
          <label className="text-xs text-muted">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ej. Carne de res" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted">Unidad de compra</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
              {INGREDIENT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Costo por {unit}</label>
            <input type="number" min="0" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted">Merma (%)</label>
          <input type="number" min="0" max="95" step="0.5" value={wastePercent} onChange={(e) => setWastePercent(e.target.value)} className={inputCls} />
        </div>
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

function RecipeModal({
  product,
  ingredients,
  onClose,
  onSaved,
}: {
  product: CostingRow;
  ingredients: Ingredient[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lines, setLines] = useState<RecipeLineForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/products/${product.id}/recipe`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo cargar la receta");
        setLines(
          (data.items as { ingredientId: string; quantity: string | number }[]).map((i) => ({
            ingredientId: i.ingredientId,
            quantity: String(Number(i.quantity)),
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la receta");
      } finally {
        setLoading(false);
      }
    })();
  }, [product.id]);

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const liveCost = recipeCost(
    lines
      .filter((l) => byId.has(l.ingredientId) && Number(l.quantity) > 0)
      .map((l) => {
        const ing = byId.get(l.ingredientId)!;
        return { quantity: Number(l.quantity), costPerUnit: Number(ing.costPerUnit), wastePercent: Number(ing.wastePercent) };
      })
  );
  const liveFoodCost = foodCostPercent(liveCost, product.price);

  function update(index: number, patch: Partial<RecipeLineForm>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const items = lines
        .filter((l) => l.ingredientId)
        .map((l) => ({ ingredientId: l.ingredientId, quantity: Number(l.quantity) }));
      if (items.some((i) => !(i.quantity > 0))) throw new Error("Cada insumo necesita una cantidad mayor a 0");
      const res = await fetch(`/api/products/${product.id}/recipe`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la receta");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la receta");
    } finally {
      setSaving(false);
    }
  }

  const usedIds = new Set(lines.map((l) => l.ingredientId));

  return (
    <div className="fixed inset-0 bg-ink-950/60 flex items-center justify-center z-50 p-4">
      <div className="bg-paper-raised rounded-lg w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-line">
          <p className="font-display text-xl font-semibold">Receta: {product.name}</p>
          <p className="text-xs text-muted">Cantidad de cada insumo que lleva UNA porción. Precio de venta: {formatMxn(product.price)}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted">Cargando...</p>
          ) : (
            <>
              {lines.map((l, idx) => {
                const ing = byId.get(l.ingredientId);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select value={l.ingredientId} onChange={(e) => update(idx, { ingredientId: e.target.value })} className={`${inputCls} flex-1`}>
                      <option value="">Elige un insumo...</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id} disabled={usedIds.has(i.id) && i.id !== l.ingredientId}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={l.quantity}
                      onChange={(e) => update(idx, { quantity: e.target.value })}
                      className={`${inputCls} w-24`}
                      placeholder="Cant."
                    />
                    <span className="text-xs text-muted w-8">{ing?.unit ?? ""}</span>
                    <button onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} className="text-red-600 text-lg leading-none px-1" aria-label="Quitar">
                      ×
                    </button>
                  </div>
                );
              })}
              <button onClick={() => setLines((prev) => [...prev, { ingredientId: "", quantity: "" }])} className="text-ember underline text-sm">
                + Agregar insumo
              </button>
              {ingredients.length === 0 && (
                <p className="text-xs text-muted">Primero da de alta tus insumos en la pestaña &quot;Insumos&quot;.</p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Costo por porción</span>
            <span className="font-mono font-medium">{lines.length === 0 ? "—" : formatMxn(liveCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Food Cost %</span>
            <span className={`font-mono font-medium ${fcColor(lines.length === 0 ? null : liveFoodCost)}`}>
              {lines.length === 0 || liveFoodCost === null ? "—" : `${liveFoodCost.toFixed(1)}%`}
            </span>
          </div>
          {lines.length === 0 && !loading && (
            <p className="text-xs text-muted">Sin insumos, el producto conserva el costo que ya tenía capturado.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-md border border-line py-2.5 text-sm">
              Cancelar
            </button>
            <button onClick={save} disabled={saving || loading} className="flex-1 rounded-md bg-ember text-white py-2.5 text-sm font-medium disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar receta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
