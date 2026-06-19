"""
Phase 2 – DBF → PostgreSQL Sync Engine
=======================================
Run on your Windows machine where DBF files live.

Install:
    pip install dbfread psycopg2-binary pandas python-dotenv

Configure:
    Edit the CONFIG section below, or create a .env file.

Run (full import – first time):
    python phase2_sync_engine.py --mode full

Run (incremental – daily/scheduled):
    python phase2_sync_engine.py --mode incremental

Run (single table test):
    python phase2_sync_engine.py --mode full --table SALES1
"""

import os
import sys
import json
import struct
import hashlib
import argparse
import logging
import re
from pathlib import Path
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

# ── Logging ───────────────────────────────────────────────────────────────────
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.FileHandler(f"logs/sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
                            encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("sync")

# ── CONFIG ────────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DB_HOST     = os.environ.get("DB_HOST",     "localhost")
DB_PORT     = os.environ.get("DB_PORT",     "5432")
DB_NAME     = os.environ.get("DB_NAME",     "erp_warehouse")
DB_USER     = os.environ.get("DB_USER",     "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "your_password_here")

ERP_FOLDERS = {
    "ZF2526":  r"D:\FA\ZF2526",
    "ZF2627":  r"D:\FA\ZF2627",
    "ZFN2526": r"D:\FA\ZFN2526",
    # Add more folders here:
    # "ZFACA2627": r"D:\FA\ZFACA2627",
}

BATCH_SIZE = 500   # rows per INSERT batch

# Core tables synced first (order matters for FK references later)
PRIORITY_TABLES = [
    "MAINGRP", "GROUP", "ITEMGRP", "HSN", "PLACE", "REP", "STATEMAS",
    "SETUP", "MASTER", "ITEM",
    "SALES1", "SALES2",
    "BILLADJ", "TRNSEQNO",
]

# Temp/work tables — never sync these
SKIP_TABLES = {"CRTEMP", "DBTEMP", "TBTEMP", "TEMP", "TEMP1", "PART", "ORDLIS"}

# ── Helpers ───────────────────────────────────────────────────────────────────

def sanitize_str(value):
    if value is None:
        return None
    s = str(value).replace('\x00', '')
    s = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f\ufffd]', '', s)
    return s.strip() or None


def pg_name(name):
    """DBF name → safe QUOTED lowercase PostgreSQL identifier.
    Always wraps in double-quotes so reserved words (DESC, NAME, etc.)
    never cause syntax errors in DDL statements.
    """
    s = re.sub(r'[^a-zA-Z0-9_]', '_', str(name).lower()).strip('_')
    if not s:
        s = 'field_unknown'
    if s[0].isdigit():
        s = 'f_' + s
    return f'"{s}"'   # always quoted


def get_file_hash(filepath):
    h = hashlib.md5()
    try:
        with open(filepath, 'rb') as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


# ── DBF Schema Reader ─────────────────────────────────────────────────────────

DBF_TO_PG = {
    'C': 'TEXT', 'N': 'NUMERIC', 'F': 'NUMERIC', 'D': 'DATE',
    'L': 'BOOLEAN', 'M': 'TEXT', 'I': 'INTEGER', 'Y': 'NUMERIC(19,4)',
    'T': 'TIMESTAMP', 'B': 'NUMERIC', '+': 'BIGINT',
}


def read_dbf_schema(filepath):
    """Return (fields_list, record_count, header_size, record_size)."""
    fields = []
    try:
        with open(filepath, 'rb') as f:
            hdr = f.read(32)
            if len(hdr) < 32:
                return fields, 0, 0, 0
            record_count = struct.unpack_from('<I', hdr, 4)[0]
            header_size  = struct.unpack_from('<H', hdr, 8)[0]
            record_size  = struct.unpack_from('<H', hdr, 10)[0]
            while True:
                fd = f.read(32)
                if not fd or len(fd) < 32 or fd[0] == 0x0D:
                    break
                raw_name = fd[:11].replace(b'\x00', b'')
                fname = raw_name.decode('ascii', errors='ignore').strip()
                fname = re.sub(r'[^\x20-\x7E]', '', fname).strip()
                if not fname:
                    continue
                ftype_byte = fd[11]
                ftype = chr(ftype_byte) if 0x41 <= ftype_byte <= 0x5A else 'C'
                fields.append({
                    'dbf_name': fname,
                    'pg_name':  pg_name(fname),
                    'type':     ftype,
                    'pg_type':  DBF_TO_PG.get(ftype, 'TEXT'),
                    'length':   fd[16],
                    'decimal':  fd[17],
                })
    except Exception as e:
        log.warning(f"    Schema read failed {filepath}: {e}")
        return [], 0, 0, 0
    return fields, record_count, header_size, record_size


# ── DBF Record Iterator ────────────────────────────────────────────────────────

def coerce_native(v, ftype):
    """Coerce a dbfread native value to a psycopg2-safe Python type."""
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, Decimal):
        return v
    if isinstance(v, (date, datetime)):
        return v
    return sanitize_str(str(v))


