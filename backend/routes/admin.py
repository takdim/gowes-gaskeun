"""Endpoint admin: event, lokasi, Tikum, peserta, pengguna."""
import uuid
from datetime import datetime

from flask import Blueprint, g, jsonify, request

from extensions import SessionLocal
from models import AttendanceModel, EventModel, LocationModel, TikumModel, UserModel
from utils import hash_password, require_admin, require_db, require_staff

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# ── Events ──────────────────────────────────────────────
@admin_bp.route("/events", methods=["GET"])
@require_db
@require_staff
def api_admin_events():
    """Admin: list all events."""
    db = SessionLocal()
    try:
        events = db.query(EventModel).order_by(EventModel.start_at.desc()).all()
        return jsonify({
            "events": [{
                "id": e.id, "title": e.title, "tagline": e.tagline,
                "description": e.description, "startAt": e.start_at.isoformat(),
                "endAt": e.end_at.isoformat() if e.end_at else None,
                "status": e.status, "isFeatured": e.is_featured
            } for e in events]
        })
    finally:
        db.close()


@admin_bp.route("/events", methods=["POST"])
@require_db
@require_admin
def api_admin_create_event():
    """Admin: create event."""
    data = request.get_json()
    required = ["title", "startAt"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"{field} diperlukan"}), 400

    db = SessionLocal()
    try:
        event = EventModel(
            title=data["title"],
            tagline=data.get("tagline"),
            description=data.get("description"),
            start_at=datetime.fromisoformat(data["startAt"].replace("Z", "+00:00").split("+")[0]),
            end_at=datetime.fromisoformat(data["endAt"].replace("Z", "+00:00").split("+")[0]) if data.get("endAt") else None,
            status=data.get("status", "DRAFT"),
            is_featured=data.get("is_featured", False)
        )
        if event.is_featured:
            db.query(EventModel).update({"is_featured": False})
        db.add(event)
        db.commit()
        return jsonify({"id": event.id}), 201
    finally:
        db.close()


@admin_bp.route("/events/<event_id>", methods=["PUT"])
@require_db
@require_admin
def api_admin_update_event(event_id):
    """Admin: update event."""
    data = request.get_json()
    db = SessionLocal()
    try:
        event = db.query(EventModel).get(event_id)
        if not event:
            return jsonify({"error": "Tidak ditemukan"}), 404

        for key in ["title", "tagline", "description", "status", "is_featured"]:
            if key in data:
                setattr(event, key, data[key])
        if data.get("is_featured"):
            db.query(EventModel).filter(EventModel.id != event.id).update({"is_featured": False})
        if "startAt" in data:
            event.start_at = datetime.fromisoformat(data["startAt"].replace("Z", "+00:00").split("+")[0])
        if "endAt" in data:
            event.end_at = datetime.fromisoformat(data["endAt"].replace("Z", "+00:00").split("+")[0]) if data["endAt"] else None

        db.commit()
        return jsonify({"id": event.id})
    finally:
        db.close()


# ── Locations ───────────────────────────────────────────
@admin_bp.route("/events/<event_id>/locations", methods=["GET"])
@require_db
@require_staff
def api_admin_event_locations(event_id):
    """Admin: list locations of an event."""
    db = SessionLocal()
    try:
        locs = db.query(LocationModel).filter_by(event_id=event_id).all()
        return jsonify({"locations": [{
            "id": l.id, "type": l.type, "name": l.name,
            "description": l.description, "time": l.time,
            "lat": l.lat, "lng": l.lng
        } for l in locs]})
    finally:
        db.close()


@admin_bp.route("/events/<event_id>/locations", methods=["POST"])
@require_db
@require_admin
def api_admin_add_location(event_id):
    """Admin: add Start/Finish location."""
    data = request.get_json()
    required = ["type", "name", "lat", "lng"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"{field} diperlukan"}), 400

    db = SessionLocal()
    try:
        loc = LocationModel(
            event_id=event_id,
            type=data["type"],
            name=data["name"],
            description=data.get("description"),
            time=data.get("time"),
            lat=data["lat"], lng=data["lng"]
        )
        db.add(loc)
        db.commit()
        return jsonify({"id": loc.id}), 201
    finally:
        db.close()


@admin_bp.route("/locations/<location_id>", methods=["PATCH"])
@require_db
@require_admin
def api_admin_update_location(location_id):
    """Admin: update Start/Finish location."""
    data = request.get_json()
    db = SessionLocal()
    try:
        loc = db.query(LocationModel).get(location_id)
        if not loc:
            return jsonify({"error": "Tidak ditemukan"}), 404

        for key in ["type", "name", "description", "time", "lat", "lng"]:
            if key in data:
                setattr(loc, key, data[key])

        db.commit()
        return jsonify({"id": loc.id, "message": "Lokasi berhasil diupdate"})
    finally:
        db.close()


@admin_bp.route("/locations/<location_id>", methods=["DELETE"])
@require_db
@require_admin
def api_admin_delete_location(location_id):
    """Admin: delete Start/Finish location."""
    db = SessionLocal()
    try:
        loc = db.query(LocationModel).get(location_id)
        if not loc:
            return jsonify({"error": "Tidak ditemukan"}), 404

        db.delete(loc)
        db.commit()
        return jsonify({"message": "Lokasi berhasil dihapus"})
    finally:
        db.close()


