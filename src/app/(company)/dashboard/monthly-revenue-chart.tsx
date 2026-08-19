"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui";
import { formatMxn } from "@/lib/format";

type MonthData = { key: string; label: string; total: number };

export function MonthlyRevenueChart() {
  const [months, setMonths] = useState<MonthData[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/monthly-revenue")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMonths(data?.months ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!months) return null; // no es Admin Empresa, o falló silenciosamente

  return (
    <div className="mb-10">
      <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
        Ingresos por mes · visible solo para ti como Admin
      </p>
      <Card className="p-5">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7E1D6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6B6459" }} axisLine={{ stroke: "#E7E1D6" }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 12, fill: "#6B6459" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
            />
            <Tooltip
              formatter={(value: number) => [formatMxn(value), "Ingresos"]}
              contentStyle={{ borderRadius: 8, border: "1px solid #E7E1D6", fontSize: 13 }}
            />
            <Bar dataKey="total" fill="#E8562C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}