-- ============================================================
-- Phase 3 — Data Warehouse: FACT TABLES
-- ============================================================
-- Run AFTER 01_dimension_tables.sql
-- These are the "what happened" tables — every sale, every
-- transaction, every bill adjustment, joined to dimensions.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FACT_SALES — one row per invoice LINE item (SALES2 = lines)
-- Joined with SALES1 (header) for invoice-level fields,
-- and to dim_customer / dim_product for names.
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS warehouse.fact_sales CASCADE;
CREATE TABLE warehouse.fact_sales (
    fact_sales_key      BIGSERIAL PRIMARY KEY,
    source_folder         TEXT NOT NULL,
    invoice_no              TEXT,
    invoice_date              DATE,
    invoice_type                TEXT,
    customer_key                  INTEGER REFERENCES warehouse.dim_customer(customer_key),
    product_key                     INTEGER REFERENCES warehouse.dim_product(product_key),
    rep_code                          TEXT,
    quantity                            NUMERIC,
    rate                                  NUMERIC,
    discount_pct                            NUMERIC,
    discount_amt                              NUMERIC,
    line_amount                                 NUMERIC,
    batch_no                                      TEXT
);

INSERT INTO warehouse.fact_sales
    (source_folder, invoice_no, invoice_date, invoice_type, customer_key,
     product_key, rep_code, quantity, rate, discount_pct, discount_amt,
     line_amount, batch_no)
SELECT
    s2._source_folder,
    s2.invno::TEXT,
    h.invdatebg,
    s2.invtype,
    c.customer_key,
    p.product_key,
    s2.repcode,
    s2.qty,
    s2.itemrate,
    s2.discount,
    s2.disamt,
    s2.amount,
    s2.batchno
FROM raw.zf2526_sales2 s2
LEFT JOIN raw.zf2526_sales1 h
    ON s2.invno = h.invnoebg AND s2._source_folder = h._source_folder
LEFT JOIN warehouse.dim_customer c
    ON s2.cuscode = c.ledger_code AND s2._source_folder = c.source_folder
LEFT JOIN warehouse.dim_product p
    ON s2.itemcode = p.item_code AND s2._source_folder = p.source_folder

UNION ALL

SELECT
    s2._source_folder, s2.invno::TEXT, h.invdatebg, s2.invtype, c.customer_key,
    p.product_key, s2.repcode, s2.qty, s2.itemrate, s2.discount, s2.disamt,
    s2.amount, s2.batchno
FROM raw.zf2627_sales2 s2
LEFT JOIN raw.zf2627_sales1 h
    ON s2.invno = h.invnoebg AND s2._source_folder = h._source_folder
LEFT JOIN warehouse.dim_customer c
    ON s2.cuscode = c.ledger_code AND s2._source_folder = c.source_folder
LEFT JOIN warehouse.dim_product p
    ON s2.itemcode = p.item_code AND s2._source_folder = p.source_folder

UNION ALL

SELECT
    s2._source_folder, s2.invno::TEXT, h.invdatebg, s2.invtype, c.customer_key,
    p.product_key, s2.repcode, s2.qty, s2.itemrate, s2.discount, s2.disamt,
    s2.amount, s2.batchno
FROM raw.zfn2526_sales2 s2
LEFT JOIN raw.zfn2526_sales1 h
    ON s2.invno = h.invnoebg AND s2._source_folder = h._source_folder
LEFT JOIN warehouse.dim_customer c
    ON s2.cuscode = c.ledger_code AND s2._source_folder = c.source_folder
LEFT JOIN warehouse.dim_product p
    ON s2.itemcode = p.item_code AND s2._source_folder = p.source_folder;

CREATE INDEX idx_fact_sales_date     ON warehouse.fact_sales(invoice_date);
CREATE INDEX idx_fact_sales_customer ON warehouse.fact_sales(customer_key);
CREATE INDEX idx_fact_sales_product  ON warehouse.fact_sales(product_key);
CREATE INDEX idx_fact_sales_folder   ON warehouse.fact_sales(source_folder);


-- ────────────────────────────────────────────────────────────
-- FACT_SALES_HEADER — one row per invoice (SALES1), for
-- invoice-level totals/tax/transport that don't belong at line level
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS warehouse.fact_sales_header CASCADE;
CREATE TABLE warehouse.fact_sales_header (
    fact_header_key    BIGSERIAL PRIMARY KEY,
    source_folder         TEXT NOT NULL,
    invoice_no              TEXT,
    invoice_date              DATE,
    invoice_type                TEXT,
    customer_key                  INTEGER REFERENCES warehouse.dim_customer(customer_key),
    bill_amount                     NUMERIC,
    tax_amount                        NUMERIC,
    round_off                           NUMERIC,
    total_amount                          NUMERIC,
    transport                               TEXT,
    due_days                                  INTEGER,
    UNIQUE (source_folder, invoice_no, invoice_type)
);

INSERT INTO warehouse.fact_sales_header
    (source_folder, invoice_no, invoice_date, invoice_type, customer_key,
     bill_amount, tax_amount, round_off, total_amount, transport, due_days)
SELECT
    h._source_folder, h.invnoebg::TEXT, h.invdatebg, h.invtypebg,
    c.customer_key, h.billamtg, h.taxamtng, h.roundoffg, h.totaliong,
    h.transportg, h.duedaysg::INTEGER
FROM raw.zf2526_sales1 h
LEFT JOIN warehouse.dim_customer c
    ON h.cuscodebg = c.ledger_code AND h._source_folder = c.source_folder

UNION ALL

SELECT
    h._source_folder, h.invnoebg::TEXT, h.invdatebg, h.invtypebg,
    c.customer_key, h.billamtg, h.taxamtng, h.roundoffg, h.totaliong,
    h.transportg, h.duedaysg::INTEGER
