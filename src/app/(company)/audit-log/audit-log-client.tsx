"use client";

import { useEffect, useState, Fragment } from "react";
import { Card } from "@/components/ui";

type LogRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: string;
  user: { name: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  SALE: "Venta registrada",
  SALE_CANCEL: "Venta cancelada",
  TABLE_CLOSE: "Cuenta de mesa cobrada",
  CASH_OPEN: "Apertura de caja",
  CASH_CLOSE: "Cierre de caja",
  PRODUCT_PRICE_UPDATE: "Precio de producto editado",
  PLAN_CUSTOMIZED: "Plan personalizado para una empresa",
  PLAN_CHANGED_NO_EFFECT: "Cambio de plan (sin efecto)",
  PARTIAL_ABONO: "Abono parcial a financiamiento",
  EARLY_PAYOFF: "Liquidación anticipada",
  RESTRUCTURED: "Financiamiento reestructurado",
  PAYMENT_REGISTERED_MANUALLY: "Pago registrado manualmente",
  PAYMENT_MARKED_OVERDUE: "Pago marcado como vencido",
  CREATE: "Creación",
  UPDATE: "Edición",
  CANCEL: "Cancelación",
};

const ENTITY_LABELS: Record<string, string> = {
  Order: "Venta",
  CashRegister: "Caja",
  Product: "Producto",
  Company: "Empresa",
  User: "Usuario",
  HardwareFinancing: "Financiamiento",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function AuditLogClient() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayStr());
  const [action, setAction] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (action) params.set("action", action);
    fetch(`/api/audit-log?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs ?? []);
        setActions(data.actions ?? []);
      })
      .finally(() => setLoading(false));
  }, [from, to, action]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-muted mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Tipo de acción</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm">
            <option value="">Todas</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Cargando...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted text-sm">No hay registros en este rango.</p>
      ) : (
        <Card className="ticket-edge overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper text-xs uppercase text-muted">
              <tr>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Acción</th>
                <th className="text-left px-4 py-3">Sobre</th>
                <th className="text-left px-4 py-3">Usuario</th>
                <th className="text-right px-4 py-3">​</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr
                    className="border-t border-line cursor-pointer hover:bg-paper"
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3 font-medium">{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td className="px-4 py-3 text-muted">{ENTITY_LABELS[log.entity] ?? log.entity}</td>
                    <td className="px-4 py-3">{log.user?.name ?? "Sistema"}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted">
                      {(log.previousData || log.newData) && (expanded === log.id ? "Ocultar" : "Ver detalle")}
                    </td>
                  </tr>
                  {expanded === log.id && (log.previousData || log.newData) && (
                    <tr className="border-t border-line bg-paper">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {log.previousData && (
                            <div>
                              <p className="font-medium text-muted mb-1">Antes</p>
                              {Object.entries(log.previousData).map(([k, v]) => (
                                <p key={k}>
                                  <span className="text-muted">{k}:</span> {formatValue(v)}
                                </p>
                              ))}
                            </div>
                          )}
                          {log.newData && (
                            <div>
                              <p className="font-medium text-muted mb-1">Después</p>
                              {Object.entries(log.newData).map(([k, v]) => (
                                <p key={k}>
                                  <span className="text-muted">{k}:</span> {formatValue(v)}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
