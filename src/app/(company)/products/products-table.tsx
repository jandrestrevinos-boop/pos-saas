"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { formatMxn } from "@/lib/format";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  price: string;
  cost: string | null;
  sku: string | null;
  isActive: boolean;
  category: { name: string };
  categoryId: string;
};

function marginPercent(price: string, cost: string | null): string {
  if (!cost || Number(cost) === 0) return "—";
  const p = Number(price);
  const c = Number(cost);
  if (p === 0) return "—";
  const margin = ((p - c) / p) * 100;
  return `${margin.toFixed(0)}%`;
}

export function ProductsTable({
  initialProducts,
  categories,
}: {
  initialProducts: Product[];
  categories: Category[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", categoryId: categories[0]?.id ?? "", price: "", cost: "", sku: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      let data: { error?: string; product?: unknown } = {};
      try {
        data = await res.json();
      } catch {
        setError("El servidor no respondió correctamente. Intenta de nuevo.");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Ocurrió un error");
        return;
      }

      const category = categories.find((c) => c.id === form.categoryId)!;
      setProducts((prev) => [{ ...(data.product as Product), category }, ...prev]);
      setModalOpen(false);
      setForm({ name: "", categoryId: categories[0]?.id ?? "", price: "", cost: "", sku: "" });
    } catch {
      setError("No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    const res = await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (res.ok) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: !x.isActive } : x)));
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>+ Nuevo producto</Button>
      </div>

      <Card className="overflow-hidden">
        {products.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">
            Todavía no tienes productos. Agrega el primero con el botón de arriba.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Precio</th>
                <th className="px-5 py-3 font-medium">Costo</th>
                <th className="px-5 py-3 font-medium">Margen</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-muted">{p.category.name}</td>
                  <td className="px-5 py-3 font-mono">{formatMxn(p.price)}</td>
                  <td className="px-5 py-3 font-mono text-muted">{p.cost ? formatMxn(p.cost) : "—"}</td>
                  <td className="px-5 py-3 font-mono">{marginPercent(p.price, p.cost)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.isActive ? "active" : "inactive"} label={p.isActive ? "Activo" : "Inactivo"} />
                  </td>
                  <td className="px-5 py-3 text-right space-x-1">
                    <Button variant="ghost" onClick={() => setEditing(p)}>
                      Editar
                    </Button>
                    <Button variant="ghost" onClick={() => toggleActive(p)}>
                      {p.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo producto">
        <form onSubmit={handleCreate}>
          <Field label="Nombre">
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Taco Pastor"
            />
          </Field>
          <Field label="Categoría">
            <select
              className={inputClass}
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio de venta (MXN)">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="18.00"
              />
            </Field>
            <Field label="Costo (MXN, opcional)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="8.00"
              />
            </Field>
          </div>
          <Field label="SKU (opcional)">
            <input
              className={inputClass}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </Field>

          {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EditProductModal
          product={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function EditProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product;
  categories: Category[];
  onClose: () => void;
  onSaved: (p: Product) => void;
}) {
  const [form, setForm] = useState({
    name: product.name,
    categoryId: product.categoryId,
    price: product.price,
    cost: product.cost ?? "",
    sku: product.sku ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      let data: { error?: string; product?: unknown } = {};
      try {
        data = await res.json();
      } catch {
        setError("El servidor no respondió correctamente. Intenta de nuevo.");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }

      const category = categories.find((c) => c.id === form.categoryId)!;
      onSaved({ ...(data.product as Product), category });
    } catch {
      setError("No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Editar ${product.name}`}>
      <form onSubmit={handleSubmit}>
        <Field label="Nombre">
          <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Categoría">
          <select className={inputClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio de venta (MXN)">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </Field>
          <Field label="Costo (MXN)">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              placeholder="8.00"
            />
          </Field>
        </div>
        <Field label="SKU (opcional)">
          <input className={inputClass} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </Field>

        {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}