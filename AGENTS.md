# AGENTS.md

## Cursor Cloud specific instructions

Monorepo: `backend/` (FastAPI + SQLAlchemy + Alembic, MySQL, Azure AD auth) and
`frontend/` (React 19 + Vite 7 + TanStack Router/Query). See `README.md` for the
canonical install/run commands; the notes below only cover non-obvious cloud caveats.

### Environment already provisioned by the update script
- Backend deps live in a venv at `backend/.venv` (the update script creates it and
  installs `backend/requirements-dev.txt`). Activate with `source backend/.venv/bin/activate`.
- Frontend deps are installed via `npm ci` in `frontend/` (`.npmrc` already sets
  `legacy-peer-deps=true`; don't drop that flag or installs fail on peer deps).
- System packages installed once in the VM image (NOT in the update script):
  `python3.12-venv` (needed for the venv) and `mariadb-server` (local MySQL for
  running the backend). These persist via the VM snapshot.

### Env files (gitignored — recreate if missing)
- Backend: `cp backend/example.env backend/.env`. The app reads `AZURE_*` +
  `JWT_AUDIENCE` **at import time**, so they must be set (dummy GUIDs are fine just
  to import/run; real Azure AD is only needed to validate real tokens). For a local
  MySQL run set the discrete `MYSQL_*` vars (when `MYSQL_HOST` is set they take
  precedence over `DATABASE_URL`) and leave `MYSQL_SSL` **empty** (the default
  `certs/` enables TLS and breaks local non-TLS MySQL).
- Frontend: `cp frontend/.env.example frontend/.env` (dummy `VITE_*` GUIDs are fine
  for dev/build).

### Running the services
- Backend (real server): `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`.
  Docs at `/docs` only when `DEBUG=true` in `.env`. Every router requires a valid
  Azure-AD bearer token, so unauthenticated requests return 401 — that's expected.
- Frontend: `cd frontend && npm run dev` (Vite on http://localhost:5173). Use
  `localhost`, not `127.0.0.1`, to match the MSAL redirect URI.
- Local MySQL: start with `sudo mariadbd-safe &` if not already running
  (`sudo mysqladmin ping` to check).

### Database gotcha (important)
- The schema is split: a base `acquirewc_dev` schema (~40 tables) is provisioned
  out-of-band and its SQL is **NOT in this repo**; Alembic only manages the CRM
  extension tables. So `alembic upgrade head` against a fresh DB fails (missing base
  tables that FKs reference). For a local dev DB, create the full schema directly
  from the models instead:
  `cd backend && source .venv/bin/activate && python -c "from app.database import engine, Base; import app.models; Base.metadata.create_all(engine)"`.
  This works on MySQL (the `YEAR` / `ON UPDATE CURRENT_TIMESTAMP` columns are
  MySQL-native).

### Tests / lint / build (CI = `.github/workflows/ci.yml`)
- Backend tests are fully self-contained (in-memory SQLite + mocked Azure/MSAL, see
  `backend/tests/conftest.py`) — no MySQL or network needed: `cd backend && source .venv/bin/activate && pytest`.
- Frontend: `npm run lint`, `npm run typecheck`, `npm run test` (vitest), `npm run build`.
  `typecheck`/`build` need `src/routeTree.gen.ts`, which is **generated** by the
  TanStack Router Vite plugin on `npm run dev`/`npm run build` and is gitignored —
  run a build first or typecheck will report "Cannot find module './routeTree.gen'".

### Auth bypass for local API exercise
- There is no production auth bypass. To exercise endpoints over HTTP locally
  without a real Entra tenant, wrap the app and override the `verify_token`
  dependency (the same pattern `tests/conftest.py` uses), e.g. a small throwaway
  `uvicorn` runner that sets `app.dependency_overrides[verify_token]`.
