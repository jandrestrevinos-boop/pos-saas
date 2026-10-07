"use client";

import type { ReactNode } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Card } from "@/components/ui";
import { formatMxn } from "@/lib/format";

export type AvanzadoData = {
  topProducts: { name: string; quantity: number; revenue: number; cost: number; profit: number }[];
  byCategory: { name: string; revenue: number; cost: number; profit: number }[];
  byUser: { name: string; total: number; count: number }[];
  contributionMargin: { name: string; marginTotal: number; marginPercent: number }[];
  dailyDetail: { date: string; total: number; profit: number; orders: number; previousTotal: number }[];
};

const axisTick = { fontSize: 12, fill: "#64748B" };
const gridStyle = { stroke: "#E2E8F0" };
const tooltipStyle = { borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 };
const moneyTick = (v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`;

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">{title}</p>
      <Card className="p-5">
        <ResponsiveContainer width="100%" height={240}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export function DashboardAvanzadoCharts({ data }: { data: AvanzadoData }) {
  const dayLabel = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

  const daily = data.dailyDetail.map((d) => ({ ...d, label: dayLabel(d.date) }));
  const profitByCategory = data.byCategory.map((c) => ({ name: c.name, profit: c.profit }));
  const foodCostByCategory = data.byCategory.map((c) => ({
    name: c.name,
    pct: c.revenue > 0 ? Number(((c.cost / c.revenue) * 100).toFixed(1)) : 0,
  }));
  const topByProfit = [...data.topProducts].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const marginPct = [...data.contributionMargin]
    .map((p) => ({ name: p.name, pct: Number(p.marginPercent.toFixed(1)) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);
  const ticketByUser = data.byUser.map((u) => ({
    name: u.name,
    ticket: u.count > 0 ? u.total / u.count : 0,
  }));

  return (
    <div className="space-y-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Análisis avanzado</p>

      <ChartCard title="Ventas vs. periodo anterior">
        <LineChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} interval={2} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
          <Tooltip formatter={(v: number) => formatMxn(v)} contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="total" name="Este periodo" stroke="#0038FF" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="previousTotal" name="Periodo anterior" stroke="#94A3B8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ChartCard>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Utilidad diaria">
          <LineChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} interval={2} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
            <Tooltip formatter={(v: number) => [formatMxn(v), "Utilidad"]} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="profit" stroke="#3F7D20" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Número de ventas por día">
          <BarChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} interval={2} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={(v: number) => [v, "Ventas"]} contentStyle={tooltipStyle} />
            <Bar dataKey="orders" fill="#7C3AED" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Utilidad por categoría">
          <BarChart data={profitByCategory} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" {...gridStyle} horizontal={false} />
            <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
            <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={90} />
            <Tooltip formatter={(v: number) => [formatMxn(v), "Utilidad"]} contentStyle={tooltipStyle} />
            <Bar dataKey="profit" fill="#3F7D20" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Food cost % por categoría">
          <BarChart data={foodCostByCategory} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" {...gridStyle} horizontal={false} />
            <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={90} />
            <Tooltip formatter={(v: number) => [`${v}%`, "Food cost"]} contentStyle={tooltipStyle} />
            <Bar dataKey="pct" fill="#E8562C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top 5 productos por utilidad">
          <BarChart data={topByProfit} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
            <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
            <Tooltip formatter={(v: number) => [formatMxn(v), "Utilidad"]} contentStyle={tooltipStyle} />
            <Bar dataKey="profit" fill="#3F7D20" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Margen % por producto">
          <BarChart data={marginPct} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
            <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: number) => [`${v}%`, "Margen"]} contentStyle={tooltipStyle} />
            <Bar dataKey="pct" fill="#00B4D8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Ticket promedio por cajero">
          <BarChart data={ticketByUser} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
            <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
            <Tooltip formatter={(v: number) => [formatMxn(v), "Ticket promedio"]} contentStyle={tooltipStyle} />
            <Bar dataKey="ticket" fill="#F0A93B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
