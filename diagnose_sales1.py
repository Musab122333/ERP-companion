"""
Diagnostic script — run this on Windows in the same folder as phase2_sync_engine.py
It imports the REAL functions from your sync engine and traces exactly
what happens to SALES1 data, step by step.

Usage:
    python diagnose_sales1.py
"""

import sys
sys.path.insert(0, '.')

# Import the actual functions from your sync engine
from phase2_sync_engine import (
    read_dbf_schema, iter_records, pg_name, ERP_FOLDERS
)
from pathlib import Path

filepath = Path(ERP_FOLDERS["ZF2526"]) / "SALES1.DBF"
print(f"Testing file: {filepath}")
print(f"File exists: {filepath.exists()}")
print("=" * 70)

# Step 1: Read schema
fields, rec_count, hdr_size, rec_size = read_dbf_schema(str(filepath))
print(f"\n[STEP 1] read_dbf_schema()")
print(f"  Fields found    : {len(fields)}")
print(f"  Record count    : {rec_count}")
print(f"  First 3 fields  :")
for f in fields[:3]:
    print(f"    dbf_name={f['dbf_name']!r}  pg_name={f['pg_name']!r}  type={f['type']!r}")

# Step 2: Iterate records using the REAL iter_records function
print(f"\n[STEP 2] iter_records() — first 3 rows")
print("=" * 70)
count = 0
for row in iter_records(str(filepath), fields, hdr_size, rec_size):
    print(f"\nRow {count}:")
    # Show first 5 key-value pairs
    for i, (k, v) in enumerate(row.items()):
        if i >= 5:
            print(f"    ... ({len(row)} total fields)")
            break
        print(f"    {k!r} = {v!r}")
    count += 1
    if count >= 3:
        break

if count == 0:
    print("  *** iter_records() YIELDED ZERO ROWS — this is the bug ***")

print("\n" + "=" * 70)
print("DIAGNOSIS COMPLETE — paste this entire output back to Claude")