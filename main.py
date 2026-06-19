"""
Phase 4 — FastAPI Backend
==========================
Serves the warehouse.* views built in Phase 3 as REST endpoints
for the dashboard and mobile app.

Install:
    pip install fastapi uvicorn psycopg2-binary python-dotenv

Run (development):
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Run (production-style, same machine):
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2

Docs:
    Once running, open http://localhost:8000/docs for interactive
    Swagger UI — test every endpoint directly from the browser.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import date
import logging

from database import fetch_all, fetch_one, init_pool, close_pool

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("api")

app = FastAPI(
    title="ERP Analytics API",
    description="Real-time analytics layer over the legacy ERP data warehouse",
    version="1.0.0",
)

# CORS — open for now since auth is open; tighten when you add login
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_pool()
    log.info("Database connection pool initialized")


@app.on_event("shutdown")
def shutdown():
    close_pool()
    log.info("Database connection pool closed")


# ────────────────────────────────────────────────────────────
# Helper: validate source_folder against known values
# ────────────────────────────────────────────────────────────
VALID_FOLDERS = {"ZF2526", "ZF2627", "ZFN2526"}


def validate_folder(folder: Optional[str]):
    if folder and folder.upper() not in VALID_FOLDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source_folder. Must be one of {sorted(VALID_FOLDERS)}"
        )
    return folder.upper() if folder else None


# ────────────────────────────────────────────────────────────
# Health check
# ────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    try:
        result = fetch_one("SELECT 1 AS ok")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")


@app.get("/")
def root():
    return {
        "name": "ERP Analytics API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "/dashboard/overview",
            "/dashboard/today-sales",
            "/dashboard/monthly-sales",
            "/customers/top",
            "/customers/{ledger_code}",
            "/customers/receivables",
            "/products/top",
            "/products/slow-moving",
            "/finance/cash-flow",
        ],
    }


# ════════════════════════════════════════════════════════════
# MANAGEMENT DASHBOARD
# ════════════════════════════════════════════════════════════

@app.get("/dashboard/overview")
def dashboard_overview(source_folder: Optional[str] = None):
    """Single summary card per company — total invoices, revenue, receivables."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_company_overview"
    params = []
    if folder:
        query += " WHERE source_folder = %s"
        params.append(folder)
    return {"data": fetch_all(query, params)}


@app.get("/dashboard/today-sales")
def today_sales(source_folder: Optional[str] = None):
    """Today's invoice count and revenue."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_today_sales"
    params = []
    if folder:
        query += " WHERE source_folder = %s"
        params.append(folder)
    return {"data": fetch_all(query, params)}


@app.get("/dashboard/monthly-sales")
def monthly_sales(
    source_folder: Optional[str] = None,
    limit: int = Query(12, ge=1, le=60),
):
    """Month-over-month sales trend, most recent first."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_monthly_sales"
    params = []
    if folder:
        query += " WHERE source_folder = %s"
        params.append(folder)
    query += " ORDER BY month DESC LIMIT %s"
    params.append(limit)
    return {"data": fetch_all(query, params)}


@app.get("/dashboard/sales-summary")
def sales_summary(
    source_folder: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """Daily sales totals, optionally filtered by date range."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_sales_summary WHERE 1=1"
    params = []
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)
    if start_date:
        query += " AND invoice_date >= %s"
        params.append(start_date)
    if end_date:
        query += " AND invoice_date <= %s"
        params.append(end_date)
    query += " ORDER BY invoice_date DESC"
    return {"data": fetch_all(query, params)}


# ════════════════════════════════════════════════════════════
# CUSTOMER DASHBOARD
# ════════════════════════════════════════════════════════════

@app.get("/customers/top")
def top_customers(
    source_folder: Optional[str] = None,
    limit: int = Query(20, ge=1, le=200),
):
    """Customer ranking by total purchase value."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_top_customers WHERE 1=1"
    params = []
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)
    query += " ORDER BY total_purchases DESC LIMIT %s"
    params.append(limit)
    return {"data": fetch_all(query, params)}


@app.get("/customers/receivables")
def outstanding_receivables(
    source_folder: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    """Customers with outstanding balances, highest first."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_outstanding_receivables WHERE 1=1"
    params = []
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)
    query += " ORDER BY outstanding_amount DESC LIMIT %s"
    params.append(limit)
    return {"data": fetch_all(query, params)}


@app.get("/customers/ltv")
def customer_lifetime_value(
    source_folder: Optional[str] = None,
    limit: int = Query(20, ge=1, le=200),
):
    """Customer lifetime value — total orders, revenue, avg order value."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_customer_ltv WHERE 1=1"
    params = []
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)
    query += " ORDER BY lifetime_value DESC LIMIT %s"
    params.append(limit)
    return {"data": fetch_all(query, params)}