def coerce_raw(val, ftype):
    """Coerce a raw string value (from binary reader) to Python type."""
    if not val:
        return None
    try:
        if ftype in ('N', 'F', 'B', 'Y'):
            return Decimal(val)
        if ftype == 'I':
            return int(val)
        if ftype == 'D':
            return datetime.strptime(val, '%Y%m%d').date()
        if ftype == 'L':
            return val.upper() in ('T', 'Y', '1')
    except (ValueError, InvalidOperation):
        return None
    return sanitize_str(val)


def iter_records(filepath, fields, header_size, record_size):
    """Yield one dict (pg_name → value) per non-deleted record."""

    # ── Try dbfread (best) ────────────────────────────────────────────────
    try:
        from dbfread import DBF
        table = DBF(filepath, encoding='cp1252', ignore_missing_memofile=True)

        # dbfread sometimes normalizes/truncates field names internally,
        # so its dict keys can differ from our own header-parsed names
        # (e.g. 'INVNOEbG' → dbfread key 'invno'). Name-based lookups then
        # silently miss and every value comes through as None.
        #
        # Fix: map dbfread's field order to OUR fields list by POSITION,
        # since both read the same DBF header and preserve field order.
        dbfread_field_names = [f.name for f in table.fields]

        if len(dbfread_field_names) != len(fields):
            log.warning(
                f"    Field count mismatch: dbfread={len(dbfread_field_names)} "
                f"vs header={len(fields)} for {filepath} — falling back to "
                f"name-based mapping (may produce nulls)"
            )
            position_map = None
        else:
            # position_map[i] = our field info for dbfread's i-th field
            position_map = fields

        for rec in table:
            row = {}
            if position_map is not None:
                for i, (k, v) in enumerate(rec.items()):
                    field_info = position_map[i]
                    row[field_info['pg_name']] = coerce_native(v, field_info['type'])
            else:
                field_map = {f['dbf_name'].upper(): f for f in fields}
                for k, v in rec.items():
                    field_info = field_map.get(k.upper(), {'pg_name': pg_name(k), 'type': 'C'})
                    row[field_info['pg_name']] = coerce_native(v, field_info['type'])
            yield row
        return
    except ImportError:
        pass

    # ── Fallback: manual binary reader ────────────────────────────────────
    try:
        with open(filepath, 'rb') as f:
            f.seek(header_size)
            while True:
                raw = f.read(record_size)
                if not raw or len(raw) < record_size:
                    break
                if raw[0] == 0x2A:
                    continue
                row = {}
                offset = 1
                for field in fields:
                    chunk = raw[offset:offset + field['length']]
                    try:
                        val = chunk.decode('cp1252', errors='ignore').strip()
                    except Exception:
                        val = ''
                    row[field['pg_name']] = coerce_raw(val, field['type'])
                    offset += field['length']
                yield row
    except Exception as e:
        log.warning(f"    Binary read error {filepath}: {e}")


# ── PostgreSQL Table Management ───────────────────────────────────────────────

def get_connection():
    import psycopg2
    return psycopg2.connect(
        host=DB_HOST, port=int(DB_PORT), dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
        connect_timeout=10,
    )


def ensure_meta_schema(conn):
    """Create raw + sync_meta schemas and tracking tables."""
    with conn.cursor() as cur:
        for schema in ('raw', 'sync_meta'):
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema};")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS sync_meta.sync_log (
                id              SERIAL PRIMARY KEY,
                source_folder   TEXT NOT NULL,
                table_name      TEXT NOT NULL,
                started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                ended_at        TIMESTAMPTZ,
                rows_written    INTEGER DEFAULT 0,
                status          TEXT DEFAULT 'running',
                error_msg       TEXT,
                file_hash       TEXT
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sync_meta.file_state (
                source_folder TEXT NOT NULL,
                table_name    TEXT NOT NULL,
                file_path     TEXT NOT NULL,
                file_hash     TEXT,
                last_synced   TIMESTAMPTZ,
                row_count     INTEGER,
                PRIMARY KEY (source_folder, table_name)
            );
        """)
    conn.commit()


def create_raw_table(conn, source_folder, table_name, fields):
    """
    Create raw.<source>_<table> if it doesn't exist.
    If it exists, ALTER TABLE to add any new columns.
    Returns the full qualified table name string.
    """
    def _bare(n):
        import re as _r
        s = _r.sub(r'[^a-zA-Z0-9_]', '_', str(n).lower()).strip('_')
        return s or 't'
    pg_table = f"raw.{_bare(source_folder)}_{_bare(table_name)}"

    meta_cols = [
        "_sync_id       BIGSERIAL",
        "_source_folder TEXT    NOT NULL",
        "_source_table  TEXT    NOT NULL",
        "_synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()",
        "_row_hash      TEXT",
    ]
    data_cols = [f"{f['pg_name']}  {f['pg_type']}" for f in fields]
    all_col_defs = meta_cols + data_cols
    col_str = ",\n            ".join(all_col_defs)

    with conn.cursor() as cur:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS {pg_table} (
                {col_str}
            );
        """)
        # Add any new columns that may have appeared since last sync
        for field in fields:
            cur.execute(f"""
                DO $$ BEGIN
                    ALTER TABLE {pg_table}
                    ADD COLUMN IF NOT EXISTS {field['pg_name']} {field['pg_type']};
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;
            """)
        # Index for fast per-folder queries
        idx = f"idx_{_bare(source_folder)}_{_bare(table_name)}_src"
        cur.execute(f"""
            CREATE INDEX IF NOT EXISTS {idx}
            ON {pg_table} (_source_folder, _source_table);
        """)
    conn.commit()
    return pg_table


