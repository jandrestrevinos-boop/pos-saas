"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui";

type PlanCount = { name: string; count: number };

export function CompaniesByPlanChart({ data }: { data: PlanCount[] }) {
  return (
    <Card className="p-5">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E1D6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6B6459" }} axisLine={{ stroke: "#E7E1D6" }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#6B6459" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            formatter={(value: number) => [value, "Empresas"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #E7E1D6", fontSize: 13 }}
          />
          <Bar dataKey="count" fill="#E8562C" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}