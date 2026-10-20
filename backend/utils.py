"""Decorator & helper bersama (auth, role, hash password)."""
from functools import wraps

import bcrypt
from flask import g, jsonify, request

from extensions import SessionLocal, db_available
from models import UserModel


def require_db(f):
    """Pastikan database tersedia sebelum route dijalankan."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not db_available:
            return jsonify({
                "error": "Database not configured",
                "detail": "Set up MySQL and update DATABASE_URL in backend/.env"
            }), 503
        return f(*args, **kwargs)
    return decorated


def require_auth(f):
    """Auth sederhana berbasis header `Authorization: Bearer <token>`."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401
        # Token dikirim dari localStorage oleh frontend; tidak ada cek cookie
        # karena request cross-origin (Next.js 3008 ↔ Flask 5001).
        token = auth_header[7:]
        if not token or len(token) < 4:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


def get_current_user():
    """Ambil `{id, role}` dari header `X-User-Id`, atau None kalau tidak ada/tidak dikenal."""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None

    db = SessionLocal()
    try:
        user = db.query(UserModel).get(user_id)
        if not user:
            return None
        return {"id": user.id, "role": user.role}
    finally:
        db.close()


def require_role(*roles):
    """Batasi endpoint ke role tertentu (ADMIN / TIKUM_COORDINATOR / USER).

    Identitas diambil dari header `X-User-Id` (lihat get_current_user).
    User yang lolos disimpan di `g.current_user`.
    """
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({"error": "User tidak dikenal"}), 401
            if user["role"] not in roles:
                return jsonify({"error": "Akses ditolak"}), 403
            g.current_user = user
            return f(*args, **kwargs)
        return decorated
    return decorator


def require_admin(f):
    """Hanya role ADMIN."""
    return require_role("ADMIN")(f)


def require_staff(f):
    """ADMIN atau TIKUM_COORDINATOR."""
    return require_role("ADMIN", "TIKUM_COORDINATOR")(f)


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password, hash_str):
    return bcrypt.checkpw(password.encode(), hash_str.encode())
