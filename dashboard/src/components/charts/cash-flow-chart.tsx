// src/components/charts/cash-flow-chart.tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CashFlow } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";

interface Props {
  data: CashFlow[];
}

export function CashFlowChart({ data }: Props) {
  const chartData = data.map((d) => ({
    date: formatDate(d.voucher_date),
    debit: parseFloat(d.total_debit || "0"),
    credit: parseFloat(d.total_credit || "0"),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#64748b" }}
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
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 13,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="debit" name="Debit" fill="#dc2626" radius={[4, 4, 0, 0]} />
        <Bar dataKey="credit" name="Credit" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
