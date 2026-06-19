import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
try:
    conn = psycopg2.connect(
        host=os.environ.get('DB_HOST', 'localhost'),
        port=os.environ.get('DB_PORT', '5432'),
        user='postgres',
        password=os.environ.get('DB_PASSWORD_POSTGRES', 'postgres'),
        database='postgres'
    )
    print('✓ Connected to PostgreSQL as postgres')
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_user WHERE usename = 'erp_sync'")
    if cur.fetchone():
        print('✓ erp_sync user exists')
    else:
        print('✗ erp_sync user NOT found - need to run SQL setup')
    conn.close()
except Exception as e:
    print(f'✗ Connection failed: {e}')
    print('Ensure PostgreSQL is running on localhost:5432')
