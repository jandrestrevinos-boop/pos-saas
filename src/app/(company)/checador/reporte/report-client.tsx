"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { ALERT_LABELS, formatMinutes } from "@/lib/attendance";

type Emp = { id: string; code: number; name: string };
type Branch = { id: string; name: string };
type Row = {
  employeeId: string;
  code: number;
  name: string;
  position: string | null;
  branch: string;
  isActive: boolean;
  totalMinutes: number;
  daysWorked: number;
  lates: number;
  absences: number;
  overtimeMinutes: number;
  alerts: string[];
  chainOk: boolean;
};
type Rec = {
  id: string;
  kind: "IN" | "OUT";
  source: "KIOSK" | "MANUAL";
  punchedAt: string;
  photoUrl: string | null;
  note: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  employee: { name: string; code: number };
  branch: { name: string };
};

export function ReportClient({
  employees,
  branches,
  timezone,
  defaultFrom,
  defaultTo,
  today,
}: {
  employees: Emp[];
  branches: Branch[];
  timezone: string;
  defaultFrom: string;
  defaultTo: string;
  today: string;
}) {
  const [tab, setTab] = useState<"summary" | "records">("summary");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<Rec | null>(null);
  const [voiding, setVoiding] = useState<Rec | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ employeeId: "", kind: "IN", date: today, time: "09:00", note: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const query = useCallback(() => {
    const p = new URLSearchParams({ from, to });
    if (employeeId) p.set("employeeId", employeeId);
    if (branchId) p.set("branchId", branchId);
    return p.toString();
  }, [from, to, employeeId, branchId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r1, r2] = await Promise.all([fetch(`/api/attendance/report?${query()}`), fetch(`/api/attendance/records?${query()}`)]);
      const d1 = await r1.json().catch(() => ({}));
      const d2 = await r2.json().catch(() => ({}));
      if (!r1.ok) throw new Error(d1.error ?? "No se pudo cargar el reporte");
      if (!r2.ok) throw new Error(d2.error ?? "No se pudieron cargar los registros");
      setRows(d1.rows);
      setRecords(d2.records);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
    // Solo al abrir la pantalla; después se usa el botón "Aplicar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat("es-MX", { timeZone: timezone, day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat("es-MX", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));

  async function submitVoid() {
    if (!voiding) return;
    setBusy(true);
    setFormError("");
    const res = await fetch(`/api/attendance/records/${voiding.id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: voidReason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setFormError(data.error ?? "No se pudo anular");
    setVoiding(null);
    setVoidReason("");
    load();
  }

  async function submitManual() {
    setBusy(true);
    setFormError("");
    const res = await fetch("/api/attendance/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manual),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setFormError(data.error ?? "No se pudo guardar");
    setManualOpen(false);
    setManual({ ...manual, note: "" });
    load();
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <Field label="Del">
            <input type="date" className={inputClass} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Al">
            <input type="date" className={inputClass} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Empleado">
            <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Todos</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} · {e.name}
                </option>
              ))}
            </select>
          </Field>
          {branches.length > 1 ? (
            <Field label="Sucursal">
              <select className={inputClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Todas</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div />
          )}
          <div className="mb-4">
            <Button onClick={load} disabled={loading} className="w-full">
              {loading ? "Cargando..." : "Aplicar"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a className="rounded-md border border-line bg-white px-3 py-2 font-medium hover:bg-paper" href={`/api/attendance/export?type=summary&${query()}`}>
            ⬇ Resumen para nómina (CSV)
          </a>
          <a className="rounded-md border border-line bg-white px-3 py-2 font-medium hover:bg-paper" href={`/api/attendance/export?type=records&${query()}`}>
            ⬇ Registro completo para la autoridad (CSV)
          </a>
        </div>
      </Card>

      {error && <p className="text-sm text-ember-dark">{error}</p>}

      <div className="flex gap-2 border-b border-line">
        {(["summary", "records"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t ? "border-ember text-ink" : "border-transparent text-muted"}`}
          >
            {t === "summary" ? "Resumen" : `Registros (${records.length})`}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">No hay empleados para mostrar con estos filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <Card className="overflow-hidden min-w-[760px]">
                <table className="w-full text-sm">
                  <thead className="bg-paper text-xs uppercase text-muted">
                    <tr>
                      <th className="text-left px-4 py-3">Empleado</th>
                      <th className="text-right px-3 py-3">Días</th>
                      <th className="text-right px-3 py-3">Horas</th>
                      <th className="text-right px-3 py-3">Retardos</th>
                      <th className="text-right px-3 py-3">Faltas</th>
                      <th className="text-right px-3 py-3">Extra (est.)</th>
                      <th className="text-left px-3 py-3">Alertas</th>
                      <th className="text-left px-3 py-3">Integridad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.employeeId} className="border-t border-line align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {r.code} · {r.name}
                            {!r.isActive && <span className="ml-2 text-xs text-muted">(inactivo)</span>}
                          </p>
                          <p className="text-xs text-muted">{r.branch}</p>
                        </td>
                        <td className="px-3 py-3 text-right">{r.daysWorked}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">{formatMinutes(r.totalMinutes)}</td>
                        <td className="px-3 py-3 text-right">{r.lates}</td>
                        <td className="px-3 py-3 text-right">{r.absences}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">{formatMinutes(r.overtimeMinutes)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.alerts.map((a) => (
                              <span key={a} className="rounded-full bg-marigold/15 px-2 py-0.5 text-xs">
                                {ALERT_LABELS[a] ?? a}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {r.chainOk ? (
                            <span className="rounded-full bg-sage-light px-2 py-0.5 text-xs text-sage">Verificada</span>
                          ) : (
                            <span className="rounded-full bg-ember/10 px-2 py-0.5 text-xs text-ember-dark">Alterada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
          <p className="text-xs text-muted mt-3 max-w-2xl">
            Las horas extra son una estimación para apoyar la nómina (se calculan contra la jornada diaria del turno y el tope semanal vigente).
            El pago final lo define el patrón conforme a la Ley Federal del Trabajo.
          </p>
        </div>
      )}

      {tab === "records" && (
        <div>
          <div className="flex justify-end mb-3">
            <Button
              variant="secondary"
              onClick={() => {
                setFormError("");
                setManualOpen(true);
              }}
              disabled={employees.length === 0}
            >
              + Agregar marca olvidada
            </Button>
          </div>
          {records.length === 0 ? (
            <p className="text-sm text-muted">No hay marcas en este periodo.</p>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <Card key={r.id} className={`p-3 flex items-center gap-3 ${r.voidedAt ? "opacity-60" : ""}`}>
                  {r.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photoUrl} alt="Foto de la marca" className="h-14 w-14 rounded-md object-cover cursor-pointer shrink-0" onClick={() => setPhoto(r)} />
                  ) : (
                    <div className="h-14 w-14 rounded-md bg-black/5 shrink-0 flex items-center justify-center text-xs text-muted text-center">
                      {r.source === "MANUAL" ? "Manual" : "Sin foto"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${r.voidedAt ? "line-through" : ""}`}>
                      {r.employee.code} · {r.employee.name}
                    </p>
                    <p className="text-sm">
                      <span className={r.kind === "IN" ? "text-sage font-medium" : "text-[#006e85] font-medium"}>{r.kind === "IN" ? "Entrada" : "Salida"}</span>
                      {" · "}
                      {fmtDate(r.punchedAt)} {fmtTime(r.punchedAt)}
                      {" · "}
                      <span className="text-muted">{r.branch.name}</span>
                    </p>
                    {r.source === "MANUAL" && <p className="text-xs text-muted">Captura manual: {r.note}</p>}
                    {r.voidedAt && <p className="text-xs text-ember-dark">Anulada: {r.voidReason}</p>}
                  </div>
                  {!r.voidedAt && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setFormError("");
                        setVoidReason("");
                        setVoiding(r);
                      }}
                    >
                      Anular
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={!!photo} onClose={() => setPhoto(null)} title={photo ? `${photo.employee.name} · ${photo.kind === "IN" ? "Entrada" : "Salida"}` : ""}>
        {photo?.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.photoUrl} alt="Foto de la marca" className="w-full rounded-md" />
        )}
        {photo && (
          <p className="text-sm text-muted mt-2">
            {fmtDate(photo.punchedAt)} {fmtTime(photo.punchedAt)}
          </p>
        )}
      </Modal>

      <Modal open={!!voiding} onClose={() => setVoiding(null)} title="Anular marca">
        <p className="text-sm text-muted mb-3">
          La marca no se borra: queda guardada como anulada con tu nombre y el motivo, y deja de contar para las horas.
        </p>
        <Field label="Motivo">
          <textarea className={inputClass} rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
        </Field>
        {formError && <p className="text-sm text-ember-dark mb-3">{formError}</p>}
        <div className="flex gap-3">
          <Button onClick={submitVoid} disabled={busy}>
            {busy ? "Guardando..." : "Anular marca"}
          </Button>
          <Button variant="secondary" onClick={() => setVoiding(null)}>
            Cancelar
          </Button>
        </div>
      </Modal>

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Agregar marca olvidada">
        <p className="text-sm text-muted mb-3">Queda registrada como captura manual, con tu nombre y el motivo.</p>
        <Field label="Empleado">
          <select className={inputClass} value={manual.employeeId} onChange={(e) => setManual({ ...manual, employeeId: e.target.value })}>
            <option value="">Elige...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} · {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select className={inputClass} value={manual.kind} onChange={(e) => setManual({ ...manual, kind: e.target.value })}>
            <option value="IN">Entrada</option>
            <option value="OUT">Salida</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input type="date" className={inputClass} value={manual.date} max={today} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
          </Field>
          <Field label="Hora">
            <input type="time" className={inputClass} value={manual.time} onChange={(e) => setManual({ ...manual, time: e.target.value })} />
          </Field>
        </div>
        <Field label="Motivo">
          <textarea className={inputClass} rows={3} value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} />
        </Field>
        {formError && <p className="text-sm text-ember-dark mb-3">{formError}</p>}
        <div className="flex gap-3">
          <Button onClick={submitManual} disabled={busy || !manual.employeeId}>
            {busy ? "Guardando..." : "Guardar marca"}
          </Button>
          <Button variant="secondary" onClick={() => setManualOpen(false)}>
            Cancelar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
