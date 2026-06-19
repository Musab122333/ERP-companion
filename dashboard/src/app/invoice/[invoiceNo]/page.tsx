// src/app/invoice/[invoiceNo]/page.tsx
import { Suspense } from "react";
import { ErrorMessage } from "@/components/state-message";
import { getInvoice, ApiError } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SourceFolder } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ invoiceNo: string }>;
  searchParams: Promise<{ source_folder?: SourceFolder }>;
}

export default async function InvoicePage({ params, searchParams }: PageProps) {
  const { invoiceNo } = await params;
  const { source_folder } = await searchParams;
  const filter = source_folder ? { source_folder } : undefined;

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight mb-6">
        Invoice #{invoiceNo}
      </h2>
      <Suspense fallback={<InvoiceSkeleton />}>
        <InvoiceContent invoiceNo={invoiceNo} filter={filter} />
      </Suspense>
    </div>
  );
}

async function InvoiceContent({
  invoiceNo,
  filter,
}: {
  invoiceNo: string;
  filter?: { source_folder?: SourceFolder };
}) {
  try {
    const { header, lines } = await getInvoice(invoiceNo, filter);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Invoice Date" value={formatDate(header.invoice_date)} />
          <SummaryCard label="Bill Amount" value={formatCurrency(header.bill_amount)} />
          <SummaryCard label="Tax Amount" value={formatCurrency(header.tax_amount)} />
          <SummaryCard
            label="Total Amount"
            value={formatCurrency(header.total_amount)}
          />
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium mb-4">
            Line Items{" "}
            <span className="text-muted-foreground font-normal">
              ({formatNumber(lines.length)} items)
            </span>
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.fact_sales_key}>
                  <TableCell className="font-medium">
                    {line.item_description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(line.quantity)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(line.rate)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(line.discount_amt)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(line.line_amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {header.transport && (
          <div className="text-sm text-muted-foreground">
            Transport: {header.transport}
            {header.due_days !== null && ` · Due in ${header.due_days} days`}
          </div>
        )}
      </div>
    );
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Unknown error";
    return <ErrorMessage message={message} />;
  }
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function InvoiceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-slate-200" />
    </div>
  );
}
