// src/components/charts/top-products-chart.tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TopProduct } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: TopProduct[];
}

export function TopProductsChart({ data }: Props) {
  const chartData = data.slice(0, 10).map((p) => ({
    name:
      (p.item_description || p.item_code).length > 18
        ? (p.item_description || p.item_code).slice(0, 18) + "…"
        : p.item_description || p.item_code,
    revenue: parseFloat(p.total_revenue || "0"),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
          tickFormatter={(value) =>
            value >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : `₹${value}`
          }
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 13,
          }}
        />
        <Bar dataKey="revenue" fill="#0f172a" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
