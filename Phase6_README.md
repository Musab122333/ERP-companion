# Phase 6 — Automated Nightly Sync

## What This Does

Runs the entire pipeline automatically every night after 10 PM:
1. **Phase 2** — syncs any changed DBF files into PostgreSQL (`raw.*`)
2. **Phase 3** — rebuilds the warehouse (`dim_*`, `fact_*`, all 9 views)

No manual intervention needed. You check the log file each morning
(optional) to confirm it ran cleanly.

---

## Files

| File | Purpose |
|---|---|
| `nightly_sync.bat` | The script Task Scheduler will run |

---

## Step 1 — Place the script

Copy `nightly_sync.bat` into `E:\demo` (same folder as
`phase2_sync_engine.py` and the 3 Phase 3 SQL files).

## Step 2 — Edit the CONFIG section at the top

Open `nightly_sync.bat` in Notepad and check these match your setup:

```batch
set DEMO_DIR=E:\demo
set PSQL_PATH="C:\Program Files\PostgreSQL\16\bin\psql.exe"
set DB_NAME=erp_warehouse
set DB_USER=erp_sync
set DB_HOST=localhost
set DB_PORT=5432
```

**To find your exact PostgreSQL version/path:** open File Explorer,
go to `C:\Program Files\PostgreSQL\`, and check the folder name
(e.g. `15`, `16`, `17`) — update `PSQL_PATH` to match.

## Step 3 — Test it manually first

Before scheduling it, run it once by hand to confirm it works:

```bash
cd E:\demo
nightly_sync.bat
```

Check the new file created in `E:\demo\logs\nightly_*.log` — it should
end with:
```
============================================================
Nightly Sync Pipeline — COMPLETED SUCCESSFULLY at 22:15:03
============================================================
```

If it stopped early with `[ERROR]` or `[FATAL]`, the log tells you
exactly which step failed — fix that before scheduling.

## Step 4 — Schedule it with Windows Task Scheduler

1. Press `Win + R`, type `taskschd.msc`, press Enter
2. Click **"Create Task..."** (not "Create Basic Task" — we need more control)
3. **General tab:**
   - Name: `ERP Nightly Sync`
   - Select **"Run whether user is logged on or not"**
   - Check **"Run with highest privileges"**
4. **Triggers tab → New:**
   - Begin the task: **On a schedule**
   - Settings: **Daily**
   - Start time: **10:00:00 PM** (or any time after 10 PM you prefer)
   - Click OK
5. **Actions tab → New:**
   - Action: **Start a program**
   - Program/script: `E:\demo\nightly_sync.bat`
   - Start in (optional): `E:\demo`
   - Click OK
6. **Conditions tab:**
   - Uncheck "Start the task only if the computer is on AC power" if
     this is a desktop (not relevant for laptops on battery)
7. Click **OK** on the main dialog — it'll ask for your Windows
   password (needed since we selected "run whether logged on or not")

## Step 5 — Test the scheduled task immediately

Don't wait until tonight — verify it works right now:
1. In Task Scheduler, find "ERP Nightly Sync" in the task list
2. Right-click → **Run**
3. Wait ~1 minute, then check `E:\demo\logs\` for a new log file
4. Confirm it says "COMPLETED SUCCESSFULLY"

---

## Checking results each morning

Open `E:\demo\logs\` and look at the most recent `nightly_*.log` file.

**Healthy run looks like:**
```
[STEP 1] Running Phase 2 incremental sync...
[OK] Phase 2 sync completed successfully
[STEP 2] Rebuilding warehouse — dimension tables...
[OK] Dimension tables rebuilt
[STEP 3] Rebuilding warehouse — fact tables...
[OK] Fact tables rebuilt
[STEP 4] Rebuilding dashboard views...
[OK] Dashboard views rebuilt
Nightly Sync Pipeline — COMPLETED SUCCESSFULLY
```

**If something failed**, the log stops right after the failing step's
`[ERROR]` line — open the log and scroll to that point, the actual
Python or psql error output is captured right there too.

---

## Verifying Today's Sales updates correctly

The morning after your first scheduled run, check the dashboard's
Overview page — "Today's Sales" should now reflect real invoices
entered in the ERP yesterday (since the sync ran after 10 PM and
pulled in that day's data).

You can also verify directly in pgAdmin:
```sql
SELECT MAX(invoice_date) FROM warehouse.fact_sales;
```
This should now be very close to "yesterday" rather than a week-plus stale.

---

## Important: re-running the Phase 3 internal-account fix

Before relying on these nightly numbers, make sure you've re-run the
**updated** `01_dimension_tables.sql` and `03_dashboard_views.sql`
(the versions with the expanded internal-account exclusion list:
codes `01`, `02`, `2` added) at least once manually — the nightly
script will keep using whatever version of these files sits in
`E:\demo`, so the fix needs to be in place before the automation
takes over.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Log says "[FATAL] psql.exe not found" | Update `PSQL_PATH` to your actual PostgreSQL version folder |
| Log says "[FATAL] .env file not found" | Make sure `.env` (from Phase 2 setup) is in `E:\demo` |
| Task shows "Last Run Result: 0x1" in Task Scheduler | Open the log file — the batch script logs the real reason |
| Nightly log never gets created at all | Task Scheduler action path is wrong, or task isn't actually enabled — check "Last Run Time" in Task Scheduler |
| Works when run manually but not via Task Scheduler | Almost always a "Start in" folder issue — make sure it's set to `E:\demo` |

---

## Next Phase

**Phase 7 — Mobile App / Advanced Intelligence**

With nightly sync running reliably, the dashboard will always show
data that's at most ~1 day old. From here we can move to building
the mobile app (Phase 6 in the original blueprint) or start on
demand forecasting / anomaly detection (Phase 7).
