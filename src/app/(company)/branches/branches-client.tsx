"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, StatusBadge } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";

type Branch = { id: string; name: string; address: string | null; isActive: boolean; _count: { users: number } };

export function BranchesClient({
  initialBranches,
  limit,
  activeBranchId,
}: {
  initialBranches: Branch[];
  limit: number | null;
  activeBranchId: string | null;
}) {
  const router = useRouter();
  const [branches, setBranches] = useState(initialBranches);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; branch: Branch } | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");

  const activeCount = branches.filter((b) => b.isActive).length;
  const atLimit = limit !== null && activeCount >= limit;

  function openCreate() {
    setName("");
    setAddress("");
    setError("");
    setModal({ mode: "create" });
  }

  function openEdit(branch: Branch) {
    setName(branch.name);
    setAddress(branch.address ?? "");
    setError("");
    setModal({ mode: "edit", branch });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    setError("");

    const isEdit = modal.mode === "edit";
    const res = await fetch(isEdit ? `/api/branches/${modal.branch.id}` : "/api/branches", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }

    if (isEdit) {
      setBranches((prev) => prev.map((b) => (b.id === data.branch.id ? { ...b, ...data.branch } : b)));
    } else {
      setBranches((prev) => [...prev, { ...data.branch, _count: { users: 0 } }]);
    }
    setModal(null);
    router.refresh(); // actualiza el selector de sucursal del menú
  }

  async function toggleActive(branch: Branch) {
    setPageError("");
    const res = await fetch(`/api/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !branch.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPageError(data.error ?? "No se pudo actualizar");
      return;
    }
    setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, ...data.branch } : b)));
    router.refresh();
  }

  async function switchTo(branch: Branch) {
    setPageError("");
    const res = await fetch("/api/branches/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: branch.id }),
    });
    if (!res.ok) {
      const data = await res.json();
      setPageError(data.error ?? "No se pudo cambiar de sucursal");
      return;
    }
    window.location.reload();
  }

  return (
    <>
      <div className="flex items-center justify-end gap-3 mb-4">
        {atLimit && (
          <p className="text-xs text-muted">
            Llegaste al límite de sucursales de tu plan{limit === 1 ? ". El plan Empresarial permite varias." : "."}
          </p>
        )}
        <Button onClick={openCreate} disabled={atLimit}>
          + Nueva sucursal
        </Button>
      </div>

      {pageError && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{pageError}</p>}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Sucursal</th>
              <th className="px-5 py-3 font-medium">Dirección</th>
              <th className="px-5 py-3 font-medium">Usuarios</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-medium">
                  {b.name}
                  {b.id === activeBranchId && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-sage/15 text-sage">
                      Operando aquí
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-muted">{b.address ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{b._count.users}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={b.isActive ? "active" : "inactive"} label={b.isActive ? "Activa" : "Inactiva"} />
                </td>
                <td className="px-5 py-3 text-right space-x-1 whitespace-nowrap">
                  {b.isActive && b.id !== activeBranchId && branches.filter((x) => x.isActive).length > 1 && (
                    <Button variant="ghost" onClick={() => switchTo(b)}>
                      Operar en esta
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => openEdit(b)}>
                    Editar
                  </Button>
                  <Button variant="ghost" onClick={() => toggleActive(b)}>
                    {b.isActive ? "Desactivar" : "Activar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Editar sucursal" : "Nueva sucursal"}
      >
        <form onSubmit={save}>
          <Field label="Nombre de la sucursal">
            <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sucursal Centro" />
          </Field>
          <Field label="Dirección (opcional)">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Juárez 123, Monterrey" />
          </Field>
          {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
