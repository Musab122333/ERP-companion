-- ============================================================
-- Phase 3 — Data Warehouse: DASHBOARD VIEWS
-- ============================================================
-- Run AFTER 02_fact_tables.sql
-- These views power the dashboards directly — fast, pre-joined,
-- ready for the API layer to SELECT * FROM with light filtering.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- VW_SALES_SUMMARY — daily sales totals per company
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_sales_summary AS
SELECT
    f.source_folder,
    f.invoice_date,
    COUNT(DISTINCT f.invoice_no)   AS invoice_count,
    SUM(f.line_amount)              AS total_sales,
    SUM(f.quantity)                   AS total_qty
FROM warehouse.fact_sales f
JOIN warehouse.dim_customer c ON f.customer_key = c.customer_key
WHERE f.invoice_date IS NOT NULL
  AND c.is_internal_account = FALSE
GROUP BY f.source_folder, f.invoice_date;


-- ────────────────────────────────────────────────────────────
-- VW_TODAY_SALES — for the "Today's Sales" dashboard card
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_today_sales AS
SELECT
    f.source_folder,
    COUNT(DISTINCT f.invoice_no) AS invoice_count,
    SUM(f.line_amount)            AS total_sales
FROM warehouse.fact_sales f
JOIN warehouse.dim_customer c ON f.customer_key = c.customer_key
WHERE f.invoice_date = CURRENT_DATE
  AND c.is_internal_account = FALSE
GROUP BY f.source_folder;


-- ────────────────────────────────────────────────────────────
-- VW_MONTHLY_SALES — month-over-month trend
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_monthly_sales AS
SELECT
    source_folder,
    DATE_TRUNC('month', invoice_date)::DATE AS month,
    COUNT(DISTINCT invoice_no)                AS invoice_count,
    SUM(line_amount)                            AS total_sales
FROM warehouse.fact_sales
WHERE invoice_date IS NOT NULL
GROUP BY source_folder, DATE_TRUNC('month', invoice_date)
ORDER BY month;


-- ────────────────────────────────────────────────────────────
-- VW_TOP_CUSTOMERS — ranked by total purchase value
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_top_customers AS
SELECT
    c.source_folder,
    c.ledger_code,
    c.customer_name,
    COUNT(DISTINCT f.invoice_no)  AS invoice_count,
    SUM(f.line_amount)             AS total_purchases,
    c.current_balance                AS outstanding_balance,
    MAX(f.invoice_date)                AS last_purchase_date
FROM warehouse.fact_sales f
JOIN warehouse.dim_customer c ON f.customer_key = c.customer_key
WHERE c.is_internal_account = FALSE
GROUP BY c.source_folder, c.ledger_code, c.customer_name, c.current_balance
ORDER BY total_purchases DESC;


-- ────────────────────────────────────────────────────────────
-- VW_TOP_PRODUCTS — ranked by revenue and quantity sold
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_top_products AS
SELECT
    p.source_folder,
    p.item_code,
    p.item_description,
    p.item_group,
    SUM(f.quantity)        AS total_qty_sold,
    SUM(f.line_amount)       AS total_revenue,
    COUNT(DISTINCT f.invoice_no) AS times_ordered
FROM warehouse.fact_sales f
JOIN warehouse.dim_product p ON f.product_key = p.product_key
GROUP BY p.source_folder, p.item_code, p.item_description, p.item_group
ORDER BY total_revenue DESC;


-- ────────────────────────────────────────────────────────────
-- VW_SLOW_MOVING_PRODUCTS — items with no sales in last 90 days
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_slow_moving_products AS
SELECT
    p.source_folder,
    p.item_code,
    p.item_description,
    p.opening_qty,
    MAX(f.invoice_date)            AS last_sold_date,
    CURRENT_DATE - MAX(f.invoice_date) AS days_since_last_sale
FROM warehouse.dim_product p
LEFT JOIN warehouse.fact_sales f
    ON p.product_key = f.product_key
GROUP BY p.source_folder, p.item_code, p.item_description, p.opening_qty
HAVING MAX(f.invoice_date) IS NULL
    OR MAX(f.invoice_date) < CURRENT_DATE - INTERVAL '90 days'
ORDER BY last_sold_date ASC NULLS FIRST;


-- ────────────────────────────────────────────────────────────
-- VW_OUTSTANDING_RECEIVABLES — customers who owe money
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_outstanding_receivables AS
SELECT
    source_folder,
    ledger_code,
    customer_name,
    current_balance        AS outstanding_amount,
    credit_limit,
    CASE
        WHEN credit_limit > 0 AND current_balance > credit_limit
        THEN TRUE ELSE FALSE
    END AS over_credit_limit
FROM warehouse.dim_customer
WHERE current_balance > 0
  AND is_internal_account = FALSE
ORDER BY current_balance DESC;


-- ────────────────────────────────────────────────────────────
-- VW_CASH_FLOW — daily net movement from TRANS
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_cash_flow AS
SELECT
    source_folder,
    voucher_date,
    SUM(CASE WHEN debit_credit = 'D' THEN amount ELSE 0 END) AS total_debit,
    SUM(CASE WHEN debit_credit = 'C' THEN amount ELSE 0 END) AS total_credit,
    SUM(CASE WHEN debit_credit = 'D' THEN amount ELSE -amount END) AS net_movement
FROM warehouse.fact_finance
WHERE voucher_date IS NOT NULL
GROUP BY source_folder, voucher_date
ORDER BY voucher_date;


-- ────────────────────────────────────────────────────────────
-- VW_CUSTOMER_LIFETIME_VALUE
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_customer_ltv AS
SELECT
    c.source_folder,
    c.ledger_code,
    c.customer_name,
    MIN(f.invoice_date)              AS first_purchase,
    MAX(f.invoice_date)                AS last_purchase,
    COUNT(DISTINCT f.invoice_no)         AS total_orders,
    SUM(f.line_amount)                     AS lifetime_value,
    ROUND(SUM(f.line_amount) / NULLIF(COUNT(DISTINCT f.invoice_no), 0), 2) AS avg_order_value
FROM warehouse.fact_sales f
JOIN warehouse.dim_customer c ON f.customer_key = c.customer_key
WHERE c.is_internal_account = FALSE
GROUP BY c.source_folder, c.ledger_code, c.customer_name;


-- ────────────────────────────────────────────────────────────
-- VW_COMPANY_OVERVIEW — single summary card per company/folder
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse.vw_company_overview AS
SELECT
    f.source_folder,
    COUNT(DISTINCT f.invoice_no)                          AS total_invoices,
    SUM(f.line_amount)                                       AS total_revenue,
    COUNT(DISTINCT f.customer_key)                             AS active_customers,
    (SELECT SUM(current_balance) FROM warehouse.dim_customer
     WHERE source_folder = f.source_folder
       AND current_balance > 0
       AND is_internal_account = FALSE) AS total_receivables
FROM warehouse.fact_sales f
JOIN warehouse.dim_customer c ON f.customer_key = c.customer_key
WHERE c.is_internal_account = FALSE
GROUP BY f.source_folder;


-- ────────────────────────────────────────────────────────────
-- Verification — sample each view
-- ────────────────────────────────────────────────────────────
SELECT * FROM warehouse.vw_company_overview;
SELECT * FROM warehouse.vw_top_customers LIMIT 10;
SELECT * FROM warehouse.vw_top_products LIMIT 10;
SELECT * FROM warehouse.vw_outstanding_receivables LIMIT 10;
SELECT * FROM warehouse.vw_monthly_sales LIMIT 12;
