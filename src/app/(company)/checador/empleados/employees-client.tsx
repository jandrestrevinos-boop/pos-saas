"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, StatusBadge } from "@/components/ui";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/responsive-table";
import { TIMEZONES } from "@/lib/attendance";

type Employee = {
  id: string;
  code: number;
  name: string;
  position: string | null;
  branchId: string;
  branch: { name: string };
  shiftType: "DIURNA" | "NOCTURNA" | "MIXTA";
  shiftStart: string | null;
  workDays: string;
  isActive: boolean;
  consentAcceptedAt: string | null;
};
type Branch = { id: string; name: string };
type Settings = { timezone: string; requirePhoto: boolean; lateToleranceMinutes: number };

const DAY_LABELS = [
  { n: 1, label: "L" },
  { n: 2, label: "M" },
  { n: 3, label: "Mi" },
  { n: 4, label: "J" },
  { n: 5, label: "V" },
  { n: 6, label: "S" },
  { n: 7, label: "D" },
];
const SHIFT_LABELS = { DIURNA: "Diurno (8 h)", NOCTURNA: "Nocturno (7 h)", MIXTA: "Mixto (7.5 h)" };

type FormState = {
  id: string | null;
  code: string;
  name: string;
  position: string;
  branchId: string;
  pin: string;
  shiftType: Employee["shiftType"];
  shiftStart: string;
  workDays: number[];
  isActive: boolean;
};

