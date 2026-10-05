"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { ExportButton } from "@/components/export-button";

type Product = {
  id: string;
  name: string;
  stock: number; // existencia en la sucursal activa
  totalStock: number;
  minStock: number;
  category: { name: string };
  otherBranches: { branchId: string; branchName: string; stock: number }[];
};
type Movement = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: { name: string };
  user: { name: string };
  branch: { name: string };
};
type BranchOption = { id: string; name: string };

const TYPE_LABELS: Record<string, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste", WASTE: "Merma" };

export function InventoryClient({
  branches,
  activeBranchId,
  canTransfer,
}: {
  branches: BranchOption[];
  activeBranchId: string;
  canTransfer: boolean;
}) {
  const multiBranch = branches.length > 1;
  const [transferOpen, setTransferOpen] = useState(false);
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
      <div className="flex justify-end gap-2 mb-4">
        <ExportButton dataset={multiBranch ? "stock" : "products"} label="Exportar existencias (CSV)" />
        <ExportButton dataset="movements" label="Exportar movimientos (CSV)" />
        {multiBranch && canTransfer && (
          <Button variant="secondary" onClick={() => setTransferOpen(true)}>
            ⇄ Transferir entre sucursales
          </Button>
        )}
        <Button onClick={() => setModalOpen(true)}>+ Registrar movimiento</Button>
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
        Existencias actuales{multiBranch ? ` — ${branches.find((b) => b.id === activeBranchId)?.name ?? "esta sucursal"}` : ""}
      </p>
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
                <th className="px-5 py-3 font-medium">Mínimo</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                {multiBranch && <th className="px-5 py-3 font-medium">Otras sucursales</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-muted">{p.category.name}</td>
                  <td className={`px-5 py-3 font-mono ${p.stock <= 0 ? "text-ember-dark" : ""}`}>{p.stock}</td>
                  <td className="px-5 py-3 font-mono text-muted">{p.minStock > 0 ? p.minStock : "—"}</td>
                  <td className="px-5 py-3 text-xs font-medium">
                    {p.stock <= 0 ? (
                      <span className="text-ember-dark">Agotado</span>
                    ) : p.minStock > 0 && p.stock <= p.minStock ? (
                      <span className="text-marigold-dark">Stock bajo</span>
                    ) : (
                      <span className="text-sage">OK</span>
                    )}
                  </td>
                  {multiBranch && (
                    <td className="px-5 py-3 text-xs text-muted">
                      {p.otherBranches.map((o) => `${o.branchName}: ${o.stock}`).join(" · ")}
                    </td>
                  )}
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
                {multiBranch && <th className="px-5 py-3 font-medium">Sucursal</th>}
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
                  {multiBranch && <td className="px-5 py-3 text-muted">{m.branch.name}</td>}
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

      {transferOpen && (
        <TransferModal
          products={products}
          branches={branches}
          activeBranchId={activeBranchId}
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            load();
          }}
        />
      )}

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

function TransferModal({
  products,
  branches,
  activeBranchId,
  onClose,
  onDone,
}: {
  products: Product[];
  branches: BranchOption[];
  activeBranchId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [fromBranchId, setFromBranchId] = useState(activeBranchId);
  const [toBranchId, setToBranchId] = useState(branches.find((b) => b.id !== activeBranchId)?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const product = products.find((p) => p.id === productId);
  function stockIn(branchId: string): number {
    if (!product) return 0;
    if (branchId === activeBranchId) return product.stock;
    return product.otherBranches.find((o) => o.branchId === branchId)?.stock ?? 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/inventory/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, fromBranchId, toBranchId, quantity: parseInt(quantity, 10) || 0, note }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo hacer la transferencia");
      return;
    }
    onDone();
  }

  if (products.length === 0) {
    return (
      <Modal open onClose={onClose} title="Transferir entre sucursales">
        <p className="text-sm text-muted">No tienes productos con control de inventario activado.</p>
        <div className="flex justify-end mt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Transferir entre sucursales">
      <form onSubmit={handleSubmit}>
        <Field label="Producto">
          <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (total en la empresa: {p.totalStock})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sale de">
          <select className={inputClass} value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (tiene {stockIn(b.id)})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Llega a">
          <select className={inputClass} value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
            {branches
              .filter((b) => b.id !== fromBranchId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (tiene {stockIn(b.id)})
                </option>
              ))}
          </select>
        </Field>
        <Field label="Cantidad">
          <input required type="number" min={1} step="1" className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Nota (opcional)">
          <input className={inputClass} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Reabasto semanal" />
        </Field>
        {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !toBranchId || fromBranchId === toBranchId}>
            {saving ? "Transfiriendo..." : "Transferir"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
