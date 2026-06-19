import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
try:
    conn = psycopg2.connect(
        host=os.environ.get('DB_HOST', '127.0.0.1'),
        port=int(os.environ.get('DB_PORT', '5432')),
        user=os.environ.get('DB_USER', 'erp_sync'),
        password=os.environ.get('DB_PASSWORD', 'Erpsync@2026'),
        database='erp_warehouse'
    )
    print('✓ Connected to PostgreSQL as erp_sync')
    print('✓ Connection to erp_warehouse successful')
    cur = conn.cursor()
    cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('raw', 'staging', 'warehouse', 'sync_meta')")
    schemas = [row[0] for row in cur.fetchall()]
    print(f'✓ Schemas found: {", ".join(schemas) if schemas else "None - need setup"}')
    conn.close()
except Exception as e:
    print(f'✗ Connection failed: {e}')
    print('Check: 1) PostgreSQL running 2) erp_sync user exists 3) Password is Erpsync@2026')
