# Phase 4 — FastAPI Backend

## What This Builds

A REST API that sits on top of your verified `warehouse.*` views and
tables, ready to be consumed by a web dashboard (Phase 5) or mobile
app (Phase 6).

Runs on the **same Windows machine** as PostgreSQL — no separate
server needed for now. Anyone on your office network can reach it
once it's running.

---

## Files

| File | Purpose |
|---|---|
| `main.py` | FastAPI app — all the dashboard endpoints |
| `database.py` | PostgreSQL connection pool |
| `requirements.txt` | Python packages needed |
| `.env.example` | Copy to `.env`, fill in your DB password |

---

## Step 1 — Install dependencies

```bash
pip install -r requirements.txt
```

---

## Step 2 — Configure

Copy `.env.example` to `.env` in the same folder as `main.py`, and use
the **same credentials** as your Phase 2 `.env`:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=erp_warehouse
DB_USER=erp_sync
DB_PASSWORD=your_actual_password
```

---

## Step 3 — Run it

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Database connection pool initialized
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

`--host 0.0.0.0` means other devices on your network can reach it too
(not just this machine). `--reload` auto-restarts the server when you
edit the code — useful during development, remove it for daily use.

---

## Step 4 — Test it

Open your browser to:

```
http://localhost:8000/docs
```

This is **Swagger UI** — an interactive page listing every endpoint.
Click any endpoint → "Try it out" → "Execute" → see real data come
back immediately. No need to write any test code.

Quick checks to try first:
- `GET /health` — confirms the API can reach PostgreSQL
- `GET /dashboard/overview` — company-level summary
- `GET /customers/top` — top customers by purchase value
- `GET /products/top` — best-selling products

---

## Available Endpoints

### Management Dashboard
| Endpoint | Returns |
|---|---|
| `GET /dashboard/overview` | Revenue, invoices, receivables per company |
| `GET /dashboard/today-sales` | Today's invoice count & revenue |
| `GET /dashboard/monthly-sales` | Month-over-month trend |
| `GET /dashboard/sales-summary` | Daily sales, filterable by date range |

### Customer Dashboard
| Endpoint | Returns |
|---|---|
| `GET /customers/top` | Ranked by total purchases |
| `GET /customers/receivables` | Who owes money, highest first |
| `GET /customers/ltv` | Lifetime value, avg order value |
| `GET /customers/{ledger_code}` | Single customer profile |

### Product Dashboard
| Endpoint | Returns |
|---|---|
| `GET /products/top` | Best sellers by revenue |
| `GET /products/slow-moving` | No sales in 90+ days |
| `GET /products/{item_code}` | Single product profile |

### Finance Dashboard
| Endpoint | Returns |
|---|---|
| `GET /finance/cash-flow` | Daily debit/credit movement |
| `GET /finance/transactions` | Transaction list, filterable by ledger |

### Inventory Dashboard
| Endpoint | Returns |
|---|---|
| `GET /inventory/items` | Item master, filterable by group |

### Drill-down
| Endpoint | Returns |
|---|---|
| `GET /sales/invoice/{invoice_no}` | Full invoice — header + line items |

---

## Filtering — every endpoint supports `source_folder`

Since your data spans 3 ERP folders (`ZF2526`, `ZF2627`, `ZFN2526`),
every endpoint accepts an optional `source_folder` query parameter:

```
GET /dashboard/overview?source_folder=ZF2526
GET /customers/top?source_folder=ZF2627&limit=10
```

Omit it to get combined data across all 3 folders.

---

## Example: calling from outside the browser

```bash
curl http://localhost:8000/dashboard/overview
curl "http://localhost:8000/customers/top?limit=5"
curl "http://localhost:8000/sales/invoice/263?source_folder=ZF2526"
```

These same URLs work from any device on your network — replace
`localhost` with this machine's IP address (find it with `ipconfig`
on Windows, look for "IPv4 Address").

---

## Running it permanently (so it survives reboots)

For now, manual start is fine for testing. When you're ready for daily
production use, options include:
- **NSSM** (Non-Sucking Service Manager) — wraps the uvicorn command
  as a real Windows Service that auto-starts on boot
- **Windows Task Scheduler** — trigger "At startup", action runs the
  uvicorn command
- Keep a terminal window open and minimized (simplest, but stops if
  the machine restarts)

We can set this up properly once you're ready to go live.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `Database unavailable` on `/health` | Check `.env` password matches PostgreSQL |
| `Connection refused` | PostgreSQL service not running |
| Port 8000 already in use | Add `--port 8001` (or any free port) |
| Other devices can't reach it | Check Windows Firewall allows the port |

---

## Next Phase

**Phase 5 — Web Dashboard (Next.js)**

Once you've confirmed a few endpoints return real data via `/docs`,
we'll build the actual dashboard UI that calls these endpoints and
renders charts, tables, and summary cards.
