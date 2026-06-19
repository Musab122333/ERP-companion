"""
database.py — PostgreSQL connection pool for the FastAPI backend.
"""

import os
from contextlib import contextmanager
import psycopg2
import psycopg2.extras
from psycopg2 import pool

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DB_HOST     = os.environ.get("DB_HOST",     "localhost")
DB_PORT     = os.environ.get("DB_PORT",     "5432")
DB_NAME     = os.environ.get("DB_NAME",     "erp_warehouse")
DB_USER     = os.environ.get("DB_USER",     "erp_sync")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "your_password_here")

MIN_CONN = 1
MAX_CONN = 10

_pool = None


def init_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            MIN_CONN, MAX_CONN,
            host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
            user=DB_USER, password=DB_PASSWORD,
        )
    return _pool


def close_pool():
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


@contextmanager
def get_db_cursor(commit=False):
    """
    Usage:
        with get_db_cursor() as cur:
            cur.execute("SELECT 1")
            rows = cur.fetchall()
    """
    p = init_pool()
    conn = p.getconn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        p.putconn(conn)


def fetch_all(query, params=None):
    with get_db_cursor() as cur:
        cur.execute(query, params or ())
        return cur.fetchall()


def fetch_one(query, params=None):
    with get_db_cursor() as cur:
        cur.execute(query, params or ())
        return cur.fetchone()
