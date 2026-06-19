# Phase 1 — ERP Discovery & Data Dictionary

## What This Does

Scans all your DBF folders and produces:

| Output File | Contents |
|---|---|
| `data_dictionary.xlsx` | Full schema, field types, sample rows, relationship map |
| `discovery_report.json` | Machine-readable schema for Phase 2 Sync Engine |

---

## Setup (One Time)

Open Command Prompt or PowerShell on your Windows machine:

```bash
pip install dbfread openpyxl pandas
```

> `dbfread` is the best Python DBF reader. If it fails to install, the script
> will fall back to a built-in reader.

---

## Configure Paths

Open `phase1_discovery.py` and edit the top section:

```python
ERP_ROOT_FOLDERS = [
    r"D:\FA\ZF2526",
    r"D:\FA\ZF2627",
    r"D:\FA\ZFACA2627",
    r"D:\FA\ZFN2526",
    # Add any other folders
]

OUTPUT_DIR = r"C:\ERP_Discovery"   # Where reports will be saved
SAMPLE_ROWS = 5                    # Rows to capture per table
```

---

## Run

```bash
python phase1_discovery.py
```

Expected console output:

```
============================================================
  ERP Discovery Tool — Phase 1
  2025-06-10 09:00:00
============================================================

📂 Scanning: D:\FA\ZF2526
  → Reading ITEM ... 1,240 records, 18 fields ✓
  → Reading MASTER ... 3,892 records, 14 fields ✓
  → Reading SALES1 ... 48,200 records, 12 fields ✓
  → Reading SALES2 ... 182,400 records, 8 fields ✓
  → Reading TRANS ... 94,600 records, 10 fields ✓

📂 Scanning: D:\FA\ZF2627
  ...

🔍 Analysing relationships across 20 tables ...
   Found 8 shared fields (potential join keys)

📊 Building Excel data dictionary ...
✅  Excel report saved: C:\ERP_Discovery\data_dictionary.xlsx

📄 Building JSON schema report ...
✅  JSON report saved:  C:\ERP_Discovery\discovery_report.json
```

---

## Excel Report — Sheets Explained

| Sheet | Contents |
|---|---|
| **Summary** | All tables across all folders — record counts, sizes |
| **Field Dictionary** | Every field in every table with type and known meaning |
| **Relationship Map** | Shared fields that are likely JOIN keys |
| **ZF2627_SALES1** (etc.) | Sample rows per table |

---

## After Running

1. Open `data_dictionary.xlsx` and review
2. Fill in the **"Likely Meaning"** column for unknown fields
3. Share `discovery_report.json` — this feeds directly into Phase 2

---

## Next Phase

Phase 2 — Python Sync Engine (DBF → PostgreSQL)

The sync engine will use `discovery_report.json` to automatically
create PostgreSQL tables and import all records.
