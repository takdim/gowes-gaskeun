"""Chat & Membership per Titik Kumpul (Tikum)."""
from datetime import datetime

from flask import Blueprint, jsonify, request

from extensions import SessionLocal, socketio
from models import AttendanceModel, TikumMemberModel, TikumMessageModel, TikumModel, UserModel
from utils import require_auth, require_db

chat_bp = Blueprint("chat", __name__, url_prefix="/api")


@chat_bp.route("/me/tikums", methods=["GET"])
@require_db
@require_auth
def api_my_tikums():
    """Get list of Tikums the user has joined for an event (max 2)."""
    user_id = request.headers.get("X-User-Id")
    event_id = request.args.get("event_id")
    if not event_id:
        return jsonify({"error": "event_id diperlukan"}), 400

    db = SessionLocal()
    try:
        memberships = (
            db.query(TikumMemberModel, TikumModel)
            .join(TikumModel, TikumMemberModel.tikum_id == TikumModel.id)
            .filter(
                TikumMemberModel.user_id == user_id,
                TikumMemberModel.event_id == event_id
            )
            .all()
        )
        return jsonify({
            "joinedTikumIds": [m.tikum_id for m, _ in memberships],
            "tikums": [{
                "id": t.id,
                "name": t.name,
                "meetTime": t.meet_time,
                "joinedAt": m.joined_at.isoformat()
            } for m, t in memberships]
        })
    finally:
        db.close()


@chat_bp.route("/tikums/<tikum_id>/join", methods=["POST"])
@require_db
@require_auth
def api_join_tikum(tikum_id):
    """Join a Tikum. Maximum 2 Tikums per event per user."""
    user_id = request.headers.get("X-User-Id")
    db = SessionLocal()
    try:
        tikum = db.query(TikumModel).get(tikum_id)
        if not tikum:
            return jsonify({"error": "Tikum tidak ditemukan"}), 404

        user = db.query(UserModel).get(user_id)
        if not user:
            return jsonify({"error": "User tidak ditemukan"}), 404

        # Check if already joined
        existing = db.query(TikumMemberModel).filter_by(tikum_id=tikum_id, user_id=user_id).first()
        if existing:
            return jsonify({
                "message": "Sudah bergabung di Tikum ini",
                "tikumId": tikum_id,
                "joinedAt": existing.joined_at.isoformat()
            }), 200

        # Check max 2 Tikums rule
        current_count = db.query(TikumMemberModel).filter_by(
            event_id=tikum.event_id,
            user_id=user_id
        ).count()
        if current_count >= 2:
            return jsonify({
                "error": "Kamu sudah bergabung di 2 Tikum. Maksimal hanya boleh bergabung ke 2 Tikum."
            }), 400

        # Join tikum
        now = datetime.utcnow()
        member = TikumMemberModel(
            event_id=tikum.event_id,
            tikum_id=tikum_id,
            user_id=user_id,
            joined_at=now
        )
        db.add(member)

        # Ensure user has attendance record for this event
        att = db.query(AttendanceModel).filter_by(event_id=tikum.event_id, user_id=user_id).first()
        if not att:
            att = AttendanceModel(event_id=tikum.event_id, user_id=user_id, tikum_id=tikum_id, status="ATTENDING")
            db.add(att)
        elif not att.tikum_id:
            att.tikum_id = tikum_id

        db.commit()

        # Emit socket event to tikum room
        socketio.emit("tikum-member-joined", {
            "tikumId": tikum_id,
            "userId": user_id,
            "displayName": user.display_name
        }, room=f"tikum_{tikum_id}")

        return jsonify({
            "message": f"Berhasil bergabung ke {tikum.name}!",
            "tikumId": tikum_id,
            "joinedAt": now.isoformat()
        }), 201
    finally:
        db.close()


