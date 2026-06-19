// src/lib/api.ts
// Typed client for the Phase 4 FastAPI backend.
// Set NEXT_PUBLIC_API_URL in .env.local to point at your API
// (defaults to localhost:8000 for local development).

import type {
  ApiResponse,
  CompanyOverview,
  TodaySales,
  MonthlySales,
  TopCustomer,
  OutstandingReceivable,
  CustomerLTV,
  TopProduct,
  SlowMovingProduct,
  CashFlow,
  Transaction,
  InvoiceDetail,
  DimProduct,
  SourceFolder,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    throw new ApiError(
      "Could not reach the API. Is the FastAPI backend running?",
      0
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }

  return res.json();
}

export interface FolderFilter {
  source_folder?: SourceFolder;
}

// ── Dashboard ──────────────────────────────────────────────────────────
export const getOverview = (f?: FolderFilter) =>
  apiGet<ApiResponse<CompanyOverview>>("/dashboard/overview", f);

export const getTodaySales = (f?: FolderFilter) =>
  apiGet<ApiResponse<TodaySales>>("/dashboard/today-sales", f);

export const getMonthlySales = (f?: FolderFilter & { limit?: number }) =>
  apiGet<ApiResponse<MonthlySales>>("/dashboard/monthly-sales", f);

// ── Customers ──────────────────────────────────────────────────────────
export const getTopCustomers = (f?: FolderFilter & { limit?: number }) =>
  apiGet<ApiResponse<TopCustomer>>("/customers/top", f);

export const getReceivables = (f?: FolderFilter & { limit?: number }) =>
  apiGet<ApiResponse<OutstandingReceivable>>("/customers/receivables", f);

export const getCustomerLTV = (f?: FolderFilter & { limit?: number }) =>
  apiGet<ApiResponse<CustomerLTV>>("/customers/ltv", f);

// ── Products ───────────────────────────────────────────────────────────
export const getTopProducts = (f?: FolderFilter & { limit?: number }) =>
  apiGet<ApiResponse<TopProduct>>("/products/top", f);

export const getSlowMovingProducts = (f?: FolderFilter & { limit?: number }) =>
  apiGet<ApiResponse<SlowMovingProduct>>("/products/slow-moving", f);

export const getInventoryItems = (
  f?: FolderFilter & { item_group?: string; limit?: number }
) => apiGet<ApiResponse<DimProduct>>("/inventory/items", f);

// ── Finance ────────────────────────────────────────────────────────────
export const getCashFlow = (f?: FolderFilter & { start_date?: string; end_date?: string }) =>
  apiGet<ApiResponse<CashFlow>>("/finance/cash-flow", f);

export const getTransactions = (
  f?: FolderFilter & { ledger_code?: string; limit?: number }
) => apiGet<ApiResponse<Transaction>>("/finance/transactions", f);

// ── Sales drill-down ───────────────────────────────────────────────────
export const getInvoice = (invoiceNo: string, f?: FolderFilter) =>
  apiGet<InvoiceDetail>(`/sales/invoice/${encodeURIComponent(invoiceNo)}`, f);

// ── Health ─────────────────────────────────────────────────────────────
export const checkHealth = () =>
  apiGet<{ status: string; database: string }>("/health");

export { ApiError };
