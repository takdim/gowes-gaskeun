"""Autentikasi: register, login, logout."""
import secrets

from flask import Blueprint, jsonify, request

from extensions import SessionLocal
from models import UserModel
from utils import hash_password, require_db, verify_password

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
@require_db
def api_register():
    """Register new user."""
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    display_name = data.get("displayName", "").strip()

    if not email or not password or not display_name:
        return jsonify({"error": "Email, password, dan nama wajib diisi"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password minimal 6 karakter"}), 400

    db = SessionLocal()
    try:
        existing = db.query(UserModel).filter_by(email=email).first()
        if existing:
            return jsonify({"error": "Email sudah terdaftar"}), 409

        user = UserModel(email=email, password_hash=hash_password(password), display_name=display_name)
        db.add(user)
        db.commit()

        token = secrets.token_urlsafe(32)
        response = jsonify({
            "id": user.id,
            "email": user.email,
            "displayName": user.display_name,
            "role": user.role,
            "token": token
        })
        response.set_cookie("session_token", token, httponly=True, samesite="lax")
        return response, 201
    finally:
        db.close()


@auth_bp.route("/login", methods=["POST"])
@require_db
def api_login():
    """Login user."""
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    db = SessionLocal()
    try:
        user = db.query(UserModel).filter_by(email=email).first()
        if not user or not verify_password(password, user.password_hash):
            return jsonify({"error": "Email atau password salah"}), 401

        # Generate simple session token
        token = secrets.token_urlsafe(32)
        # Store token in a simple way (in production, use JWT or proper sessions)
        response = jsonify({
            "id": user.id, "email": user.email,
            "displayName": user.display_name, "role": user.role,
            "token": token
        })
        response.set_cookie("session_token", token, httponly=True, samesite="lax")
        return response
    finally:
        db.close()


@auth_bp.route("/logout", methods=["POST"])
@require_db
def api_logout():
    """Logout user."""
    response = jsonify({"message": "Logged out"})
    response.delete_cookie("session_token")
    return response
