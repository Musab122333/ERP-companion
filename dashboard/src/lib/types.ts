// Types mirror the warehouse views from Phase 3 / API responses from Phase 4

export type SourceFolder = "ZF2526" | "ZF2627" | "ZFN2526";

export interface CompanyOverview {
  source_folder: SourceFolder;
  total_invoices: number;
  total_revenue: string; // numeric comes back as string from psycopg2 JSON
  active_customers: number;
  total_receivables: string | null;
}

export interface TodaySales {
  source_folder: SourceFolder;
  invoice_count: number;
  total_sales: string;
}

export interface MonthlySales {
  source_folder: SourceFolder;
  month: string; // ISO date string, first of month
  invoice_count: number;
  total_sales: string;
}

export interface TopCustomer {
  source_folder: SourceFolder;
  ledger_code: string;
  customer_name: string | null;
  invoice_count: number;
  total_purchases: string;
  outstanding_balance: string | null;
  last_purchase_date: string | null;
}

export interface OutstandingReceivable {
  source_folder: SourceFolder;
  ledger_code: string;
  customer_name: string | null;
  outstanding_amount: string;
  credit_limit: string | null;
  over_credit_limit: boolean;
}

export interface CustomerLTV {
  source_folder: SourceFolder;
  ledger_code: string;
  customer_name: string | null;
  first_purchase: string | null;
  last_purchase: string | null;
  total_orders: number;
  lifetime_value: string;
  avg_order_value: string;
}

export interface TopProduct {
  source_folder: SourceFolder;
  item_code: string;
  item_description: string | null;
  item_group: string | null;
  total_qty_sold: string;
  total_revenue: string;
  times_ordered: number;
}

export interface SlowMovingProduct {
  source_folder: SourceFolder;
  item_code: string;
  item_description: string | null;
  opening_qty: string | null;
  last_sold_date: string | null;
  days_since_last_sale: number | null;
}

export interface CashFlow {
  source_folder: SourceFolder;
  voucher_date: string;
  total_debit: string;
  total_credit: string;
  net_movement: string;
}

export interface Transaction {
  fact_finance_key: number;
  source_folder: SourceFolder;
  voucher_no: string | null;
  voucher_date: string | null;
  ledger_key: number | null;
  narration: string | null;
  debit_credit: string | null;
  amount: string | null;
  rep_code: string | null;
  customer_name: string | null;
}

export interface InvoiceHeader {
  fact_header_key: number;
  source_folder: SourceFolder;
  invoice_no: string;
  invoice_date: string | null;
  invoice_type: string | null;
  customer_key: number | null;
  bill_amount: string | null;
  tax_amount: string | null;
  round_off: string | null;
  total_amount: string | null;
  transport: string | null;
  due_days: number | null;
}

export interface InvoiceLine {
  fact_sales_key: number;
  source_folder: SourceFolder;
  invoice_no: string;
  invoice_date: string | null;
  invoice_type: string | null;
  customer_key: number | null;
  product_key: number | null;
  item_description: string | null;
  rep_code: string | null;
  quantity: string | null;
  rate: string | null;
  discount_pct: string | null;
  discount_amt: string | null;
  line_amount: string | null;
  batch_no: string | null;
}

export interface InvoiceDetail {
  header: InvoiceHeader;
  lines: InvoiceLine[];
}

export interface DimProduct {
  product_key: number;
  source_folder: SourceFolder;
  item_code: string;
  item_description: string | null;
  item_group: string | null;
  uom: string | null;
  hsn_code: string | null;
  valuation_method: string | null;
  standard_rate: string | null;
  opening_qty: string | null;
  opening_value: string | null;
  is_service: boolean;
}

export interface ApiResponse<T> {
  data: T[];
}
