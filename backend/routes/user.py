"""Endpoint user: kehadiran (attendance), profil, riwayat."""
from flask import Blueprint, jsonify, request

from extensions import SessionLocal
from models import AttendanceModel, EventModel, TikumModel, UserModel
from utils import require_auth, require_db

user_bp = Blueprint("user", __name__, url_prefix="/api")


@user_bp.route("/attendance", methods=["POST"])
@require_db
@require_auth
def api_attendance():
    """Register attendance for event."""
    data = request.get_json()
    event_id = data.get("eventId")
    tikum_id = data.get("tikumId")

    if not event_id:
        return jsonify({"error": "event_id diperlukan"}), 400

    db = SessionLocal()
    try:
        # Extract user id from auth context (simplified)
        user_id = request.headers.get("X-User-Id")
        if not user_id:
            return jsonify({"error": "User ID diperlukan"}), 400

        existing = db.query(AttendanceModel).filter_by(event_id=event_id, user_id=user_id).first()
        if existing:
            if "tikumId" in data:
                existing.tikum_id = tikum_id
                db.commit()
            return jsonify({"id": existing.id, "status": existing.status, "tikumId": existing.tikum_id}), 200

        att = AttendanceModel(event_id=event_id, user_id=user_id, tikum_id=tikum_id)
        db.add(att)
        db.commit()

        return jsonify({"id": att.id, "status": att.status, "tikumId": att.tikum_id}), 201
    finally:
        db.close()


@user_bp.route("/attendance/<att_id>", methods=["PATCH"])
@require_db
@require_auth
def api_update_attendance(att_id):
    """Update attendance status or change Tikum."""
    data = request.get_json()
    db = SessionLocal()
    try:
        att = db.query(AttendanceModel).get(att_id)
        if not att:
            return jsonify({"error": "Tidak ditemukan"}), 404

        if "status" in data:
            att.status = data["status"]
        if "tikumId" in data:
            att.tikum_id = data["tikumId"]

        db.commit()
        return jsonify({"id": att.id, "status": att.status})
    finally:
        db.close()


@user_bp.route("/users/profile", methods=["GET"])
@require_db
@require_auth
def api_get_profile():
    """Get current user profile."""
    user_id = request.headers.get("X-User-Id")
    db = SessionLocal()
    try:
        user = db.query(UserModel).get(user_id)
        if not user:
            return jsonify({"error": "User tidak ditemukan"}), 404
        return jsonify({
            "id": user.id, "email": user.email,
            "displayName": user.display_name, "avatarUrl": user.avatar_url,
            "role": user.role
        })
    finally:
        db.close()


@user_bp.route("/users/<user_id>", methods=["GET"])
@require_db
def api_get_public_user(user_id):
    """Ambil data profil publik pengguna lain (nama, avatar, role, tanggal gabung)."""
    db = SessionLocal()
    try:
        user = db.query(UserModel).get(user_id)
        if not user:
            return jsonify({"error": "User tidak ditemukan"}), 404
        return jsonify({
            "id": user.id,
            "displayName": user.display_name,
            "avatarUrl": user.avatar_url,
            "role": user.role,
            "createdAt": user.created_at.isoformat(),
        })
    finally:
        db.close()


@user_bp.route("/users/profile", methods=["PUT"])
@require_db
@require_auth
def api_update_profile():
    """Update current user profile."""
    data = request.get_json()
    user_id = request.headers.get("X-User-Id")
    db = SessionLocal()
    try:
        user = db.query(UserModel).get(user_id)
        if not user:
            return jsonify({"error": "User tidak ditemukan"}), 404
        if "displayName" in data:
            user.display_name = data["displayName"]
        if "avatarUrl" in data:
            user.avatar_url = data["avatarUrl"]
        db.commit()
        return jsonify({"id": user.id, "displayName": user.display_name})
    finally:
        db.close()


@user_bp.route("/me/attendance", methods=["GET"])
@require_db
@require_auth
def api_my_attendance():
    """Get current user's attendance records."""
    user_id = request.headers.get("X-User-Id")
    event_id = request.args.get("event_id")

    db = SessionLocal()
    try:
        q = db.query(AttendanceModel).filter_by(user_id=user_id)
        if event_id:
            q = q.filter_by(event_id=event_id)
        items = q.all()

        result = []
        for att in items:
            event = db.query(EventModel).get(att.event_id)
            tikum = db.query(TikumModel).get(att.tikum_id) if att.tikum_id else None
            result.append({
                "id": att.id,
                "eventId": att.event_id,
                "eventTitle": event.title if event else None,
                "eventStartAt": event.start_at.isoformat() if event else None,
                "eventStatus": event.status if event else None,
                "status": att.status,
                "tikumId": att.tikum_id,
                "tikumName": tikum.name if tikum else None,
                "createdAt": att.created_at.isoformat()
            })
        return jsonify({"attendances": result})
    finally:
        db.close()
