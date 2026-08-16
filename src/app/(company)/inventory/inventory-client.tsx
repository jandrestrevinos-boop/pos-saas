"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";

type Product = { id: string; name: string; stock: number; category: { name: string } };
type Movement = { id: string; type: string; quantity: number; reason: string | null; createdAt: string; product: { name: string }; user: { name: string } };

const TYPE_LABELS: Record<string, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste", WASTE: "Merma" };

export function InventoryClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/inventory");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
      setMovements(data.movements);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>+ Registrar movimiento</Button>
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Existencias actuales</p>
      <Card className="overflow-hidden mb-8">
        {products.length === 0 ? (
          <p className="text-sm text-muted p-5">
            Ningún producto controla inventario todavía. Actívalo al crear o editar un producto.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Existencia</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-muted">{p.category.name}</td>
                  <td className={`px-5 py-3 font-mono ${p.stock <= 0 ? "text-ember-dark" : ""}`}>{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Movimientos recientes</p>
      <Card className="overflow-hidden">
        {movements.length === 0 ? (
          <p className="text-sm text-muted p-5">Sin movimientos todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Cantidad</th>
                <th className="px-5 py-3 font-medium">Motivo</th>
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{m.product.name}</td>
                  <td className="px-5 py-3">{TYPE_LABELS[m.type] ?? m.type}</td>
                  <td className="px-5 py-3 font-mono">{m.quantity}</td>
                  <td className="px-5 py-3 text-muted">{m.reason ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{m.user.name}</td>
                  <td className="px-5 py-3 text-muted text-xs">
                    {new Date(m.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modalOpen && (
        <MovementModal
          products={products}
          onClose={() => setModalOpen(false)}
          onDone={() => {
            setModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function MovementModal({ products, onClose, onDone }: { products: Product[]; onClose: () => void; onDone: () => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [type, setType] = useState<"IN" | "OUT" | "ADJUSTMENT" | "WASTE">("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, type, quantity: parseInt(quantity, 10) || 0, reason }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo registrar el movimiento");
      return;
    }
    onDone();
  }

  if (products.length === 0) {
    return (
      <Modal open onClose={onClose} title="Registrar movimiento">
        <p className="text-sm text-muted">
          No tienes productos con control de inventario activado. Ve a Productos y actívalo en el que quieras controlar.
        </p>
        <div className="flex justify-end mt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Registrar movimiento">
      <form onSubmit={handleSubmit}>
        <Field label="Producto">
          <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (existencia: {p.stock})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo de movimiento">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="IN">Entrada</option>
            <option value="OUT">Salida</option>
            <option value="ADJUSTMENT">Ajuste (puede ser negativo)</option>
            <option value="WASTE">Merma</option>
          </select>
        </Field>
        <Field label="Cantidad">
          <input
            required
            type="number"
            step="1"
            autoFocus
            className={inputClass}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={type === "ADJUSTMENT" ? "Puede ser negativo, ej. -3" : "0"}
          />
        </Field>
        <Field label="Motivo (opcional)">
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compra a proveedor, producto caducado, etc." />
        </Field>

        {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
