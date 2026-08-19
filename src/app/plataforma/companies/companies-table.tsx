"use client";

import { useEffect, useState } from "react";
import { Button, Card, StatusBadge } from "@/components/ui";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { formatMxn } from "@/lib/format";

type Plan = { id: string; name: string; priceMxn: string };
type Role = { id: string; name: string };
type Company = {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  branches: { id: string }[];
  users: { id: string }[];
  subscription: { plan: { name: string } } | null;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN_EMPRESA: "Admin Empresa",
  GERENTE: "Gerente",
  CAJERO: "Cajero",
  MESERO: "Mesero",
};

export function CompaniesTable({ initialCompanies, plans, roles }: { initialCompanies: Company[]; plans: Plan[]; roles: Role[] }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [modalOpen, setModalOpen] = useState(false);
  const [usersCompany, setUsersCompany] = useState<Company | null>(null);
  const [planCompany, setPlanCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", branchName: "Principal", planId: plans[0]?.id ?? "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/companies", {
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

    setCompanies((prev) => [
      { ...data.company, branches: [{ id: "new" }], users: [], subscription: { plan: { name: plans.find((p) => p.id === form.planId)?.name ?? "" } } },
      ...prev,
    ]);
    setModalOpen(false);
    setForm({ name: "", branchName: "Principal", planId: plans[0]?.id ?? "" });
  }

  async function toggleStatus(company: Company) {
    const newStatus = company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, status: newStatus } : c)));
    }
  }

  async function deleteCompany(company: Company) {
    const confirmed = confirm(
      `¿Eliminar "${company.name}" por completo? Esto borra todos sus usuarios, productos, ventas e historial. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
    if (res.ok) {
      setCompanies((prev) => prev.filter((c) => c.id !== company.id));
    } else {
      const data = await res.json();
      alert(data.error ?? "No se pudo eliminar la empresa");
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>+ Crear empresa</Button>
      </div>

      <Card className="overflow-hidden">
        {companies.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">
            Todavía no hay empresas registradas. Crea la primera con el botón de arriba.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Sucursales</th>
                <th className="px-5 py-3 font-medium">Usuarios</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-muted">
                    <button onClick={() => setPlanCompany(c)} className="underline decoration-dotted hover:text-ink">
                      {c.subscription?.plan.name ?? "—"}
                    </button>
                  </td>
                  <td className="px-5 py-3 font-mono">{c.branches.length}</td>
                  <td className="px-5 py-3 font-mono">{c.users.length}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={c.status} label={c.status === "ACTIVE" ? "Activa" : "Suspendida"} />
                  </td>
                  <td className="px-5 py-3 text-right space-x-1">
                    <Button variant="ghost" onClick={() => setUsersCompany(c)}>
                      Usuarios
                    </Button>
                    <Button variant="ghost" onClick={() => toggleStatus(c)}>
                      {c.status === "ACTIVE" ? "Suspender" : "Activar"}
                    </Button>
                    <Button variant="ghost" onClick={() => deleteCompany(c)} className="text-ember-dark hover:bg-ember/10">
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Crear empresa">
        <form onSubmit={handleCreate}>
          <Field label="Nombre del restaurante">
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Café Luna"
            />
          </Field>
          <Field label="Nombre de la primera sucursal">
            <input
              required
              className={inputClass}
              value={form.branchName}
              onChange={(e) => setForm({ ...form, branchName: e.target.value })}
            />
          </Field>
          <Field label="Plan">
            <select
              className={inputClass}
              value={form.planId}
              onChange={(e) => setForm({ ...form, planId: e.target.value })}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ${p.priceMxn} MXN/mes
                </option>
              ))}
            </select>
          </Field>

          {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear empresa"}
            </Button>
          </div>
        </form>
      </Modal>

      {usersCompany && (
        <CompanyUsersModal
          company={usersCompany}
          roles={roles}
          onClose={() => setUsersCompany(null)}
          onUserCreated={() =>
            setCompanies((prev) =>
              prev.map((c) => (c.id === usersCompany.id ? { ...c, users: [...c.users, { id: "new" }] } : c))
            )
          }
        />
      )}
      {planCompany && (
        <ChangePlanModal
          company={planCompany}
          plans={plans}
          onClose={() => setPlanCompany(null)}
          onChanged={(planName) => {
            setCompanies((prev) =>
              prev.map((c) => (c.id === planCompany.id ? { ...c, subscription: { plan: { name: planName } } } : c))
            );
            setPlanCompany(null);
          }}
        />
      )}
    </>
  );
}

function ChangePlanModal({
  company,
  plans,
  onClose,
  onChanged,
}: {
  company: Company;
  plans: Plan[];
  onClose: () => void;
  onChanged: (planName: string) => void;
}) {
  const currentPlanName = company.subscription?.plan.name;
  const [planId, setPlanId] = useState(plans.find((p) => p.name === currentPlanName)?.id ?? plans[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/companies/${company.id}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo cambiar el plan");
      return;
    }
    const newPlan = plans.find((p) => p.id === planId);
    onChanged(newPlan?.name ?? "");
  }

  return (
    <Modal open onClose={onClose} title={`Cambiar plan de ${company.name}`}>
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-muted mb-4">
          Plan actual: <span className="font-medium text-ink">{currentPlanName ?? "Sin plan"}</span>
        </p>
        <Field label="Nuevo plan">
          <select className={inputClass} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatMxn(p.priceMxn)}/mes
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Cambiando..." : "Cambiar plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CompanyUsersModal({
  company,
  roles,
  onClose,
  onUserCreated,
}: {
  company: Company;
  roles: Role[];
  onClose: () => void;
  onUserCreated: () => void;
}) {
  type CompanyUser = { id: string; name: string; email: string; isActive: boolean; role: { name: string } };
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: roles.find((r) => r.name === "ADMIN_EMPRESA")?.id ?? roles[0]?.id ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/companies/${company.id}/users`);
    if (res.ok) setUsers((await res.json()).users);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/companies/${company.id}/users`, {
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
    setShowCreate(false);
    setForm({ name: "", email: "", password: "", roleId: form.roleId });
    onUserCreated();
    load();
  }

  async function handleDeleteUser(user: CompanyUser) {
    const confirmed = confirm(`¿Eliminar a ${user.name} (${user.email})? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    const res = await fetch(`/api/companies/${company.id}/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      const data = await res.json();
      alert(data.error ?? "No se pudo eliminar el usuario");
    }
  }

  return (
    <Modal open onClose={onClose} title={`Usuarios de ${company.name}`}>
      {loading ? (
        <p className="text-sm text-muted">Cargando...</p>
      ) : (
        <>
          {users.length === 0 ? (
            <p className="text-sm text-muted mb-4">Esta empresa todavía no tiene ningún usuario — nadie puede iniciar sesión ahí.</p>
          ) : (
            <ul className="mb-4 space-y-2 max-h-52 overflow-y-auto">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between text-sm border-b border-line pb-2">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-muted font-mono text-xs">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted">{ROLE_LABELS[u.role.name] ?? u.role.name}</span>
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="text-xs text-ember-dark hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!showCreate ? (
            <Button onClick={() => setShowCreate(true)} className="w-full">
              + Crear usuario
            </Button>
          ) : (
            <form onSubmit={handleCreate}>
              <Field label="Nombre">
                <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Correo">
                <input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Contraseña temporal">
                <input required minLength={8} className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
              </Field>
              <Field label="Rol">
                <select className={inputClass} value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {ROLE_LABELS[r.name] ?? r.name}
                    </option>
                  ))}
                </select>
              </Field>
              {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Creando..." : "Crear usuario"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}