// src/app/products/page.tsx
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ErrorMessage, EmptyMessage } from "@/components/state-message";
import { getTopProducts, getSlowMovingProducts, ApiError } from "@/lib/api";
import { formatNumber, formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TopProductsChart } from "@/components/charts/top-products-chart";
import type { SourceFolder } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ source_folder?: SourceFolder }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const { source_folder } = await searchParams;
  const filter = source_folder ? { source_folder } : undefined;

  return (
    <>
      <PageHeader
        title="Products"
        description="Top sellers and slow-moving inventory"
      />
      <div className="space-y-6">
        <Suspense fallback={<ChartSkeleton />}>
          <TopProductsSection filter={filter} />
        </Suspense>
        <Suspense fallback={<TableSkeleton />}>
          <SlowMovingSection filter={filter} />
        </Suspense>
      </div>
    </>
  );
}

async function TopProductsSection({
  filter,
}: {
  filter?: { source_folder?: SourceFolder };
}) {
  try {
    const res = await getTopProducts({ ...filter, limit: 10 });
    const products = res.data;

    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium mb-4">Top 10 Products by Revenue</h3>
        {products.length === 0 ? (
          <EmptyMessage />
        ) : (
          <TopProductsChart data={products} />
        )}
      </div>
    );
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Unknown error";
    return <ErrorMessage message={message} />;
  }
}

async function SlowMovingSection({
  filter,
}: {
  filter?: { source_folder?: SourceFolder };
}) {
  try {
    const res = await getSlowMovingProducts({ ...filter, limit: 20 });
    const products = res.data;

    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium mb-4">
          Slow Moving Products{" "}
          <span className="text-muted-foreground font-normal">
            (no sales in 90+ days)
          </span>
        </h3>
        {products.length === 0 ? (
          <EmptyMessage message="Everything is moving well — no slow stock!" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Opening Qty</TableHead>
                <TableHead>Last Sold</TableHead>
                <TableHead className="text-right">Days Idle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={`${p.source_folder}-${p.item_code}`}>
                  <TableCell>
                    <div className="font-medium">{p.item_description || p.item_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.item_code} · {p.source_folder}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(p.opening_qty)}
                  </TableCell>
                  <TableCell>{formatDate(p.last_sold_date)}</TableCell>
                  <TableCell className="text-right">
                    {p.days_since_last_sale !== null ? (
                      <Badge variant="outline">{p.days_since_last_sale}d</Badge>
                    ) : (
                      <Badge variant="secondary">Never sold</Badge>
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

function ChartSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-6 animate-pulse">
      <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
      <div className="h-72 bg-slate-200 rounded" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-6 animate-pulse">
      <div className="h-4 w-64 bg-slate-200 rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 bg-slate-200 rounded" />
        ))}
      </div>
    </div>
  );
}
