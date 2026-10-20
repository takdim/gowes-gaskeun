"""
Gowes Gaskeun - Backend API + WebSocket
Critical Mass Makassar Community Platform

Entrypoint: membuat app Flask lalu mendaftarkan blueprint & socket handler.

Struktur modul:
    config.py      — setting dari environment (.env)
    extensions.py  — engine/SessionLocal/Base, socketio, db_available
    models.py      — model SQLAlchemy
    utils.py       — decorator auth & helper password
    sockets.py     — handler Socket.IO
    seed.py        — data contoh development
    routes/        — endpoint HTTP per domain (blueprint)
"""
import os

from flask import Flask
from flask_cors import CORS

from config import Config
from extensions import init_db, socketio
from routes import register_blueprints
from sockets import register_socket_handlers


def create_app():
    """Bangun instance Flask lengkap (CORS, socket, DB, routes)."""
    app = Flask(__name__)
    app.config["SECRET_KEY"] = Config.SECRET_KEY

    CORS(app, resources={r"/api/*": {"origins": Config.ALLOWED_ORIGINS}}, supports_credentials=True)

    socketio.init_app(
        app,
        cors_allowed_origins=Config.ALLOWED_ORIGINS,
        async_mode="geventwebsocket" if "GEVENT" in os.environ else None,
        ping_timeout=60,
        ping_interval=25,
    )

    init_db()
    register_blueprints(app)
    register_socket_handlers(socketio)
    return app


app = create_app()


if __name__ == "__main__":
    print(f"\n🚴 Gowes Gaskeun API running on port {Config.BACKEND_PORT}")
    print(f"   → http://localhost:{Config.BACKEND_PORT}\n")
    socketio.run(app, host="0.0.0.0", port=Config.BACKEND_PORT, debug=True, allow_unsafe_werkzeug=True)