def bulk_insert(conn, pg_table, fields, source_folder, table_name, record_iter):
    """
    Delete all existing rows for this source+table, then bulk insert fresh.
    Returns total rows inserted.
    """
    import psycopg2.extras

    pg_cols  = [f['pg_name'] for f in fields]
    all_cols = ['_source_folder', '_source_table', '_row_hash'] + pg_cols
    inserted = 0

    with conn.cursor() as cur:
        cur.execute(
            f"DELETE FROM {pg_table} WHERE _source_folder=%s AND _source_table=%s",
            (source_folder, table_name)
        )

        batch = []
        first_row_checked = False
        seen_hashes = set()
        duplicates_skipped = 0

        for rec in record_iter:
            row_vals = {col: rec.get(col) for col in pg_cols}

            if not first_row_checked:
                first_row_checked = True
                non_null_count = sum(1 for v in row_vals.values() if v is not None)
                if non_null_count == 0 and len(pg_cols) > 0:
                    log.warning(
                        f"    ⚠  SANITY CHECK FAILED: first row of {table_name} "
                        f"is 100% NULL across {len(pg_cols)} columns. "
                        f"This usually means dbfread's field names don't match "
                        f"the header-parsed names. Data may not be importing correctly."
                    )

            row_hash = hashlib.md5(
                json.dumps(row_vals, default=str, sort_keys=True).encode()
            ).hexdigest()[:16]

            # Skip exact-duplicate records yielded within this same read pass.
            # Some DBF files (this ERP in particular) cause dbfread to yield
            # the same physical record more than once — likely due to NTX
            # index artifacts or deleted-record markers being re-read.
            # Since a true duplicate matches on EVERY business column, this
            # is safe: two genuinely different line items would never hash
            # identically.
            if row_hash in seen_hashes:
                duplicates_skipped += 1
                continue
            seen_hashes.add(row_hash)

            row = (source_folder, table_name, row_hash) + tuple(
                row_vals.get(col) for col in pg_cols
            )
            batch.append(row)

            if len(batch) >= BATCH_SIZE:
                psycopg2.extras.execute_values(
                    cur,
                    f"INSERT INTO {pg_table} ({','.join(all_cols)}) VALUES %s",
                    batch,
                )
                inserted += len(batch)
                batch = []

        if batch:
            psycopg2.extras.execute_values(
                cur,
                f"INSERT INTO {pg_table} ({','.join(all_cols)}) VALUES %s",
                batch,
            )
            inserted += len(batch)

    conn.commit()
    if duplicates_skipped > 0:
        log.info(
            f"    ℹ  {table_name}: skipped {duplicates_skipped} exact-duplicate "
            f"record(s) from source DBF (kept {inserted} unique rows)"
        )
    return inserted


def is_file_unchanged(conn, source_folder, table_name, new_hash):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT file_hash FROM sync_meta.file_state "
            "WHERE source_folder=%s AND table_name=%s",
            (source_folder, table_name)
        )
        row = cur.fetchone()
    return row is not None and row[0] == new_hash


