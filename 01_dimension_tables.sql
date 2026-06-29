-- ============================================================
-- Phase 3 — Data Warehouse: DIMENSION TABLES
-- ============================================================
-- Run AFTER Phase 2 sync is complete and verified.
-- These are the "who/what/when" tables that fact tables join to.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS warehouse;

-- ────────────────────────────────────────────────────────────
-- DIM_DATE — standard date dimension, pre-populated for 10 years
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS warehouse.dim_date CASCADE;
CREATE TABLE warehouse.dim_date (
    date_key        DATE PRIMARY KEY,
    year            INTEGER NOT NULL,
    quarter         INTEGER NOT NULL,
    month           INTEGER NOT NULL,
    month_name      TEXT NOT NULL,
    day             INTEGER NOT NULL,
    day_name        TEXT NOT NULL,
    week_of_year    INTEGER NOT NULL,
    is_weekend      BOOLEAN NOT NULL,
    financial_year  TEXT NOT NULL    -- e.g. 'FY2025-26' (Apr–Mar)
);

INSERT INTO warehouse.dim_date
SELECT
    d::DATE,
    EXTRACT(YEAR FROM d)::INT,
    EXTRACT(QUARTER FROM d)::INT,
    EXTRACT(MONTH FROM d)::INT,
    TO_CHAR(d, 'Month'),
    EXTRACT(DAY FROM d)::INT,
    TO_CHAR(d, 'Day'),
    EXTRACT(WEEK FROM d)::INT,
    EXTRACT(ISODOW FROM d) IN (6,7),
    CASE
        WHEN EXTRACT(MONTH FROM d) >= 4
        THEN 'FY' || EXTRACT(YEAR FROM d) || '-' || RIGHT((EXTRACT(YEAR FROM d)+1)::TEXT, 2)
        ELSE 'FY' || (EXTRACT(YEAR FROM d)-1) || '-' || RIGHT(EXTRACT(YEAR FROM d)::TEXT, 2)
    END
FROM generate_series('2020-01-01'::DATE, '2030-12-31'::DATE, '1 day') AS d;

CREATE INDEX idx_dim_date_fy ON warehouse.dim_date(financial_year);
CREATE INDEX idx_dim_date_ym ON warehouse.dim_date(year, month);


-- ────────────────────────────────────────────────────────────
-- DIM_CUSTOMER — unified customer/ledger master across all 3 folders
-- ────────────────────────────────────────────────────────────
-- Note: MASTER contains customers, suppliers, AND internal accounts
-- (CASH, SALES, PURCHASES, CLOSING STOCK etc.) all in one table.
-- We keep them all here and let the "group" field distinguish them.
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS warehouse.dim_customer CASCADE;
CREATE TABLE warehouse.dim_customer (
    customer_key     SERIAL PRIMARY KEY,
    source_folder     TEXT NOT NULL,
    ledger_code        TEXT NOT NULL,
    customer_name      TEXT,
    account_group      TEXT,
    state               TEXT,
    place                TEXT,
    mobile               TEXT,
    opening_balance      NUMERIC,
    current_balance       NUMERIC,
    credit_limit            NUMERIC,
    gst_number               TEXT,
    is_active                 BOOLEAN DEFAULT TRUE,
    is_internal_account        BOOLEAN DEFAULT FALSE,
    UNIQUE (source_folder, ledger_code)
);

INSERT INTO warehouse.dim_customer
    (source_folder, ledger_code, customer_name, account_group, state, place,
     mobile, opening_balance, current_balance, credit_limit, gst_number)
SELECT
    _source_folder,
    codecbg,
    desccbg,
    groupcdbg,
    statecode,
    place_cdbg,
    mobileno,
    opbalcbg,
    balancebg,
    crelimitbg,
    apgsttbg
FROM raw.zf2526_master
UNION ALL
SELECT
    _source_folder, codecbg, desccbg, groupcdbg, statecode, place_cdbg,
    mobileno, opbalcbg, balancebg, crelimitbg, apgsttbg
FROM raw.zf2627_master
UNION ALL
SELECT
    _source_folder, codecbg, desccbg, groupcdbg, statecode, place_cdbg,
    mobileno, opbalcbg, balancebg, crelimitbg, apgsttbg
