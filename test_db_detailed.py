import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

host = os.environ.get('DB_HOST', '127.0.0.1')
port = os.environ.get('DB_PORT', '5432')
user = os.environ.get('DB_USER', 'erp_sync')
password = os.environ.get('DB_PASSWORD', 'Erpsync@2026')
database = os.environ.get('DB_NAME', 'erp_warehouse')

print(f"Attempting connection:")
print(f"  Host: {host}")
print(f"  Port: {port}")
print(f"  User: {user}")
print(f"  Password: {password}")
print(f"  Database: {database}")
print()

try:
    conn = psycopg2.connect(
        host=host,
        port=int(port),
        user=user,
        password=password,
        database=database,
        connect_timeout=5
    )
    print('✓ SUCCESS! Connected to erp_warehouse as erp_sync')
    
    cur = conn.cursor()
    cur.execute("SELECT version()")
    version = cur.fetchone()[0]
    print(f'✓ PostgreSQL: {version}')
    
    cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('raw', 'staging', 'warehouse', 'sync_meta') ORDER BY schema_name")
    schemas = [row[0] for row in cur.fetchall()]
    print(f'✓ Schemas available: {", ".join(schemas)}')
    
    conn.close()
except Exception as e:
    print(f'✗ Connection FAILED: {e}')
    print(f'  Error type: {type(e).__name__}')
