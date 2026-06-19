// src/components/charts/monthly-sales-chart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlySales } from "@/lib/types";
import { formatCurrency, formatMonth } from "@/lib/format";

interface Props {
  data: MonthlySales[];
}

export function MonthlySalesChart({ data }: Props) {
  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    total_sales: parseFloat(d.total_sales || "0"),
    invoice_count: d.invoice_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) =>
            value >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : `₹${value}`
          }
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelStyle={{ color: "#0f172a", fontWeight: 600 }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 13,
          }}
        />
        <Line
          type="monotone"
          dataKey="total_sales"
          stroke="#0f172a"
          strokeWidth={2}
          dot={{ r: 3, fill: "#0f172a" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
