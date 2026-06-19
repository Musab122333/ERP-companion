# Phase 3 — Data Warehouse

## What This Builds

On top of your verified `raw.*` tables (87,841 rows, all confirmed non-null),
this creates a proper star-schema warehouse:

| Layer | Tables | Purpose |
|---|---|---|
| **Dimensions** | `dim_date`, `dim_customer`, `dim_product` | The "who/what/when" |
| **Facts** | `fact_sales`, `fact_sales_header`, `fact_finance`, `fact_receivables` | The "what happened" |
| **Views** | 9 dashboard-ready views | Pre-joined, pre-aggregated, fast queries |

All three of your ERP folders (`ZF2526`, `ZF2627`, `ZFN2526`) are combined
into single unified tables, with `source_folder` retained so you can always
filter by company/year.

---

## Run Order

Run these **in pgAdmin Query Tool, in this exact order**:

```
1. 01_dimension_tables.sql
2. 02_fact_tables.sql
3. 03_dashboard_views.sql
```

Each file ends with a verification `SELECT` so you immediately see row counts.

---

## Expected Output

### After `01_dimension_tables.sql`
```
table_name      rows
dim_date        4018      (10 years pre-populated)
dim_customer    ~600      (175+251+230 across 3 folders, deduped per folder)
dim_product     ~1900     (643 × 3 folders)
```

### After `02_fact_tables.sql`
```
table_name          rows
fact_sales           ~31,874   (SALES2 line items across all 3 folders)
fact_sales_header     ~5,191   (SALES1 invoices)
fact_finance         ~41,634   (TRANS across all 3 folders)
fact_receivables      ~5,001   (BILLADJ across all 3 folders)
```

### After `03_dashboard_views.sql`
Sample output from each of the 9 views, so you can immediately
sanity-check real numbers — top customers, top products, outstanding
receivables, monthly trends.

---

## Views Created (this is what your dashboard/API will query)

| View | Powers |
|---|---|
| `vw_sales_summary` | Daily sales chart |
| `vw_today_sales` | "Today's Sales" dashboard card |
| `vw_monthly_sales` | Month-over-month trend chart |
| `vw_top_customers` | Customer ranking dashboard |
| `vw_top_products` | Product performance dashboard |
| `vw_slow_moving_products` | Inventory — items unsold 90+ days |
| `vw_outstanding_receivables` | Finance — who owes money |
| `vw_cash_flow` | Daily debit/credit movement |
| `vw_customer_ltv` | Customer lifetime value |
| `vw_company_overview` | Single summary card per company |

---

## Important Design Notes

**MASTER contains more than customers.** Your ledger master includes
internal accounts like `CASH`, `SALES`, `PURCHASES`, `CLOSING STOCK`
alongside real customers. These are kept in `dim_customer` (since they're
all ledger entries) but excluded from `vw_outstanding_receivables` and
`vw_company_overview`'s receivables calc via an `account_group` filter.
**Check `groupcdbg` values in your data** — if your internal accounts use
different group names than `CASH`/`SALES`/`PURCHASES`/`CLOSING STOCK`,
update the filter in `03_dashboard_views.sql`.

**Three folders are merged, not separated.** Every fact and dimension
table includes `source_folder` so ZF2526/ZF2627/ZFN2526 stay distinguishable
even though they're combined into one table. If ZF2526 and ZF2627 represent
different financial years for the *same* company, your "yearly trend"
queries will work correctly across both. If they represent genuinely
different companies, filter by `source_folder` to keep them separate.

**Customer/Product dedup is per-folder, not global.** A customer code
`'11'` in ZF2526 and `'11'` in ZF2627 are treated as different rows in
`dim_customer` (since the `UNIQUE` constraint is on `(source_folder,
ledger_code)`). This is intentional — the same code can mean different
things across financial years in this kind of ERP.

---

## Validation Queries

Run these after all 3 scripts complete, to sanity-check the warehouse:

```sql
-- Does total fact_sales revenue roughly match raw SALES2 amount sum?
SELECT SUM(amount) FROM raw.zf2526_sales2;
SELECT SUM(line_amount) FROM warehouse.fact_sales WHERE source_folder='ZF2526';
-- These two numbers should be very close (small diffs OK from join drops)

-- Any sales lines that failed to match a customer?
SELECT COUNT(*) FROM warehouse.fact_sales WHERE customer_key IS NULL;

-- Any sales lines that failed to match a product?
SELECT COUNT(*) FROM warehouse.fact_sales WHERE product_key IS NULL;
```

If either of the last two returns a large number, it means some `cuscode`
or `itemcode` values in SALES2 don't have a matching row in MASTER/ITEM —
worth investigating before building dashboards on top.

---

## Next Phase

**Phase 4 — FastAPI Backend**

Once you've run all 3 scripts and the validation queries look reasonable,
share the results and we'll build the REST API layer that serves these
views to your dashboard and mobile app.
