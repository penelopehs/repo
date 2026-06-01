from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.auth import settings
from app.routers import clients, leads, referral_channels, users

# NOTE: the database schema is owned by acquirewc_dev_schema.sql + the Alembic
# migration (crm extension). We deliberately do NOT call Base.metadata.create_all
# here — run `alembic upgrade head` to provision the crm_* tables.

app = FastAPI(title="Sales Billing API")

# Never combine a wildcard origin with credentials — it's an invalid/unsafe
# CORS configuration. Auth is bearer-token based, so credentials are only
# enabled when an explicit origin allowlist is configured.
allow_credentials = settings.cors_origins != ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(clients.router)
app.include_router(referral_channels.router)
app.include_router(leads.router)

# Serve the React frontend from backend/static (populated by the CI pipeline).
# The guard keeps the backend runnable locally without a frontend build.
STATIC_DIR = Path(__file__).parent.parent / "static"

if STATIC_DIR.exists():
    # Vite outputs compiled assets under assets/; mount them efficiently.
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="vite-assets")

    STATIC_ROOT = STATIC_DIR.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        # Resolve and confirm the target stays within STATIC_ROOT to prevent
        # path traversal (e.g. ../../etc/passwd) reading arbitrary files.
        file_path = (STATIC_ROOT / full_path).resolve()
        if file_path.is_file() and (file_path == STATIC_ROOT or STATIC_ROOT in file_path.parents):
            return FileResponse(file_path)
        return FileResponse(STATIC_ROOT / "index.html")
