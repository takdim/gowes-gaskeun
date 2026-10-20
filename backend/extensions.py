"""Instance ekstensi & koneksi database yang dipakai bersama semua modul."""
import os

from flask_socketio import SocketIO
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import Config

# ── Database ────────────────────────────────────────────
engine = create_engine(Config.DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# ── Socket.IO ───────────────────────────────────────────
socketio = SocketIO(
    cors_allowed_origins=Config.ALLOWED_ORIGINS,
    async_mode="geventwebsocket" if "GEVENT" in os.environ else None,
    ping_timeout=60,
    ping_interval=25,
)

# Cek koneksi database sekali saat import.
try:
    _test_conn = engine.connect()
    _test_conn.close()
    db_available = True
except Exception:
    db_available = False


def init_db():
    """Buat tabel kalau database tersedia (tidak memblokir startup)."""
    import models  # noqa: F401  — pastikan model terdaftar di Base.metadata

    try:
        Base.metadata.create_all(engine)
        print("✅ Database tables ready")
    except Exception as e:
        print(f"⚠️  Database not available ({e}) — API calls will fail until MySQL is configured")
