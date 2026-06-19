// src/app/page.tsx
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ErrorMessage, EmptyMessage } from "@/components/state-message";
import { getOverview, getMonthlySales, getTodaySales, ApiError } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import { MonthlySalesChart } from "@/components/charts/monthly-sales-chart";
import { DollarSign, Receipt, Users, AlertCircle } from "lucide-react";
import type { SourceFolder } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ source_folder?: SourceFolder }>;
}

export default async function OverviewPage({ searchParams }: PageProps) {
  const { source_folder } = await searchParams;
  const filter = source_folder ? { source_folder } : undefined;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Company-wide performance at a glance"
      />
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent filter={filter} />
      </Suspense>
    </>
  );
}

async function OverviewContent({
  filter,
}: {
  filter?: { source_folder?: SourceFolder };
}) {
  try {
    const [overviewRes, todayRes, monthlyRes] = await Promise.all([
      getOverview(filter),
      getTodaySales(filter),
      getMonthlySales({ ...filter, limit: 12 }),
    ]);

    const overview = overviewRes.data;
    const today = todayRes.data;
    const monthly = [...monthlyRes.data].reverse(); // oldest first for chart

    if (overview.length === 0) {
      return <EmptyMessage message="No sales data found for this company yet" />;
    }

    // Aggregate across companies if "All" is selected
    const totalRevenue = overview.reduce((sum, o) => sum + parseFloat(o.total_revenue || "0"), 0);
    const totalInvoices = overview.reduce((sum, o) => sum + o.total_invoices, 0);
    const totalCustomers = overview.reduce((sum, o) => sum + o.active_customers, 0);
    const totalReceivables = overview.reduce(
      (sum, o) => sum + parseFloat(o.total_receivables || "0"),
      0
    );
    const todaySalesTotal = today.reduce((sum, t) => sum + parseFloat(t.total_sales || "0"), 0);
    const todayInvoiceCount = today.reduce((sum, t) => sum + t.invoice_count, 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            icon={DollarSign}
            subtitle={`${formatNumber(totalInvoices)} invoices total`}
          />
          <StatCard
            title="Today's Sales"
            value={formatCurrency(todaySalesTotal)}
            icon={Receipt}
            subtitle={`${formatNumber(todayInvoiceCount)} invoices today`}
          />
          <StatCard
            title="Active Customers"
            value={formatNumber(totalCustomers)}
            icon={Users}
          />
          <StatCard
            title="Outstanding Receivables"
            value={formatCurrency(totalReceivables)}
            icon={AlertCircle}
            subtitle="Money owed by customers"
          />
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium mb-4">Monthly Sales Trend</h3>
          {monthly.length > 0 ? (
            <MonthlySalesChart data={monthly} />
          ) : (
            <EmptyMessage message="No monthly sales data yet" />
          )}
        </div>
      </div>
    );
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Unknown error occurred";
    return <ErrorMessage message={message} />;
  }
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="h-80 rounded-lg bg-slate-200" />
    </div>
  );
}
