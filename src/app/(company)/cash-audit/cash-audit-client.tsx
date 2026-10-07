"use client";

import { useEffect, useState, Fragment } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Card, StatCard } from "@/components/ui";
import { formatMxn } from "@/lib/format";

type Movement = { id: string; type: string; amount: number; reason: string | null; user: string; createdAt: string };
type Register = {
  id: string;
  branchName: string;
  openedAt: string;
  closedAt: string | null;
  status: "OPEN" | "CLOSED";
  openedBy: string | null;
  closedBy: string | null;
  openingCash: number;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
  cashIn: number;
  cashOut: number;
  movements: Movement[];
};
type AuditData = {
  summary: { closedCount: number; openCount: number; withDifferenceCount: number; totalShortage: number; totalOverage: number };
  byCashier: { name: string; shifts: number; difference: number }[];
  registers: Register[];
  branches: { id: string; name: string }[];
};

const MOVEMENT_LABELS: Record<string, string> = {
  SALE: "Venta",
  CASH_IN: "Entrada de efectivo",
  CASH_OUT: "Salida de efectivo",
  REFUND: "Devolución",
};

const SHORT_COLOR = "#E8562C";
const OVER_COLOR = "#3F7D20";
const axisTick = { fontSize: 12, fill: "#64748B" };
const tooltipStyle = { borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 };

const fmtDate = (iso: string) => new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

function Difference({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  if (Math.abs(value) < 0.01) return <span className="font-mono">Cuadra</span>;
  const short = value < 0;
  return (
    <span className="font-mono font-medium" style={{ color: short ? SHORT_COLOR : OVER_COLOR }}>
      {short ? "Faltan " : "Sobran "}
      {formatMxn(Math.abs(value))}
    </span>
  );
}

export function CashAuditClient() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return dayStr(d);
  });
  const [to, setTo] = useState(() => dayStr(new Date()));
  const [branchId, setBranchId] = useState("");
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ from, to });
    if (branchId) params.set("branchId", branchId);
    fetch(`/api/cash/audit?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "No se pudo cargar la auditoría de cajas");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la auditoría de cajas"))
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm" />
        </div>
        {data && data.branches.length > 1 && (
          <div>
            <label className="block text-xs text-muted mb-1">Sucursal</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm">
              <option value="">Todas</option>
              {data.branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2">{error}</p>}
      {loading && !data && <p className="text-muted text-sm">Cargando...</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Turnos cerrados" value={String(data.summary.closedCount)} sublabel={data.summary.openCount > 0 ? `${data.summary.openCount} abierto(s) ahora` : undefined} />
            <StatCard tone="marigold" label="Con diferencia" value={String(data.summary.withDifferenceCount)} sublabel="Faltante o sobrante" />
            <StatCard tone="ember" label="Total faltante" value={formatMxn(Math.abs(data.summary.totalShortage))} />
            <StatCard tone="sage" label="Total sobrante" value={formatMxn(data.summary.totalOverage)} />
          </div>

          {data.byCashier.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Diferencia acumulada por cajero (quien cerró el turno)</p>
              <Card className="p-5">
                <ResponsiveContainer width="100%" height={Math.max(160, data.byCashier.length * 48)}>
                  <BarChart data={data.byCashier} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => formatMxn(v)} />
                    <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={110} />
                    <Tooltip
                      formatter={(v: number) => [formatMxn(v), v < 0 ? "Faltante" : "Sobrante"]}
                      contentStyle={tooltipStyle}
                    />
                    <ReferenceLine x={0} stroke="#94A3B8" />
                    <Bar dataKey="difference" radius={[4, 4, 4, 4]}>
                      {data.byCashier.map((c) => (
                        <Cell key={c.name} fill={c.difference < 0 ? SHORT_COLOR : OVER_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {data.registers.length === 0 ? (
            <p className="text-muted text-sm">No hay turnos de caja en este rango.</p>
          ) : (
            <Card className="ticket-edge overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-xs uppercase text-muted">
                  <tr>
                    <th className="text-left px-4 py-3">Turno</th>
                    <th className="text-left px-4 py-3">Abrió</th>
                    <th className="text-left px-4 py-3">Cerró</th>
                    <th className="text-right px-4 py-3">Inicial</th>
                    <th className="text-right px-4 py-3">Esperado</th>
                    <th className="text-right px-4 py-3">Contado</th>
                    <th className="text-right px-4 py-3">Diferencia</th>
                    <th className="text-right px-4 py-3">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {data.registers.map((r) => (
                    <Fragment key={r.id}>
                      <tr className="border-t border-line cursor-pointer hover:bg-paper" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium">{fmtDate(r.openedAt)}</p>
                          <p className="text-xs text-muted">
                            {r.branchName} · {r.closedAt ? `cerró ${fmtDate(r.closedAt)}` : "abierta"}
                          </p>
                        </td>
                        <td className="px-4 py-3">{r.openedBy ?? <span className="text-muted">—</span>}</td>
                        <td className="px-4 py-3">{r.closedBy ?? <span className="text-muted">—</span>}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatMxn(r.openingCash)}</td>
                        <td className="px-4 py-3 text-right font-mono">{r.expectedCash === null ? "—" : formatMxn(r.expectedCash)}</td>
                        <td className="px-4 py-3 text-right font-mono">{r.countedCash === null ? "—" : formatMxn(r.countedCash)}</td>
                        <td className="px-4 py-3 text-right"><Difference value={r.difference} /></td>
                        <td className="px-4 py-3 text-right text-xs text-muted">{expanded === r.id ? "Ocultar" : "Ver detalle"}</td>
                      </tr>
                      {expanded === r.id && (
                        <tr className="border-t border-line bg-paper">
                          <td colSpan={8} className="px-4 py-3">
                            <p className="text-xs text-muted mb-2">
                              Entradas {formatMxn(r.cashIn)} · Salidas y devoluciones {formatMxn(r.cashOut)}
                            </p>
                            {r.movements.length === 0 ? (
                              <p className="text-xs text-muted">Sin movimientos de efectivo en este turno.</p>
                            ) : (
                              <ul className="space-y-1 text-xs">
                                {r.movements.map((m) => (
                                  <li key={m.id} className="flex flex-wrap gap-x-3">
                                    <span className="text-muted">{fmtDate(m.createdAt)}</span>
                                    <span className="font-medium">{MOVEMENT_LABELS[m.type] ?? m.type}</span>
                                    <span className="font-mono">{formatMxn(m.amount)}</span>
                                    <span>{m.user}</span>
                                    {m.reason && <span className="text-muted">{m.reason}</span>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
