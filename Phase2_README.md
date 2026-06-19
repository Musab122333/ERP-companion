# Phase 2 — DBF → PostgreSQL Sync Engine

## What It Does

Reads every DBF file from your ERP folders and loads them into PostgreSQL.

| Feature | Detail |
|---|---|
| **Incremental sync** | Only reimports files that changed (MD5 hash check) |
| **Full reimport** | `--mode full` forces all tables to reload |
| **Sync log** | Every run logged in `sync_meta.sync_log` |
| **Auto schema** | Creates PostgreSQL tables automatically from DBF headers |
| **Batch inserts** | 500 rows per INSERT — fast and memory-safe |
| **Error isolation** | One table failing does not stop the rest |
| **Priority order** | Master tables synced before transaction tables |

---

## Files

| File | Purpose |
|---|---|
| `phase2_sync_engine.py` | Main sync script |
| `setup_database.sql` | Run once on PostgreSQL to create DB + schemas |
| `.env.example` | Copy to `.env` and fill in your credentials |

---

## Step 1 — PostgreSQL Setup (once)

Open pgAdmin or psql and run `setup_database.sql`:

```sql
-- In psql:
\i setup_database.sql
```

Or paste it into pgAdmin Query Tool.

---

## Step 2 — Install Python packages

```bash
pip install dbfread psycopg2-binary python-dotenv
```

---

## Step 3 — Configure

Copy `.env.example` to `.env` and edit:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=erp_warehouse
DB_USER=erp_sync
DB_PASSWORD=your_actual_password
```

Also edit the `ERP_FOLDERS` dict inside `phase2_sync_engine.py`
if your paths differ from the defaults.

---

## Step 4 — First Run (Full Import)

```bash
python phase2_sync_engine.py --mode full
```

Expected output:

```
2026-06-10 10:00:01  INFO     Connected → localhost:5432/erp_warehouse
2026-06-10 10:00:01  INFO     Tables in queue: 52

  ✅  ZF2526/MAINGRP          28 rows → raw.zf2526_maingrp
  ✅  ZF2526/MASTER          175 rows → raw.zf2526_master
  ✅  ZF2526/ITEM            643 rows → raw.zf2526_item
  ✅  ZF2526/SALES1          833 rows → raw.zf2526_sales1
  ✅  ZF2526/SALES2        4,343 rows → raw.zf2526_sales2
  ...

  SYNC COMPLETE
  Synced  : 52 tables
  Skipped :  0 tables
  Errors  :  0 tables
  Rows    : 176,100 total inserted
```

---

## Daily / Scheduled Sync (Incremental)

```bash
python phase2_sync_engine.py --mode incremental
```

Only DBF files that changed since last sync are reimported.
Unchanged files are skipped instantly.

### Windows Task Scheduler (automate)

1. Open Task Scheduler → Create Basic Task
2. Trigger: Daily at 6:00 AM (before office hours)
3. Action: `python E:\demo\phase2_sync_engine.py --mode incremental`
4. Done — runs automatically every day

---

## Test a Single Table

```bash
python phase2_sync_engine.py --mode full --table SALES1
python phase2_sync_engine.py --mode full --table MASTER
```

---

## What Gets Created in PostgreSQL

### Schemas
- `raw` — DBF data imported as-is (one table per DBF per folder)
- `sync_meta` — sync logs and file state tracking

### Table naming convention
```
raw.{source_folder}_{table_name}

Examples:
  raw.zf2526_sales1
  raw.zf2627_sales1
  raw.zfn2526_master
```

### Extra columns added to every table
| Column | Purpose |
|---|---|
| `_sync_id` | Auto-increment row ID |
| `_source_folder` | Which ERP folder (ZF2526 etc.) |
| `_source_table` | Original DBF table name |
| `_synced_at` | When this row was imported |
| `_row_hash` | MD5 of row values for change detection |

---

## Troubleshooting

| Error | Fix |
|---|---|
| `connection refused` | PostgreSQL not running, or wrong DB_HOST |
| `password authentication failed` | Wrong DB_PASSWORD in .env |
| `database "erp_warehouse" does not exist` | Run setup_database.sql first |
| `Folder not found` | Check ERP_FOLDERS paths in the script |
| `DBF header returned no fields` | DBF file may be corrupt or empty |

All errors are also logged to `logs/sync_YYYYMMDD_HHMMSS.log`.

---

## Next Phase

**Phase 3 — Data Warehouse**

After a successful full sync, share the output of:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'raw'
ORDER BY table_name;
```

And we will build the `warehouse` schema with:
- `fact_sales`, `fact_inventory`, `fact_finance`
- `dim_customer`, `dim_product`, `dim_date`
- Aggregation views for the dashboard
