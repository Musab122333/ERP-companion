// src/app/finance/page.tsx
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, EmptyMessage } from "@/components/state-message";
import { getCashFlow, getTransactions, ApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import type { SourceFolder } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ source_folder?: SourceFolder }>;
}

export default async function FinancePage({ searchParams }: PageProps) {
  const { source_folder } = await searchParams;
  const filter = source_folder ? { source_folder } : undefined;

  return (
    <>
      <PageHeader
        title="Finance"
        description="Cash flow and recent ledger transactions"
      />
      <div className="space-y-6">
        <Suspense fallback={<ChartSkeleton />}>
          <CashFlowSection filter={filter} />
        </Suspense>
        <Suspense fallback={<TableSkeleton />}>
          <TransactionsSection filter={filter} />
        </Suspense>
      </div>
    </>
  );
}

async function CashFlowSection({
  filter,
}: {
  filter?: { source_folder?: SourceFolder };
}) {
  try {
    const res = await getCashFlow(filter);
    // Most recent 30 entries, oldest first for chart readability
    const data = [...res.data].slice(0, 30).reverse();

    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium mb-4">Cash Flow — Debit vs Credit</h3>
        {data.length === 0 ? <EmptyMessage /> : <CashFlowChart data={data} />}
      </div>
    );
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Unknown error";
    return <ErrorMessage message={message} />;
  }
}

async function TransactionsSection({
  filter,
}: {
  filter?: { source_folder?: SourceFolder };
}) {
  try {
    const res = await getTransactions({ ...filter, limit: 25 });
    const transactions = res.data;

    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium mb-4">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <EmptyMessage />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher</TableHead>
                <TableHead>Ledger</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.fact_finance_key}>
                  <TableCell>
                    <div className="font-medium">{t.voucher_no || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(t.voucher_date)}
                    </div>
                  </TableCell>
                  <TableCell>{t.customer_name || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {t.narration || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.debit_credit === "D" ? (
                      <Badge variant="destructive">Debit</Badge>
                    ) : t.debit_credit === "C" ? (
                      <Badge className="bg-emerald-600">Credit</Badge>
                    ) : (
                      <Badge variant="secondary">—</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(t.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Unknown error";
    return <ErrorMessage message={message} />;
  }
}

function ChartSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-6 animate-pulse">
      <div className="h-4 w-56 bg-slate-200 rounded mb-4" />
      <div className="h-72 bg-slate-200 rounded" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-6 animate-pulse">
      <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 bg-slate-200 rounded" />
        ))}
      </div>
    </div>
  );
}
