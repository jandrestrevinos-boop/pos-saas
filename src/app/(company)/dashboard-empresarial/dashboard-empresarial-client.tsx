"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Card, StatCard } from "@/components/ui";
import { formatMxn } from "@/lib/format";

type DashboardData = {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  foodCostPercent: number;
  byPaymentMethod: Record<string, number>;
  topProducts: { name: string; quantity: number; revenue: number; cost: number; profit: number }[];
  byCategory: { name: string; revenue: number; cost: number; profit: number }[];
  byUser: { name: string; total: number; count: number }[];
  contributionMargin: { name: string; marginTotal: number; marginPercent: number }[];
  dailyTrend: { date: string; total: number }[];
  hourly: number[];
  weekdayTotals: number[];
  days: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
  MERCADOPAGO: "Mercado Pago (link/QR)",
  MERCADOPAGO_TERMINAL: "Mercado Pago (terminal)",
};

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const CHART_COLORS = ["#0038FF", "#00B4D8", "#3F7D20", "#F0A93B", "#E8562C", "#7C3AED"];

const axisTick = { fontSize: 12, fill: "#64748B" };
const gridStyle = { stroke: "#E2E8F0" };
const tooltipStyle = { borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 };

export function DashboardEmpresarialClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard-empresarial?days=30")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el dashboard");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted text-sm">Cargando...</p>;
  if (error) return <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2">{error}</p>;
  if (!data) return null;

  const dailyChartData = data.dailyTrend.map((d) => ({
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
    total: d.total,
  }));

  const hourlyChartData = data.hourly.map((total, h) => ({ label: `${h}:00`, total }));
  const weekdayChartData = data.weekdayTotals.map((total, i) => ({ label: WEEKDAY_LABELS[i].slice(0, 3), total }));
  const paymentChartData = Object.entries(data.byPaymentMethod)
    .filter(([, v]) => v > 0)
    .map(([method, total]) => ({ name: PAYMENT_LABELS[method] ?? method, value: total }));

  return (
    <div className="space-y-10">
      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tone="sage" label="Ventas (30 días)" value={formatMxn(data.totalSales)} sublabel={`${data.totalOrders} ventas`} />
        <StatCard tone="ember" label="Utilidad real" value={formatMxn(data.totalProfit)} sublabel={`${data.profitMargin.toFixed(1)}% de margen`} />
        <StatCard tone="marigold" label="Food Cost %" value={`${data.foodCostPercent.toFixed(1)}%`} sublabel="Costo ÷ ventas" />
        <StatCard label="Ticket promedio" value={formatMxn(data.avgTicket)} />
      </div>

      {/* Ventas últimos 30 días */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Ventas de los últimos {data.days} días</p>
        <Card className="p-5">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} interval={2} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <Tooltip formatter={(v: number) => [formatMxn(v), "Ventas"]} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="total" stroke="#0038FF" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ventas por categoría */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Ventas por categoría</p>
          <Card className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.byCategory} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" {...gridStyle} horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={(v: number) => [formatMxn(v), "Ventas"]} contentStyle={tooltipStyle} />
                <Bar dataKey="revenue" fill="#00B4D8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Ventas por método de pago */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Ventas por método de pago</p>
          <Card className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={paymentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => entry.name}>
                  {paymentChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMxn(v)} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Top 5 productos */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Top 5 productos más vendidos</p>
          <Card className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.topProducts.slice(0, 5)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number, key) => [key === "quantity" ? v : formatMxn(v), key === "quantity" ? "Cantidad" : "Ventas"]} contentStyle={tooltipStyle} />
                <Bar dataKey="quantity" fill="#3F7D20" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Rendimiento por cajero */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Rendimiento por cajero</p>
          <Card className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.byUser} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <Tooltip formatter={(v: number) => [formatMxn(v), "Ventas"]} contentStyle={tooltipStyle} />
                <Bar dataKey="total" fill="#F0A93B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Ventas por hora del día */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Ventas por hora del día</p>
          <Card className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourlyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
                <XAxis dataKey="label" tick={{ ...axisTick, fontSize: 10 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} interval={2} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <Tooltip formatter={(v: number) => [formatMxn(v), "Ventas"]} contentStyle={tooltipStyle} />
                <Bar dataKey="total" fill="#0038FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Ventas por día de la semana */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Ventas por día de la semana</p>
          <Card className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekdayChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <Tooltip formatter={(v: number) => [formatMxn(v), "Ventas"]} contentStyle={tooltipStyle} />
                <Bar dataKey="total" fill="#00B4D8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Utilidad vs costo */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Utilidad vs. costo del periodo</p>
        <Card className="p-5">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={[{ name: "Periodo", Costo: data.totalCost, Utilidad: data.totalProfit }]}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip formatter={(v: number) => formatMxn(v)} contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="Costo" stackId="a" fill="#E8562C" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Utilidad" stackId="a" fill="#3F7D20" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Margen de contribución por producto */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">Margen de contribución por producto</p>
        <Card className="ticket-edge overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper text-xs uppercase text-muted">
              <tr>
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-right px-4 py-3">Margen total</th>
                <th className="text-right px-4 py-3">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {data.contributionMargin.map((p) => (
                <tr key={p.name} className="border-t border-line">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMxn(p.marginTotal)}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.marginPercent.toFixed(1)}%</td>
                </tr>
              ))}
              {data.contributionMargin.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-muted text-center">Sin datos en este periodo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