# ── Tikums ──────────────────────────────────────────────
@admin_bp.route("/events/<event_id>/tikums", methods=["POST"])
@require_db
@require_staff
def api_admin_add_tikum(event_id):
    """Admin/koordinator: tambah Tikum. Koordinator otomatis jadi koordinator Tikum baru."""
    data = request.get_json()
    required = ["name", "lat", "lng"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"{field} diperlukan"}), 400

    user = g.current_user
    coordinator_user_id = data.get("coordinator_user_id")
    if user["role"] != "ADMIN":
        coordinator_user_id = user["id"]

    db = SessionLocal()
    try:
        t = TikumModel(
            event_id=event_id,
            name=data["name"],
            lat=data["lat"], lng=data["lng"],
            meet_time=data.get("meet_time"),
            quota=data.get("quota"),
            contact=data.get("contact"),
            coordinator_user_id=coordinator_user_id
        )
        db.add(t)
        db.commit()
        return jsonify({"id": t.id}), 201
    finally:
        db.close()


@admin_bp.route("/tikums/<tikum_id>", methods=["PATCH"])
@require_db
@require_staff
def api_admin_update_tikum(tikum_id):
    """Admin/koordinator: update Tikum (koordinator hanya Tikum miliknya)."""
    data = request.get_json()
    db = SessionLocal()
    try:
        t = db.query(TikumModel).get(tikum_id)
        if not t:
            return jsonify({"error": "Tidak ditemukan"}), 404

        user = g.current_user
        is_admin = user["role"] == "ADMIN"
        if not is_admin and t.coordinator_user_id != user["id"]:
            return jsonify({"error": "Bukan Tikum Anda"}), 403

        if "coordinator_user_id" in data:
            if not is_admin:
                return jsonify({"error": "Akses ditolak"}), 403
            t.coordinator_user_id = data["coordinator_user_id"] or None
        for key in ["name", "meet_time", "quota", "contact", "lat", "lng"]:
            if key in data:
                setattr(t, key, data[key])

        db.commit()
        return jsonify({"id": t.id})
    finally:
        db.close()


@admin_bp.route("/tikums/<tikum_id>", methods=["DELETE"])
@require_db
@require_staff
def api_admin_delete_tikum(tikum_id):
    """Admin/koordinator: hapus Tikum (koordinator hanya Tikum miliknya)."""
    db = SessionLocal()
    try:
        t = db.query(TikumModel).get(tikum_id)
        if not t:
            return jsonify({"error": "Tidak ditemukan"}), 404

        user = g.current_user
        if user["role"] != "ADMIN" and t.coordinator_user_id != user["id"]:
            return jsonify({"error": "Bukan Tikum Anda"}), 403

        db.delete(t)
        db.commit()
        return jsonify({"id": tikum_id})
    finally:
        db.close()


# ── Attendances ─────────────────────────────────────────
@admin_bp.route("/events/<event_id>/attendances", methods=["GET"])
@require_db
@require_staff
def api_admin_event_attendances(event_id):
    """Admin/koordinator: daftar peserta event (koordinator hanya Tikum miliknya)."""
    db = SessionLocal()
    try:
        q = (
            db.query(AttendanceModel, UserModel)
            .join(UserModel, AttendanceModel.user_id == UserModel.id)
            .filter(AttendanceModel.event_id == event_id)
        )

        user = g.current_user
        if user["role"] == "TIKUM_COORDINATOR":
            my_tikum_ids = [
                t.id for t in db.query(TikumModel).filter_by(
                    event_id=event_id, coordinator_user_id=user["id"]
                ).all()
            ]
            if not my_tikum_ids:
                return jsonify({"attendances": []})
            q = q.filter(AttendanceModel.tikum_id.in_(my_tikum_ids))

        rows = q.order_by(AttendanceModel.created_at.asc()).all()

        result = []
        for att, u in rows:
            tikum = db.query(TikumModel).get(att.tikum_id) if att.tikum_id else None
            result.append({
                "id": att.id,
                "userId": u.id,
                "displayName": u.display_name,
                "email": u.email,
                "status": att.status,
                "tikumId": att.tikum_id,
                "tikumName": tikum.name if tikum else None
            })
        return jsonify({"attendances": result})
    finally:
        db.close()


# ── Users ───────────────────────────────────────────────
@admin_bp.route("/users", methods=["GET"])
@require_db
@require_admin
def api_admin_users():
    """Admin: list users."""
    role = request.args.get("role")
    db = SessionLocal()
    try:
        q = db.query(UserModel)
        if role:
            q = q.filter(UserModel.role == role)
        users = q.order_by(UserModel.created_at.asc()).all()
        return jsonify({"users": [{
            "id": u.id, "email": u.email, "displayName": u.display_name,
            "role": u.role, "createdAt": u.created_at.isoformat()
        } for u in users]})
    finally:
        db.close()


@admin_bp.route("/users", methods=["POST"])
@require_db
@require_admin
def api_admin_create_user():
    """Admin: create user (rider / admin / coordinator), optionally assign to a Tikum."""
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    display_name = (data.get("displayName") or "").strip()
    role = data.get("role", "USER")

    if not email or not password or not display_name:
        return jsonify({"error": "Email, password, dan nama wajib diisi"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password minimal 6 karakter"}), 400
    if role not in ("USER", "ADMIN", "TIKUM_COORDINATOR"):
        return jsonify({"error": "Role tidak valid"}), 400

    db = SessionLocal()
    try:
        if db.query(UserModel).filter_by(email=email).first():
            return jsonify({"error": "Email sudah terdaftar"}), 409

        user = UserModel(
            id=str(uuid.uuid4()), email=email,
            password_hash=hash_password(password),
            display_name=display_name, role=role
        )
        db.add(user)
        db.flush()

        tikum_id = data.get("tikumId")
        if role == "TIKUM_COORDINATOR" and tikum_id:
            tikum = db.query(TikumModel).get(tikum_id)
            if tikum:
                tikum.coordinator_user_id = user.id

        db.commit()
        return jsonify({
            "id": user.id, "email": user.email,
            "displayName": user.display_name, "role": user.role
        }), 201
    finally:
        db.close()
