"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";

type Category = { id: string; name: string; _count: { products: number } };

export function CategoriesTable({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Ocurrió un error");
      return;
    }

    setCategories((prev) => [...prev, { ...data.category, _count: { products: 0 } }]);
    setModalOpen(false);
    setName("");
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta categoría? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } else {
      const data = await res.json();
      alert(data.error ?? "No se pudo eliminar");
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>+ Nueva categoría</Button>
      </div>

      {categories.length === 0 ? (
        <Card className="p-10 text-center text-muted text-sm">
          Todavía no tienes categorías. Crea la primera para empezar a organizar tu menú.
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map((c) => (
            <Card key={c.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted font-mono">{c._count.products} productos</p>
              </div>
              <button onClick={() => handleDelete(c.id)} className="text-muted hover:text-ember-dark text-sm">
                Eliminar
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva categoría">
        <form onSubmit={handleCreate}>
          <Field label="Nombre">
            <input
              required
              autoFocus
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bebidas, Tacos, Postres..."
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
    </>
  );
}
