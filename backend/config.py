"""Konfigurasi aplikasi — dibaca dari environment (.env)."""
import os

from dotenv import load_dotenv

load_dotenv()

_NEXT_URL = os.getenv("NEXT_URL", "http://localhost:3008")


class Config:
    """Semua setting backend dalam satu tempat."""

    SECRET_KEY = os.getenv("SECRET_KEY", "gowes-gaskeun-secret")
    DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/gowes_gaskeun")
    BACKEND_PORT = int(os.getenv("BACKEND_PORT", 5001))
    NEXT_URL = _NEXT_URL
    POSITION_RETENTION_HOURS = int(os.getenv("POSITION_RETENTION_HOURS", 24))
    ALLOWED_ORIGINS = list(dict.fromkeys([
        _NEXT_URL,
        "http://localhost:3008",
        "http://127.0.0.1:3008",
    ]))
