// src/app/customers/page.tsx
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, EmptyMessage } from "@/components/state-message";
import { getTopCustomers, getReceivables, ApiError } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SourceFolder } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ source_folder?: SourceFolder }>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const { source_folder } = await searchParams;
  const filter = source_folder ? { source_folder } : undefined;

  return (
    <>
      <PageHeader
        title="Customers"
        description="Rankings, purchase history, and outstanding balances"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<TableSkeleton title="Top Customers" />}>
          <TopCustomersSection filter={filter} />
        </Suspense>
        <Suspense fallback={<TableSkeleton title="Outstanding Receivables" />}>
          <ReceivablesSection filter={filter} />
        </Suspense>
      </div>
    </>
  );
}

async function TopCustomersSection({
  filter,
}: {
  filter?: { source_folder?: SourceFolder };
}) {
  try {
    const res = await getTopCustomers({ ...filter, limit: 15 });
    const customers = res.data;

    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium mb-4">Top Customers by Purchase Value</h3>
        {customers.length === 0 ? (
          <EmptyMessage />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Purchases</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={`${c.source_folder}-${c.ledger_code}`}>
                  <TableCell>
                    <div className="font-medium">{c.customer_name || c.ledger_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.ledger_code} · {c.source_folder}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(c.invoice_count)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(c.total_purchases)}
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

async function ReceivablesSection({
  filter,
}: {
  filter?: { source_folder?: SourceFolder };
}) {
  try {
    const res = await getReceivables({ ...filter, limit: 15 });
    const receivables = res.data;

    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium mb-4">Outstanding Receivables</h3>
        {receivables.length === 0 ? (
          <EmptyMessage message="No outstanding balances — all clear!" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.map((r) => (
                <TableRow key={`${r.source_folder}-${r.ledger_code}`}>
                  <TableCell>
                    <div className="font-medium">{r.customer_name || r.ledger_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.ledger_code} · {r.source_folder}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(r.outstanding_amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.over_credit_limit ? (
                      <Badge variant="destructive">Over Limit</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
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

function TableSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-lg border bg-white p-6 animate-pulse">
      <h3 className="text-sm font-medium mb-4">{title}</h3>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 bg-slate-200 rounded" />
        ))}
      </div>
    </div>
  );
}
