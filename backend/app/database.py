import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# Backend root (the directory containing the `app` package). A relative
# MYSQL_SSL path is resolved against this, so the cert can live next to the
# code and be found no matter what CWD the server/alembic is launched from.
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def build_database_url() -> tuple[str, dict]:
    """Return the SQLAlchemy URL and ``connect_args`` for the engine.

    When ``MYSQL_HOST`` is set, the connection is assembled from the discrete
    ``MYSQL_*`` settings (host/port/user/password/database) and, if
    ``MYSQL_SSL`` points at a CA certificate, TLS is enabled with that cert.
    Otherwise we fall back to ``DATABASE_URL`` — used by local dev and the
    sqlite-backed test suite.
    """
    host = os.getenv("MYSQL_HOST")
    if host:
        user = quote_plus(os.getenv("MYSQL_USER", ""))
        password = quote_plus(os.getenv("MYSQL_PASSWORD", ""))
        port = os.getenv("MYSQL_PORT", "3306")
        database = os.getenv("MYSQL_DATABASE", "sales_billing")
        url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"

        connect_args: dict = {}
        ssl_ca = os.getenv("MYSQL_SSL")
        if ssl_ca:
            # join() keeps ssl_ca as-is if it's already absolute.
            ssl_ca = os.path.normpath(os.path.join(_BACKEND_ROOT, ssl_ca))
            connect_args["ssl"] = {"ca": ssl_ca}
        return url, connect_args

    url = os.getenv(
        "DATABASE_URL", ""
    )
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return url, connect_args


DATABASE_URL, _connect_args = build_database_url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
