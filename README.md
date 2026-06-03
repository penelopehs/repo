# Sales Billing CRM

A sales/billing CRM with a **FastAPI** backend (MySQL + Alembic, Azure AD auth)
and a **React 19 + Vite + TanStack** frontend.

```
backend/    FastAPI app, SQLAlchemy models, Alembic migrations
frontend/   React + Vite single-page app
```

## Prerequisites

- **Python** 3.11+
- **Node** 20+ (see `frontend/package.json` → `engines`)
- **MySQL** 8.x running locally (or a reachable instance)
- An **Azure AD app registration** (for login + Microsoft Graph/SharePoint).
  You can run the backend without it, but authenticated routes will reject
  requests.

---

## Backend

All commands run from `backend/`.

### 1. Create and activate a virtual environment

```powershell
cd backend
python -m venv .venv
# PowerShell may block activation scripts; allow them for this session:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

> macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate`

### 2. Install dependencies

```powershell
pip install -r requirements.txt
pip install -r requirements-dev.txt   # optional: tests + tooling
```

### 3. Configure environment

```powershell
Copy-Item example.env .env
```

Then edit `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL, e.g. `mysql+pymysql://root:root@localhost:3306/sales_billing` |
| `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DATABASE` | When `MYSQL_HOST` is set these take precedence over `DATABASE_URL` |
| `MYSQL_SSL` | Path to a CA cert (PEM) for TLS; leave blank for non-TLS |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Azure AD app registration values |
| `JWT_AUDIENCE` | Expected audience claim for incoming tokens |
| `SHAREPOINT_HOSTNAME` / `SHAREPOINT_SITE_PATH` | SharePoint target for Graph calls |

Make sure the database named in your config exists:

```sql
CREATE DATABASE sales_billing;
```

### 4. Run migrations

The schema is owned by Alembic — the app does **not** auto-create tables.

```powershell
alembic upgrade head
```

### 5. Start the API

```powershell
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs

### Tests

```powershell
pytest
```

---

## Frontend

All commands run from `frontend/`.

### 1. Install dependencies

```powershell
cd frontend
npm install
```

### 2. Configure environment

```powershell
Copy-Item .env.example .env
```

Then edit `.env` (only `VITE_`-prefixed vars are exposed to the bundle):

| Variable | Purpose |
| --- | --- |
| `VITE_AZURE_CLIENT_ID` | Application (client) ID from the app registration |
| `VITE_AZURE_TENANT_ID` | Directory (tenant) ID |
| `VITE_API_SCOPE` | Exposed API scope, e.g. `api://<client-id>/access_as_user` |
| `VITE_API_BASE_URL` | Backend base URL, e.g. `http://localhost:8000` |

### 3. Start the dev server

```powershell
npm run dev
```

Vite serves the app at http://localhost:5173.

### Other scripts

```powershell
npm run build      # production build → dist/
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier --write
```

---

## Running the full stack locally

1. Start MySQL and run `alembic upgrade head`.
2. In one terminal: `uvicorn app.main:app --reload --port 8000` (from `backend/`).
3. In another terminal: `npm run dev` (from `frontend/`).
4. Open http://localhost:5173. The frontend calls the backend at
   `VITE_API_BASE_URL`.

> **CORS:** the backend allowlists origins via its `cors_origins` setting. Make
> sure your frontend dev URL (`http://localhost:5173`) is allowed, otherwise
> browser requests will be blocked.

### Production note

The backend serves the compiled frontend from `backend/static/` when that
directory exists (populated by CI from the Vite build). For local development,
run the two servers separately as described above.
