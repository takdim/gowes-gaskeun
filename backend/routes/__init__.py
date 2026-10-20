"""Registrasi semua blueprint."""
from .admin import admin_bp
from .auth import auth_bp
from .dev import dev_bp
from .live import live_bp
from .public import public_bp
from .user import user_bp

__all__ = ["register_blueprints"]


def register_blueprints(app):
    """Daftarkan seluruh blueprint ke app Flask."""
    for bp in (public_bp, auth_bp, user_bp, live_bp, admin_bp, dev_bp):
        app.register_blueprint(bp)