@chat_bp.route("/tikums/<tikum_id>/leave", methods=["POST"])
@require_db
@require_auth
def api_leave_tikum(tikum_id):
    """Leave a Tikum (keluar grup chat Tikum)."""
    user_id = request.headers.get("X-User-Id")
    db = SessionLocal()
    try:
        tikum = db.query(TikumModel).get(tikum_id)
        if not tikum:
            return jsonify({"error": "Tikum tidak ditemukan"}), 404

        deleted = db.query(TikumMemberModel).filter_by(tikum_id=tikum_id, user_id=user_id).delete()

        # Update attendance primary tikum if leaving primary
        att = db.query(AttendanceModel).filter_by(event_id=tikum.event_id, user_id=user_id).first()
        if att and att.tikum_id == tikum_id:
            remaining = db.query(TikumMemberModel).filter_by(event_id=tikum.event_id, user_id=user_id).first()
            att.tikum_id = remaining.tikum_id if remaining else None

        db.commit()

        # Emit socket event
        socketio.emit("tikum-member-left", {
            "tikumId": tikum_id,
            "userId": user_id
        }, room=f"tikum_{tikum_id}")

        return jsonify({"message": f"Keluar dari Tikum {tikum.name}", "tikumId": tikum_id}), 200
    finally:
        db.close()


@chat_bp.route("/tikums/<tikum_id>/messages", methods=["GET"])
@require_db
@require_auth
def api_get_tikum_messages(tikum_id):
    """Get chat messages for a Tikum.

    Rule: Member baru tidak bisa melihat chat sebelum joined_at!
    """
    user_id = request.headers.get("X-User-Id")
    db = SessionLocal()
    try:
        member = db.query(TikumMemberModel).filter_by(tikum_id=tikum_id, user_id=user_id).first()
        if not member:
            return jsonify({
                "error": "Kamu bukan anggota Tikum ini. Bergabunglah terlebih dahulu untuk membaca dan mengirim chat."
            }), 403

        # Only get messages created AFTER or AT the moment user joined
        messages = (
            db.query(TikumMessageModel, UserModel)
            .join(UserModel, TikumMessageModel.user_id == UserModel.id)
            .filter(
                TikumMessageModel.tikum_id == tikum_id,
                TikumMessageModel.created_at >= member.joined_at
            )
            .order_by(TikumMessageModel.created_at.asc())
            .limit(100)
            .all()
        )

        return jsonify({
            "tikumId": tikum_id,
            "joinedAt": member.joined_at.isoformat(),
            "messages": [{
                "id": msg.id,
                "userId": u.id,
                "displayName": u.display_name,
                "avatarUrl": u.avatar_url,
                "content": msg.content,
                "createdAt": msg.created_at.isoformat()
            } for msg, u in messages]
        })
    finally:
        db.close()


@chat_bp.route("/tikums/<tikum_id>/messages", methods=["POST"])
@require_db
@require_auth
def api_send_tikum_message(tikum_id):
    """Send chat message to a Tikum."""
    user_id = request.headers.get("X-User-Id")
    data = request.get_json() or {}
    content = data.get("content", "").strip()

    if not content:
        return jsonify({"error": "Pesan tidak boleh kosong"}), 400

    db = SessionLocal()
    try:
        # Check membership
        member = db.query(TikumMemberModel).filter_by(tikum_id=tikum_id, user_id=user_id).first()
        if not member:
            return jsonify({
                "error": "Kamu bukan anggota Tikum ini. Bergabunglah terlebih dahulu untuk mengirim chat."
            }), 403

        user = db.query(UserModel).get(user_id)
        if not user:
            return jsonify({"error": "User tidak ditemukan"}), 404

        now = datetime.utcnow()
        msg = TikumMessageModel(
            tikum_id=tikum_id,
            user_id=user_id,
            content=content,
            created_at=now
        )
        db.add(msg)
        db.commit()

        payload = {
            "id": msg.id,
            "tikumId": tikum_id,
            "userId": user_id,
            "displayName": user.display_name,
            "avatarUrl": user.avatar_url,
            "content": msg.content,
            "createdAt": msg.created_at.isoformat()
        }

        # Broadcast realtime via WebSocket room
        socketio.emit("new-tikum-message", payload, room=f"tikum_{tikum_id}")

        return jsonify(payload), 201
    finally:
        db.close()