export function EmployeesClient({
  initialEmployees,
  branches,
  initialSettings,
}: {
  initialEmployees: Employee[];
  branches: Branch[];
  initialSettings: Settings;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [created, setCreated] = useState<{ name: string; code: number; pin: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function openNew() {
    setError("");
    const nextCode = Math.max(0, ...initialEmployees.map((e) => e.code)) + 1;
    setForm({ id: null, code: String(nextCode), name: "", position: "", branchId: branches[0]?.id ?? "", pin: "", shiftType: "DIURNA", shiftStart: "", workDays: [1, 2, 3, 4, 5, 6], isActive: true });
  }

  function openEdit(e: Employee) {
    setError("");
    setForm({
      id: e.id,
      code: String(e.code),
      name: e.name,
      position: e.position ?? "",
      branchId: e.branchId,
      pin: "",
      shiftType: e.shiftType,
      shiftStart: e.shiftStart ?? "",
      workDays: e.workDays.split(",").map(Number).filter(Boolean),
      isActive: e.isActive,
    });
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setError("");
    const code = Number(form.code);
    if (!Number.isInteger(code) || code < 1) {
      setBusy(false);
      setError("Escribe el número de empleado (1 o mayor)");
      return;
    }
    if (!form.id && form.pin.length < 4) {
      setBusy(false);
      setError("El PIN debe tener de 4 a 6 números");
      return;
    }
    const body = {
      code,
      name: form.name,
      position: form.position || null,
      branchId: form.branchId,
      shiftType: form.shiftType,
      shiftStart: form.shiftStart || null,
      workDays: form.workDays,
      ...(form.pin ? { pin: form.pin } : {}),
      ...(form.id ? { isActive: form.isActive } : {}),
    };
    const res = await fetch(form.id ? `/api/attendance/employees/${form.id}` : "/api/attendance/employees", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }
    if (!form.id) setCreated({ name: form.name, code: data.code ?? code, pin: form.pin });
    setForm(null);
    router.refresh();
  }

  async function saveSettings() {
    setSettingsMsg("");
    const res = await fetch("/api/attendance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json().catch(() => ({}));
    setSettingsMsg(res.ok ? "Configuración guardada" : data.error ?? "No se pudo guardar");
  }

  const columns: ResponsiveColumn<Employee>[] = [
    { key: "code", header: "No. de empleado", render: (e) => <span className="font-display text-lg font-semibold">{e.code}</span>, mobile: "aside" },
    {
      key: "name",
      header: "Empleado",
      mobile: "title",
      render: (e) => (
        <div>
          <p className="font-medium">{e.name}</p>
          {e.position && <p className="text-xs text-muted">{e.position}</p>}
        </div>
      ),
    },
    { key: "branch", header: "Sucursal", render: (e) => e.branch.name },
    {
      key: "shift",
      header: "Horario",
      render: (e) => `${SHIFT_LABELS[e.shiftType]}${e.shiftStart ? ` · entra ${e.shiftStart}` : ""}`,
    },
    {
      key: "days",
      header: "Días",
      render: (e) =>
        e.workDays
          .split(",")
          .map((n) => DAY_LABELS.find((d) => d.n === Number(n))?.label)
          .filter(Boolean)
          .join(" "),
    },
    {
      key: "consent",
      header: "Aviso aceptado",
      render: (e) => (e.consentAcceptedAt ? "Sí" : <span className="text-muted">Pendiente (lo acepta al checar)</span>),
    },
    {
      key: "status",
      header: "Estado",
      render: (e) => <StatusBadge status={e.isActive ? "active" : "inactive"} label={e.isActive ? "Activo" : "Inactivo"} />,
    },
  ];

  return (
    <div className="space-y-8">
      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold mb-3">Configuración del checador</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Zona horaria">
            <select className={inputClass} value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tolerancia de retardo (minutos)">
            <input
              type="number"
              min={0}
              max={60}
              className={inputClass}
              value={settings.lateToleranceMinutes}
              onChange={(e) => setSettings({ ...settings, lateToleranceMinutes: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
            />
          </Field>
          <Field label="Foto al checar">
            <label className="flex items-center gap-2 text-sm py-2">
              <input type="checkbox" className="h-5 w-5" checked={settings.requirePhoto} onChange={(e) => setSettings({ ...settings, requirePhoto: e.target.checked })} />
              Obligatoria (recomendado)
            </label>
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={saveSettings}>Guardar configuración</Button>
          {settingsMsg && <span className="text-sm text-muted">{settingsMsg}</span>}
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Empleados</h2>
          <Button onClick={openNew} disabled={branches.length === 0}>
            + Nuevo empleado
          </Button>
        </div>
        {initialEmployees.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay empleados. Agrega el primero para que pueda checar en el quiosco.</p>
        ) : (
          <ResponsiveTable columns={columns} rows={initialEmployees} getRowId={(e) => e.id} renderActions={(e) => (
            <Button variant="secondary" onClick={() => openEdit(e)}>
              Editar
            </Button>
          )} />
        )}
      </div>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Empleado dado de alta">
        {created && (
          <div className="text-center">
            <p className="text-sm text-muted mb-4">
              Entrégale estos datos a <span className="font-medium text-ink">{created.name}</span> para que cheque en el quiosco.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-md border border-line bg-paper p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Número de empleado</p>
                <p className="font-display text-4xl font-semibold">{created.code}</p>
              </div>
              <div className="rounded-md border border-line bg-paper p-4">
                <p className="text-xs uppercase tracking-wide text-muted">PIN</p>
                <p className="font-display text-4xl font-semibold tracking-widest">{created.pin}</p>
              </div>
            </div>
            <p className="text-xs text-muted mb-4">Anótalos ahora: por seguridad el PIN no se vuelve a mostrar (si se olvida, se asigna uno nuevo en Editar).</p>
            <Button onClick={() => setCreated(null)}>Listo</Button>
          </div>
        )}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Editar empleado" : "Nuevo empleado"}>
        {form && (
          <div>
            <Field label="Número de empleado (con este número y su PIN checa en el quiosco)">
              <input
                inputMode="numeric"
                autoComplete="off"
                className={inputClass}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, "").slice(0, 6) })}
              />
            </Field>
            <Field label="Nombre completo">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Puesto (opcional)">
              <input className={inputClass} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </Field>
            {branches.length > 1 && (
              <Field label="Sucursal">
                <select className={inputClass} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={form.id ? "Nuevo PIN (déjalo vacío para no cambiarlo)" : "PIN (4 a 6 números)"}>
              <input
                inputMode="numeric"
                autoComplete="off"
                className={inputClass}
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
              />
            </Field>
            <Field label="Tipo de turno">
              <select className={inputClass} value={form.shiftType} onChange={(e) => setForm({ ...form, shiftType: e.target.value as FormState["shiftType"] })}>
                {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hora de entrada programada (para retardos, opcional)">
              <input type="time" className={inputClass} value={form.shiftStart} onChange={(e) => setForm({ ...form, shiftStart: e.target.value })} />
            </Field>
            <Field label="Días que trabaja">
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((d) => {
                  const on = form.workDays.includes(d.n);
                  return (
                    <button
                      key={d.n}
                      type="button"
                      onClick={() => setForm({ ...form, workDays: on ? form.workDays.filter((n) => n !== d.n) : [...form.workDays, d.n] })}
                      className={`h-10 w-10 rounded-md border text-sm font-medium ${on ? "border-ember bg-ember text-white" : "border-line bg-white"}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            {form.id && (
              <label className="flex items-center gap-2 text-sm mb-4">
                <input type="checkbox" className="h-5 w-5" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Empleado activo (si se desmarca ya no puede checar; su historial se conserva)
              </label>
            )}
            {error && <p className="text-sm text-ember-dark mb-3">{error}</p>}
            <div className="flex gap-3">
              <Button onClick={save} disabled={busy}>
                {busy ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