FROM raw.zfn2526_master
ON CONFLICT (source_folder, ledger_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- Flag internal control accounts (CASH/SALES/PURCHASES/STOCK/
-- PRODUCTION/CARRYFORWARD). These share group codes with real
-- customers (e.g. AS1015 mixes 'CASH SALE' with real parties), so
-- we flag by ledger_code instead of group code.
--
-- Confirmed internal codes, verified against ALL 3 folders (every
-- occurrence of these codes maps to an internal account, never a
-- real customer/supplier):
--   26, 72, 62, CSTK, 25, C, P, S   (cash/sales/purchases/closing stock)
--   01, 02, 2                       (production/carryforward/stock adj.)
--
-- If you spot more control accounts later (e.g. bank accounts,
-- discount accounts, rounding accounts), verify them the same way —
-- check ALL folders before adding, since codes can be reused for a
-- genuinely different real customer in a different folder.
-- ────────────────────────────────────────────────────────────
UPDATE warehouse.dim_customer
SET is_internal_account = TRUE
WHERE ledger_code IN ('26','72','62','CSTK','25','C','P','S','01','02','2');

CREATE INDEX idx_dim_customer_code ON warehouse.dim_customer(ledger_code);
CREATE INDEX idx_dim_customer_folder ON warehouse.dim_customer(source_folder);


-- ────────────────────────────────────────────────────────────
-- DIM_PRODUCT — unified item master across all 3 folders
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS warehouse.dim_product CASCADE;
CREATE TABLE warehouse.dim_product (
    product_key       SERIAL PRIMARY KEY,
    source_folder       TEXT NOT NULL,
    item_code             TEXT NOT NULL,
    item_description       TEXT,
    item_group               TEXT,
    uom                        TEXT,
    hsn_code                    TEXT,
    valuation_method              TEXT,
    standard_rate                  NUMERIC,
    opening_qty                      NUMERIC,
    opening_value                      NUMERIC,
    is_service                           BOOLEAN DEFAULT FALSE,
    UNIQUE (source_folder, item_code)
);

INSERT INTO warehouse.dim_product
    (source_folder, item_code, item_description, item_group, uom, hsn_code,
     valuation_method, standard_rate, opening_qty, opening_value, is_service)
SELECT
    _source_folder, itemcode, "desc", itemgroup, uom, hsncode,
    valuation, itemrate, opbalqty, opbalval,
    COALESCE(UPPER(is_service) IN ('Y','T','1','TRUE'), FALSE)
FROM raw.zf2526_item
UNION ALL
SELECT
    _source_folder, itemcode, "desc", itemgroup, uom, hsncode,
    valuation, itemrate, opbalqty, opbalval,
    COALESCE(UPPER(is_service) IN ('Y','T','1','TRUE'), FALSE)
FROM raw.zf2627_item
UNION ALL
SELECT
    _source_folder, itemcode, "desc", itemgroup, uom, hsncode,
    valuation, itemrate, opbalqty, opbalval,
    COALESCE(UPPER(is_service) IN ('Y','T','1','TRUE'), FALSE)
FROM raw.zfn2526_item
ON CONFLICT (source_folder, item_code) DO NOTHING;

CREATE INDEX idx_dim_product_code ON warehouse.dim_product(item_code);
CREATE INDEX idx_dim_product_folder ON warehouse.dim_product(source_folder);


-- ────────────────────────────────────────────────────────────
-- DIM_LEDGER_GROUP — account group classification (for finance reports)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS warehouse.dim_ledger_group CASCADE;
CREATE TABLE warehouse.dim_ledger_group (
    group_key      SERIAL PRIMARY KEY,
    source_folder   TEXT NOT NULL,
    group_code       TEXT,
    group_name        TEXT,
    main_group_code    TEXT,
    UNIQUE (source_folder, group_code)
);
-- Populate this once you confirm GROUP/MAINGRP field names — placeholder structure ready


-- ────────────────────────────────────────────────────────────
-- Verification
-- ────────────────────────────────────────────────────────────
SELECT 'dim_date'     AS table_name, COUNT(*) AS rows FROM warehouse.dim_date
UNION ALL
SELECT 'dim_customer', COUNT(*) FROM warehouse.dim_customer
UNION ALL
SELECT 'dim_product',  COUNT(*) FROM warehouse.dim_product;
