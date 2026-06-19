// src/app/inventory/page.tsx
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, EmptyMessage } from "@/components/state-message";
import { getInventoryItems, ApiError } from "@/lib/api";
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

export default async function InventoryPage({ searchParams }: PageProps) {
  const { source_folder } = await searchParams;
  const filter = source_folder ? { source_folder } : undefined;

  return (
    <>
      <PageHeader title="Inventory" description="Item master and stock levels" />
      <Suspense fallback={<TableSkeleton />}>
        <InventoryTable filter={filter} />
      </Suspense>
    </>
  );
}

async function InventoryTable({
  filter,
}: {
  filter?: { source_folder?: SourceFolder };
}) {
  try {
    const res = await getInventoryItems({ ...filter, limit: 100 });
    const items = res.data;

    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium mb-4">
          Item Master{" "}
          <span className="text-muted-foreground font-normal">
            ({formatNumber(items.length)} items shown)
          </span>
        </h3>
        {items.length === 0 ? (
          <EmptyMessage />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="text-right">Opening Qty</TableHead>
                <TableHead className="text-right">Opening Value</TableHead>
                <TableHead className="text-center">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={`${item.source_folder}-${item.item_code}`}>
                  <TableCell>
                    <div className="font-medium">
                      {item.item_description || item.item_code}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.item_code} · {item.source_folder}
                    </div>
                  </TableCell>
                  <TableCell>{item.uom || "—"}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.opening_qty)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.opening_value)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.is_service ? (
                      <Badge variant="outline">Service</Badge>
                    ) : (
                      <Badge variant="secondary">Goods</Badge>
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

function TableSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-6 animate-pulse">
      <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-slate-200 rounded" />
        ))}
      </div>
    </div>
  );
}
