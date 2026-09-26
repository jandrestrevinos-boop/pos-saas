"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";

type Role = { id: string; name: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: { name: string };
  branch: { name: string } | null;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN_EMPRESA: "Administrador",
  GERENTE: "Gerente",
  CAJERO: "Cajero",
  MESERO: "Mesero",
  COCINERO: "Cocinero",
};

export function UsersTable({ initialUsers, roles }: { initialUsers: UserRow[]; roles: Role[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: roles[0]?.id ?? "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Ocurrió un error");
      return;
    }

    setUsers((prev) => [...prev, data.user]);
    setModalOpen(false);
    setForm({ name: "", email: "", password: "", roleId: roles[0]?.id ?? "" });
  }

  async function toggleActive(u: UserRow) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: !x.isActive } : x)));
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>+ Nuevo usuario</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Correo</th>
              <th className="px-5 py-3 font-medium">Rol</th>
              <th className="px-5 py-3 font-medium">Sucursal</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-5 py-3 text-muted font-mono text-xs">{u.email}</td>
                <td className="px-5 py-3 text-xs">{ROLE_LABELS[u.role.name] ?? u.role.name}</td>
                <td className="px-5 py-3 text-muted">{u.branch?.name ?? "—"}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={u.isActive ? "active" : "inactive"} label={u.isActive ? "Activo" : "Inactivo"} />
                </td>
                <td className="px-5 py-3 text-right">
                  <Button variant="ghost" onClick={() => toggleActive(u)}>
                    {u.isActive ? "Desactivar" : "Activar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo usuario">
        <form onSubmit={handleCreate}>
          <Field label="Nombre">
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Juan Pérez"
            />
          </Field>
          <Field label="Correo">
            <input
              required
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="juan@turestaurante.com"
            />
          </Field>
          <Field label="Contraseña temporal">
            <input
              required
              type="text"
              minLength={8}
              className={inputClass}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 8 caracteres"
            />
          </Field>
          <Field label="Rol">
            <select
              className={inputClass}
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {ROLE_LABELS[r.name] ?? r.name}
                </option>
              ))}
            </select>
          </Field>

          {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear usuario"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
