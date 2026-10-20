"""Live map: tracking posisi rider (On The Way)."""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from extensions import SessionLocal, socketio
from models import AttendanceModel, LivePositionModel, UserModel
from utils import require_auth, require_db

live_bp = Blueprint("live", __name__, url_prefix="/api/live")


@live_bp.route("/start", methods=["POST"])
@require_db
@require_auth
def api_live_start():
    """Start live tracking."""
    data = request.get_json()
    event_id = data.get("eventId")
    user_id = request.headers.get("X-User-Id")

    if not event_id or not user_id:
        return jsonify({"error": "Required"}), 400

    db = SessionLocal()
    try:
        att = db.query(AttendanceModel).filter_by(event_id=event_id, user_id=user_id).first()
        if not att:
            return jsonify({"error": "Belum mendaftar"}), 400

        att.status = "ON_THE_WAY"
        db.commit()

        user = db.query(UserModel).filter_by(id=user_id).first()
        display_name = user.display_name if user else "Rider"

        # Emit broadcast
        socketio.emit("user-status", {"userId": user_id, "displayName": display_name, "status": "ON_THE_WAY"}, room=f"event_{event_id}")

        return jsonify({"message": "Tracking dimulai"})
    finally:
        db.close()


@live_bp.route("/position", methods=["POST"])
@require_db
@require_auth
def api_live_position():
    """Send live position."""
    data = request.get_json()
    event_id = data.get("eventId")
    user_id = request.headers.get("X-User-Id")

    lat = data.get("lat")
    lng = data.get("lng")
    if lat is None or lng is None:
        return jsonify({"error": "lat/lng diperlukan"}), 400

    db = SessionLocal()
    try:
        # Upsert position
        pos = db.query(LivePositionModel).filter_by(event_id=event_id, user_id=user_id).first()
        obj = {
            "lat": lat, "lng": lng,
            "speed": data.get("speed"), "heading": data.get("heading"),
            "accuracy": data.get("accuracy")
        }
        if pos:
            for k, v in obj.items():
                setattr(pos, k, v)
            pos.updated_at = datetime.utcnow()
        else:
            pos = LivePositionModel(event_id=event_id, user_id=user_id, **obj)
            db.add(pos)
        db.commit()

        user = db.query(UserModel).filter_by(id=user_id).first()
        display_name = user.display_name if user else "Rider"
        avatar_url = user.avatar_url if user else None

        # Broadcast via WebSocket
        socketio.emit("position", {
            "userId": user_id,
            "displayName": display_name,
            "avatarUrl": avatar_url,
            "lat": lat,
            "lng": lng,
            "speed": obj["speed"],
            "heading": obj["heading"],
            "accuracy": obj["accuracy"]
        }, room=f"event_{event_id}")

        return jsonify({"message": "ok"})
    finally:
        db.close()


@live_bp.route("/stop", methods=["POST"])
@require_db
@require_auth
def api_live_stop():
    """Stop live tracking."""
    data = request.get_json()
    event_id = data.get("eventId")
    user_id = request.headers.get("X-User-Id")

    db = SessionLocal()
    try:
        att = db.query(AttendanceModel).filter_by(event_id=event_id, user_id=user_id).first()
        if att:
            att.status = "FINISHED"
            db.commit()

        socketio.emit("user-left", {"userId": user_id}, room=f"event_{event_id}")

        return jsonify({"message": "Tracking berhenti"})
    finally:
        db.close()


@live_bp.route("/riders", methods=["GET"])
@require_db
def api_live_riders():
    """Get active riders for an event."""
    event_id = request.args.get("event_id")
    if not event_id:
        return jsonify({"error": "event_id diperlukan"}), 400

    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(seconds=60)
        positions = (
            db.query(LivePositionModel, UserModel)
            .join(UserModel, LivePositionModel.user_id == UserModel.id)
            .filter(
                LivePositionModel.event_id == event_id,
                LivePositionModel.updated_at >= cutoff
            )
            .all()
        )

        result = []
        for pos, user in positions:
            result.append({
                "userId": user.id,
                "displayName": user.display_name,
                "avatarUrl": user.avatar_url,
                "lat": pos.lat, "lng": pos.lng,
                "speed": pos.speed, "heading": pos.heading,
                "accuracy": pos.accuracy,
                "updatedAt": pos.updated_at.isoformat()
            })
        return jsonify({"riders": result})
    finally:
        db.close()
