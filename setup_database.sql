-- ============================================================
-- Phase 2 – PostgreSQL Database Setup
-- Run this ONCE on your PostgreSQL server before first sync
-- ============================================================

-- 1. Create the database (run as postgres superuser)
CREATE DATABASE erp_warehouse
    ENCODING 'UTF8'
    LC_COLLATE 'en_US.UTF-8'
    LC_CTYPE 'en_US.UTF-8'
    TEMPLATE template0;

-- 2. Connect to it, then run the rest:
\c erp_warehouse

-- 3. Create a dedicated user (optional but recommended)
CREATE USER erp_sync WITH PASSWORD 'choose_a_strong_password_here';

-- 4. Create schemas
CREATE SCHEMA IF NOT EXISTS raw;           -- ERP data as-is
CREATE SCHEMA IF NOT EXISTS staging;       -- Cleaned / normalised
CREATE SCHEMA IF NOT EXISTS warehouse;     -- Fact + Dimension tables (Phase 3)
CREATE SCHEMA IF NOT EXISTS sync_meta;     -- Sync tracking

-- 5. Grant permissions
GRANT USAGE ON SCHEMA raw, staging, warehouse, sync_meta TO erp_sync;
GRANT ALL   ON ALL TABLES    IN SCHEMA raw, staging, warehouse, sync_meta TO erp_sync;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA raw, staging, warehouse, sync_meta TO erp_sync;
ALTER DEFAULT PRIVILEGES IN SCHEMA raw
    GRANT ALL ON TABLES    TO erp_sync;
ALTER DEFAULT PRIVILEGES IN SCHEMA raw
    GRANT ALL ON SEQUENCES TO erp_sync;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging
    GRANT ALL ON TABLES    TO erp_sync;
ALTER DEFAULT PRIVILEGES IN SCHEMA warehouse
    GRANT ALL ON TABLES    TO erp_sync;

-- 6. Verify
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('raw','staging','warehouse','sync_meta')
ORDER BY schema_name;
-- Should return 4 rows

-- ============================================================
-- USEFUL QUERIES AFTER FIRST SYNC
-- ============================================================

-- Check what got imported
SELECT
    _source_folder,
    _source_table,
    COUNT(*)          AS row_count,
    MAX(_synced_at)   AS last_sync
FROM raw.zf2526_sales1        -- change table name as needed
GROUP BY 1, 2
ORDER BY 1, 2;

-- Check sync history
SELECT
    source_folder,
    table_name,
    started_at,
    ended_at,
    rows_written,
    status,
    error_msg
FROM sync_meta.sync_log
ORDER BY started_at DESC
LIMIT 50;

-- Check which files changed since last sync
SELECT
    source_folder,
    table_name,
    last_synced,
    row_count
FROM sync_meta.file_state
ORDER BY last_synced DESC;

-- Quick sales check after import
SELECT
    _source_folder   AS company,
    COUNT(*)         AS invoices
FROM raw.zf2526_sales1
GROUP BY 1
ORDER BY 1;