@app.get("/customers/{ledger_code}")
def customer_detail(ledger_code: str, source_folder: Optional[str] = None):
    """Single customer profile — balance, group, contact info."""
    folder = validate_folder(source_folder)
    query = """
        SELECT * FROM warehouse.dim_customer
        WHERE ledger_code = %s
    """
    params = [ledger_code]
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)

    rows = fetch_all(query, params)
    if not rows:
        raise HTTPException(status_code=404, detail=f"Customer '{ledger_code}' not found")
    return {"data": rows}


# ════════════════════════════════════════════════════════════
# PRODUCT DASHBOARD
# ════════════════════════════════════════════════════════════

@app.get("/products/top")
def top_products(
    source_folder: Optional[str] = None,
    limit: int = Query(20, ge=1, le=200),
):
    """Best-selling products by revenue."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_top_products WHERE 1=1"
    params = []
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)
    query += " ORDER BY total_revenue DESC LIMIT %s"
    params.append(limit)
    return {"data": fetch_all(query, params)}


@app.get("/products/slow-moving")
def slow_moving_products(
    source_folder: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    """Products with no sales in 90+ days."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_slow_moving_products WHERE 1=1"
    params = []
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)
    query += " LIMIT %s"
    params.append(limit)
    return {"data": fetch_all(query, params)}


@app.get("/products/{item_code}")
def product_detail(item_code: str, source_folder: Optional[str] = None):
    """Single product profile."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.dim_product WHERE item_code = %s"
    params = [item_code]
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)

    rows = fetch_all(query, params)
    if not rows:
        raise HTTPException(status_code=404, detail=f"Product '{item_code}' not found")
    return {"data": rows}


# ════════════════════════════════════════════════════════════
# FINANCE DASHBOARD
# ════════════════════════════════════════════════════════════

@app.get("/finance/cash-flow")
def cash_flow(
    source_folder: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """Daily debit/credit movement."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.vw_cash_flow WHERE 1=1"
    params = []
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)
    if start_date:
        query += " AND voucher_date >= %s"
        params.append(start_date)
    if end_date:
        query += " AND voucher_date <= %s"
        params.append(end_date)
    query += " ORDER BY voucher_date DESC"
    return {"data": fetch_all(query, params)}


@app.get("/finance/transactions")
def recent_transactions(
    source_folder: Optional[str] = None,
    ledger_code: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
):
    """Raw transaction list, optionally filtered by ledger."""
    folder = validate_folder(source_folder)
    query = """
        SELECT f.*, c.customer_name
        FROM warehouse.fact_finance f
        LEFT JOIN warehouse.dim_customer c ON f.ledger_key = c.customer_key
        WHERE 1=1
    """
    params = []
    if folder:
        query += " AND f.source_folder = %s"
        params.append(folder)
    if ledger_code:
        query += " AND c.ledger_code = %s"
        params.append(ledger_code)
    query += " ORDER BY f.voucher_date DESC LIMIT %s"
    params.append(limit)
    return {"data": fetch_all(query, params)}


# ════════════════════════════════════════════════════════════
# INVENTORY DASHBOARD
# ════════════════════════════════════════════════════════════

@app.get("/inventory/items")
def inventory_items(
    source_folder: Optional[str] = None,
    item_group: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
):
    """Item master with opening stock/value."""
    folder = validate_folder(source_folder)
    query = "SELECT * FROM warehouse.dim_product WHERE 1=1"
    params = []
    if folder:
        query += " AND source_folder = %s"
        params.append(folder)
    if item_group:
        query += " AND item_group = %s"
        params.append(item_group)
    query += " ORDER BY item_description LIMIT %s"
    params.append(limit)
    return {"data": fetch_all(query, params)}


# ════════════════════════════════════════════════════════════
# SALES DRILL-DOWN
# ════════════════════════════════════════════════════════════

@app.get("/sales/invoice/{invoice_no}")
def invoice_detail(
    invoice_no: str,
    source_folder: Optional[str] = None,
):
    """Full invoice with header + line items."""
    folder = validate_folder(source_folder)

    header_query = "SELECT * FROM warehouse.fact_sales_header WHERE invoice_no = %s"
    header_params = [invoice_no]
    if folder:
        header_query += " AND source_folder = %s"
        header_params.append(folder)

    header = fetch_all(header_query, header_params)
    if not header:
        raise HTTPException(status_code=404, detail=f"Invoice '{invoice_no}' not found")

    lines_query = """
        SELECT f.*, p.item_description
        FROM warehouse.fact_sales f
        LEFT JOIN warehouse.dim_product p ON f.product_key = p.product_key
        WHERE f.invoice_no = %s
    """
    lines_params = [invoice_no]
    if folder:
        lines_query += " AND f.source_folder = %s"
        lines_params.append(folder)

    lines = fetch_all(lines_query, lines_params)

    return {"header": header[0], "lines": lines}