FROM raw.zf2627_sales1 h
LEFT JOIN warehouse.dim_customer c
    ON h.cuscodebg = c.ledger_code AND h._source_folder = c.source_folder

UNION ALL

SELECT
    h._source_folder, h.invnoebg::TEXT, h.invdatebg, h.invtypebg,
    c.customer_key, h.billamtg, h.taxamtng, h.roundoffg, h.totaliong,
    h.transportg, h.duedaysg::INTEGER
FROM raw.zfn2526_sales1 h
LEFT JOIN warehouse.dim_customer c
    ON h.cuscodebg = c.ledger_code AND h._source_folder = c.source_folder
ON CONFLICT (source_folder, invoice_no, invoice_type) DO NOTHING;

CREATE INDEX idx_fact_sh_date     ON warehouse.fact_sales_header(invoice_date);
CREATE INDEX idx_fact_sh_customer ON warehouse.fact_sales_header(customer_key);


-- ────────────────────────────────────────────────────────────
-- FACT_FINANCE — accounting transactions (TRANS table)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS warehouse.fact_finance CASCADE;
CREATE TABLE warehouse.fact_finance (
    fact_finance_key   BIGSERIAL PRIMARY KEY,
    source_folder         TEXT NOT NULL,
    voucher_no              TEXT,
    voucher_date              DATE,
    ledger_key                  INTEGER REFERENCES warehouse.dim_customer(customer_key),
    narration                     TEXT,
    debit_credit                    TEXT,
    amount                            NUMERIC,
    rep_code                           TEXT
);

INSERT INTO warehouse.fact_finance
    (source_folder, voucher_no, voucher_date, ledger_key, narration,
     debit_credit, amount, rep_code)
SELECT
    t._source_folder, t.vounoe::TEXT, t.voudate, c.customer_key,
    t.naration, t.drcrate, t.vou_amt, t.repcode
FROM raw.zf2526_trans t
LEFT JOIN warehouse.dim_customer c
    ON t.codee = c.ledger_code AND t._source_folder = c.source_folder

UNION ALL

SELECT
    t._source_folder, t.vounoe::TEXT, t.voudate, c.customer_key,
    t.naration, t.drcrate, t.vou_amt, t.repcode
FROM raw.zf2627_trans t
LEFT JOIN warehouse.dim_customer c
    ON t.codee = c.ledger_code AND t._source_folder = c.source_folder

UNION ALL

SELECT
    t._source_folder, t.vounoe::TEXT, t.voudate, c.customer_key,
    t.naration, t.drcrate, t.vou_amt, t.repcode
FROM raw.zfn2526_trans t
LEFT JOIN warehouse.dim_customer c
    ON t.codee = c.ledger_code AND t._source_folder = c.source_folder;

CREATE INDEX idx_fact_finance_date   ON warehouse.fact_finance(voucher_date);
CREATE INDEX idx_fact_finance_ledger ON warehouse.fact_finance(ledger_key);


-- ────────────────────────────────────────────────────────────
-- FACT_RECEIVABLES — bill adjustments (BILLADJ) for outstanding tracking
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS warehouse.fact_receivables CASCADE;
CREATE TABLE warehouse.fact_receivables (
    fact_recv_key      BIGSERIAL PRIMARY KEY,
    source_folder         TEXT NOT NULL,
    voucher_no              TEXT,
    voucher_date              DATE,
    customer_key                INTEGER REFERENCES warehouse.dim_customer(customer_key),
    voucher_amount                NUMERIC,
    bill_adjusted                   NUMERIC,
    bill_amount                       NUMERIC,
    ref_invoice_no                      TEXT
);

INSERT INTO warehouse.fact_receivables
    (source_folder, voucher_no, voucher_date, customer_key, voucher_amount,
     bill_adjusted, bill_amount, ref_invoice_no)
SELECT
    b._source_folder, b.vouno::TEXT, b.voudate, c.customer_key,
    b.vou_amt, b.billadj, b.billamt, b.invno::TEXT
FROM raw.zf2526_billadj b
LEFT JOIN warehouse.dim_customer c
    ON b.cuscode = c.ledger_code AND b._source_folder = c.source_folder

UNION ALL

SELECT
    b._source_folder, b.vouno::TEXT, b.voudate, c.customer_key,
    b.vou_amt, b.billadj, b.billamt, b.invno::TEXT
FROM raw.zf2627_billadj b
LEFT JOIN warehouse.dim_customer c
    ON b.cuscode = c.ledger_code AND b._source_folder = c.source_folder

UNION ALL

SELECT
    b._source_folder, b.vouno::TEXT, b.voudate, c.customer_key,
    b.vou_amt, b.billadj, b.billamt, b.invno::TEXT
FROM raw.zfn2526_billadj b
LEFT JOIN warehouse.dim_customer c
    ON b.cuscode = c.ledger_code AND b._source_folder = c.source_folder;

CREATE INDEX idx_fact_recv_date     ON warehouse.fact_receivables(voucher_date);
CREATE INDEX idx_fact_recv_customer ON warehouse.fact_receivables(customer_key);


-- ────────────────────────────────────────────────────────────
-- Verification
-- ────────────────────────────────────────────────────────────
SELECT 'fact_sales'         AS table_name, COUNT(*) AS rows FROM warehouse.fact_sales
UNION ALL
SELECT 'fact_sales_header', COUNT(*) FROM warehouse.fact_sales_header
UNION ALL
SELECT 'fact_finance',      COUNT(*) FROM warehouse.fact_finance
UNION ALL
SELECT 'fact_receivables',  COUNT(*) FROM warehouse.fact_receivables;
