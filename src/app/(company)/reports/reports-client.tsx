"use client";

import { useEffect, useState } from "react";
import { Card, StatCard } from "@/components/ui";
import { formatMxn } from "@/lib/format";

type Report = {
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  itemsWithoutCost: number;
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  byPaymentMethod: Record<string, number>;
  topProducts: { name: string; quantity: number; revenue: number }[];
  byCategory: { name: string; revenue: number }[];
  byUser: { name: string; total: number; count: number }[];
};

const PAYMENT_LABELS: Record<string, string> = { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", OTHER: "Otro" };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsClient() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/reports/sales?from=${from}&to=${to}`);
    if (res.ok) setReport(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-8">
        <label className="block">
          <span className="block text-xs font-medium text-muted mb-1">Desde</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted mb-1">Hasta</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm" />
        </label>
        <button onClick={load} className="rounded-md bg-ember text-white px-4 py-2 text-sm font-medium">
          Aplicar
        </button>
        <div className="flex gap-2 ml-2">
          <button onClick={() => setPreset(1)} className="text-xs text-muted hover:text-ink underline">
            Hoy
          </button>
          <button onClick={() => setPreset(7)} className="text-xs text-muted hover:text-ink underline">
            7 días
          </button>
          <button onClick={() => setPreset(30)} className="text-xs text-muted hover:text-ink underline">
            30 días
          </button>
        </div>
      </div>

      {loading || !report ? (
        <p className="text-sm text-muted">Cargando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Utilidad real" value={formatMxn(report.totalProfit)} sublabel={`${report.profitMargin.toFixed(0)}% de margen`} />
            <StatCard label="Costo total" value={formatMxn(report.totalCost)} sublabel={report.itemsWithoutCost > 0 ? `${report.itemsWithoutCost} productos sin costo capturado` : undefined} />
            <StatCard label="Ventas totales" value={formatMxn(report.totalSales)} />
            <StatCard label="Número de ventas" value={report.totalOrders} />
            <StatCard label="Ticket promedio" value={formatMxn(report.avgTicket)} />
            <StatCard label="Efectivo" value={formatMxn(report.byPaymentMethod.CASH ?? 0)} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Por método de pago</p>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(report.byPaymentMethod).map(([method, amount]) => (
                      <tr key={method} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">{PAYMENT_LABELS[method] ?? method}</td>
                        <td className="px-5 py-3 text-right font-mono">{formatMxn(amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Por categoría</p>
              <Card className="overflow-hidden">
                {report.byCategory.length === 0 ? (
                  <p className="text-sm text-muted p-5">Sin ventas en este rango.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {report.byCategory.map((c) => (
                        <tr key={c.name} className="border-b border-line last:border-0">
                          <td className="px-5 py-3">{c.name}</td>
                          <td className="px-5 py-3 text-right font-mono">{formatMxn(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Productos más vendidos</p>
          <Card className="overflow-hidden mb-8">
            {report.topProducts.length === 0 ? (
              <p className="text-sm text-muted p-5">Sin ventas en este rango.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-medium">Producto</th>
                    <th className="px-5 py-3 font-medium">Cantidad vendida</th>
                    <th className="px-5 py-3 font-medium">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p) => (
                    <tr key={p.name} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium">{p.name}</td>
                      <td className="px-5 py-3 font-mono">{p.quantity}</td>
                      <td className="px-5 py-3 font-mono">{formatMxn(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Por usuario</p>
          <Card className="overflow-hidden">
            {report.byUser.length === 0 ? (
              <p className="text-sm text-muted p-5">Sin ventas en este rango.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-medium">Usuario</th>
                    <th className="px-5 py-3 font-medium">Ventas</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byUser.map((u) => (
                    <tr key={u.name} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium">{u.name}</td>
                      <td className="px-5 py-3 font-mono">{u.count}</td>
                      <td className="px-5 py-3 font-mono">{formatMxn(u.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
