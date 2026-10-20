"""Endpoint publik: event, Tikum, statistik."""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from extensions import SessionLocal
from models import AttendanceModel, EventModel, LivePositionModel, LocationModel, TikumMemberModel, TikumModel, UserModel
from utils import require_db

public_bp = Blueprint("public", __name__, url_prefix="/api")


@public_bp.route("/events/featured", methods=["GET"])
@require_db
def api_featured_event():
    """Get featured event with full data."""
    db = SessionLocal()
    try:
        event = db.query(EventModel).filter(
            EventModel.is_featured == True,
            EventModel.status == "PUBLISHED"
        ).order_by(EventModel.created_at.desc()).first()
        if not event:
            # Fallback: most recent published
            event = db.query(EventModel).filter(
                EventModel.status == "PUBLISHED"
            ).order_by(EventModel.start_at.desc()).first()

        if not event:
            return jsonify({"hasActive": False})

        locations = [
            {"id": l.id, "type": l.type, "name": l.name, "description": l.description,
             "time": l.time, "lat": l.lat, "lng": l.lng}
            for l in db.query(LocationModel).filter_by(event_id=event.id).all()
        ]
        tikums = []
        for t in db.query(TikumModel).filter_by(event_id=event.id).all():
            m_count = db.query(TikumMemberModel).filter_by(tikum_id=t.id).count()
            att_count = db.query(AttendanceModel).filter(
                AttendanceModel.tikum_id == t.id,
                AttendanceModel.status.notin_(["CANCELLED"])
            ).count()
            attendee_count = max(m_count, att_count)
            tikums.append({
                "id": t.id, "name": t.name, "lat": t.lat, "lng": t.lng,
                "meet_time": t.meet_time, "meetTime": t.meet_time,
                "quota": t.quota, "contact": t.contact,
                "attendee_count": attendee_count,
                "attendeeCount": attendee_count
            })

        total_attending = db.query(AttendanceModel).filter(
            AttendanceModel.event_id == event.id,
            AttendanceModel.status.notin_(["CANCELLED"])
        ).count()
        on_the_way = db.query(AttendanceModel).filter(
            AttendanceModel.event_id == event.id,
            AttendanceModel.status == "ON_THE_WAY"
        ).count()

        return jsonify({
            "hasActive": True,
            "event": {
                "id": event.id, "title": event.title, "tagline": event.tagline,
                "description": event.description, "startAt": event.start_at.isoformat(),
                "endAt": event.end_at.isoformat() if event.end_at else None,
                "status": event.status
            },
            "start": next((l for l in locations if l["type"] == "START"), None),
            "finish": next((l for l in locations if l["type"] == "FINISH"), None),
            "tikums": tikums,
            "stats": {"totalAttending": total_attending, "onTheWay": on_the_way}
        })
    finally:
        db.close()


@public_bp.route("/events", methods=["GET"])
@require_db
def api_events_list():
    """List all events (paginated)."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status")

    db = SessionLocal()
    try:
        q = db.query(EventModel)
        if status:
            q = q.filter(EventModel.status == status)
        q = q.order_by(EventModel.start_at.desc())
        total = q.count()
        events = q.offset((page - 1) * per_page).limit(per_page).all()

        result = []
        for e in events:
            result.append({
                "id": e.id, "title": e.title, "tagline": e.tagline,
                "description": e.description, "startAt": e.start_at.isoformat(),
                "endAt": e.end_at.isoformat() if e.end_at else None,
                "status": e.status, "isFeatured": e.is_featured
            })
        return jsonify({"events": result, "total": total, "page": page, "perPage": per_page})
    finally:
        db.close()


@public_bp.route("/tikums", methods=["GET"])
@require_db
def api_tikums_list():
    """Get tikums for an event."""
    event_id = request.args.get("event_id")
    if not event_id:
        return jsonify({"error": "event_id required"}), 400

    db = SessionLocal()
    try:
        tikums = db.query(TikumModel).filter_by(event_id=event_id).all()
        result = []
        for t in tikums:
            m_count = db.query(TikumMemberModel).filter_by(tikum_id=t.id).count()
            att_count = db.query(AttendanceModel).filter(
                AttendanceModel.tikum_id == t.id,
                AttendanceModel.status.notin_(["CANCELLED"])
            ).count()
            count = max(m_count, att_count)
            coord = db.query(UserModel).get(t.coordinator_user_id) if t.coordinator_user_id else None
            result.append({
                "id": t.id, "name": t.name, "lat": t.lat, "lng": t.lng,
                "meetTime": t.meet_time, "quota": t.quota, "contact": t.contact,
                "coordinatorId": t.coordinator_user_id,
                "coordinatorName": coord.display_name if coord else None,
                "attendeeCount": count
            })
        return jsonify({"tikums": result})
    finally:
        db.close()


@public_bp.route("/stats", methods=["GET"])
@require_db
def api_stats():
    """Get live stats."""
    event_id = request.args.get("event_id")
    if not event_id:
        return jsonify({"error": "event_id diperlukan"}), 400

    db = SessionLocal()
    try:
        total = db.query(AttendanceModel).filter(
            AttendanceModel.event_id == event_id,
            AttendanceModel.status.notin_(["CANCELLED"])
        ).count()

        tikum_counts = {}
        for t in db.query(TikumModel).filter_by(event_id=event_id).all():
            c = db.query(AttendanceModel).filter(
                AttendanceModel.tikum_id == t.id,
                AttendanceModel.status.notin_(["CANCELLED"])
            ).count()
            tikum_counts[t.id] = c

        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=60)
        on_the_way_pos = db.query(LivePositionModel).filter(
            LivePositionModel.event_id == event_id,
            LivePositionModel.updated_at >= cutoff
        ).count()

        return jsonify({
            "totalAttending": total,
            "tikumBreakdown": tikum_counts,
            "onTheWay": on_the_way_pos
        })
    finally:
        db.close()