def save_file_state(conn, source_folder, table_name, filepath, file_hash, row_count):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO sync_meta.file_state
                (source_folder, table_name, file_path, file_hash, last_synced, row_count)
            VALUES (%s, %s, %s, %s, now(), %s)
            ON CONFLICT (source_folder, table_name)
            DO UPDATE SET file_hash=EXCLUDED.file_hash,
                          file_path=EXCLUDED.file_path,
                          last_synced=now(),
                          row_count=EXCLUDED.row_count;
        """, (source_folder, table_name, str(filepath), file_hash, row_count))
    conn.commit()


# ── Sync One Table ────────────────────────────────────────────────────────────

def sync_table(conn, source_folder, table_name, filepath, mode):
    log_id = None
    try:
        file_hash = get_file_hash(str(filepath))

        if mode == 'incremental' and is_file_unchanged(conn, source_folder, table_name, file_hash):
            log.info(f"  ⏭  {source_folder}/{table_name:<16} unchanged")
            return 0, 'skipped'

        # Open sync log
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO sync_meta.sync_log (source_folder, table_name, file_hash) "
                "VALUES (%s,%s,%s) RETURNING id",
                (source_folder, table_name, file_hash)
            )
            log_id = cur.fetchone()[0]
        conn.commit()

        fields, rec_count, hdr_size, rec_size = read_dbf_schema(str(filepath))
        if not fields:
            raise ValueError("DBF header returned no fields")

        pg_table = create_raw_table(conn, source_folder, table_name, fields)
        records  = iter_records(str(filepath), fields, hdr_size, rec_size)
        inserted = bulk_insert(conn, pg_table, fields, source_folder, table_name, records)

        save_file_state(conn, source_folder, table_name, filepath, file_hash, inserted)

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE sync_meta.sync_log "
                "SET ended_at=now(), rows_written=%s, status='success' WHERE id=%s",
                (inserted, log_id)
            )
        conn.commit()

        log.info(f"  ✅  {source_folder}/{table_name:<16} {inserted:>7,} rows → {pg_table}")
        return inserted, 'success'

    except Exception as e:
        log.error(f"  ❌  {source_folder}/{table_name}: {e}")
        if log_id:
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE sync_meta.sync_log "
                        "SET ended_at=now(), status='error', error_msg=%s WHERE id=%s",
                        (str(e), log_id)
                    )
                conn.commit()
            except Exception:
                conn.rollback()
        return 0, 'error'


# ── Main ──────────────────────────────────────────────────────────────────────

def run_sync(mode='incremental', filter_table=None):
    log.info("=" * 62)
    log.info("  ERP Sync Engine  —  Phase 2")
    log.info(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  |  mode={mode}")
    log.info("=" * 62)

    try:
        conn = get_connection()
        log.info(f"Connected → {DB_HOST}:{DB_PORT}/{DB_NAME}")
    except Exception as e:
        log.error(f"PostgreSQL connection failed: {e}")
        log.error("Fix DB_HOST / DB_USER / DB_PASSWORD in .env or CONFIG block")
        sys.exit(1)

    ensure_meta_schema(conn)

    # Collect all DBF files per folder
    queue = []
    for source_code, folder_path in ERP_FOLDERS.items():
        folder = Path(folder_path)
        if not folder.exists():
            log.warning(f"Folder not found, skipping: {folder_path}")
            continue
        dbf_map = {}
        for p in list(folder.glob("*.DBF")) + list(folder.glob("*.dbf")):
            dbf_map[p.stem.upper()] = p

        # Priority tables first
        ordered = []
        for t in PRIORITY_TABLES:
            if t in dbf_map:
                ordered.append((source_code, t, dbf_map[t]))
        for t, path in sorted(dbf_map.items()):
            if t not in PRIORITY_TABLES and t not in SKIP_TABLES:
                ordered.append((source_code, t, path))
        queue.extend(ordered)

    if filter_table:
        queue = [(s, t, p) for s, t, p in queue if t.upper() == filter_table.upper()]
        if not queue:
            log.error(f"Table '{filter_table}' not found in any configured folder.")
            sys.exit(1)

    log.info(f"Tables in queue: {len(queue)}")
    log.info("")

    totals = {'synced': 0, 'skipped': 0, 'errors': 0, 'rows': 0}
    for source_code, table_name, filepath in queue:
        rows, status = sync_table(conn, source_code, table_name, filepath, mode)
        totals[{'success':'synced','skipped':'skipped','error':'errors'}[status]] += 1
        totals['rows'] += rows

    conn.close()

    log.info("")
    log.info("=" * 62)
    log.info("  SYNC COMPLETE")
    log.info(f"  Synced   : {totals['synced']} tables")
    log.info(f"  Skipped  : {totals['skipped']} tables  (no changes detected)")
    log.info(f"  Errors   : {totals['errors']} tables  (check logs/)")
    log.info(f"  Rows     : {totals['rows']:,} total inserted")
    log.info("=" * 62)
    if totals['errors']:
        log.warning(f"  ⚠  {totals['errors']} error(s) — review logs/ folder")
    log.info("")
    log.info("  Next step → Phase 3: Data Warehouse (fact/dim tables)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ERP DBF → PostgreSQL Sync")
    parser.add_argument("--mode", choices=["full", "incremental"], default="incremental",
                        help="full=reimport all; incremental=only changed files")
    parser.add_argument("--table", default=None,
                        help="Sync only one table, e.g. --table SALES1")
    args = parser.parse_args()
    run_sync(mode=args.mode, filter_table=args.table)