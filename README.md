# Sales Billing CRM

A sales/billing CRM with a **FastAPI** backend (MySQL + Alembic, Azure AD auth)
and a **React 19 + Vite + TanStack** frontend.

```
backend/    FastAPI app, SQLAlchemy models, Alembic migrations
frontend/   React + Vite single-page app
```

---

## Backend

All commands run from `backend/`.

### 1. Create and activate a virtual environment

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
```

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
