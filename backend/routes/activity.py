"""Endpoint aktivitas olahraga: rute, foto, pace, statistik ala Adidas Running / Strava."""
import json
import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from extensions import SessionLocal
from models import ActivityKudoModel, ActivityModel, EventModel, UserModel
from utils import require_auth, require_db

activity_bp = Blueprint("activity", __name__, url_prefix="/api")


def _format_pace(duration_seconds: int, distance_km: float) -> str:
    """Format kecepatan rata-rata menjadi format pace: mm:ss /km."""
    if distance_km <= 0 or duration_seconds <= 0:
        return "0:00 /km"
    pace_total_seconds = duration_seconds / distance_km
    minutes = int(pace_total_seconds // 60)
    seconds = int(pace_total_seconds % 60)
    return f"{minutes}:{seconds:02d} /km"


@activity_bp.route("/activities", methods=["POST"])
@require_db
@require_auth
def api_create_activity():
    """Simpan aktivitas perjalanan baru (rute, foto, durasi, jarak, pace)."""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "X-User-Id diperlukan"}), 400

    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        title = f"Gowes Makassar #{datetime.utcnow().strftime('%d %b')}"

    notes = data.get("notes")
    event_id = data.get("eventId")
    distance_km = float(data.get("distance_km") or data.get("distanceKm") or 0.0)
    duration_seconds = int(data.get("duration_seconds") or data.get("durationSeconds") or 0)

    # Hitung kecepatan rata-rata dan pace jika belum ada
    if duration_seconds > 0 and distance_km > 0:
        hours = duration_seconds / 3600.0
        avg_speed = round(distance_km / hours, 1)
        avg_pace = _format_pace(duration_seconds, distance_km)
    else:
        avg_speed = float(data.get("avg_speed") or data.get("avgSpeed") or 0.0)
        avg_pace = data.get("avg_pace") or data.get("avgPace") or "0:00 /km"

    max_speed = float(data.get("max_speed") or data.get("maxSpeed") or avg_speed)
    # Estimasi kalori sepeda: ~30-35 kcal per km
    calories = int(data.get("calories") or round(distance_km * 32))

    # Serialize coordinates & photos jika diberikan list
    route_coords = data.get("route_coordinates") or data.get("routeCoordinates")
    if isinstance(route_coords, list):
        route_coords = json.dumps(route_coords)

    photos = data.get("photos")
    if isinstance(photos, list):
        photos = json.dumps(photos)

    db = SessionLocal()
    try:
        user = db.query(UserModel).get(user_id)
        if not user:
            return jsonify({"error": "User tidak ditemukan"}), 404

        activity = ActivityModel(
            user_id=user_id,
            event_id=event_id,
            title=title,
            notes=notes,
            distance_km=distance_km,
            duration_seconds=duration_seconds,
            avg_speed=avg_speed,
            max_speed=max_speed,
            avg_pace=avg_pace,
            calories=calories,
            route_coordinates=route_coords,
            photos=photos,
            kudos_count=0,
        )
        db.add(activity)
        db.commit()

        return jsonify({
            "id": activity.id,
            "title": activity.title,
            "distanceKm": activity.distance_km,
            "durationSeconds": activity.duration_seconds,
            "avgSpeed": activity.avg_speed,
            "avgPace": activity.avg_pace,
            "calories": activity.calories,
            "message": "Aktivitas berhasil disimpan! 🚴",
        }), 201
    finally:
        db.close()


@activity_bp.route("/activities", methods=["GET"])
@require_db
def api_get_activities():
    """Feed aktivitas komunitas / riwayat aktivitas pengguna dengan pagination."""
    user_id = request.args.get("user_id")
    limit = min(int(request.args.get("limit", 6)), 50)
    offset = max(int(request.args.get("offset", 0)), 0)
    current_user_id = request.headers.get("X-User-Id")

    db = SessionLocal()
    try:
        query = db.query(ActivityModel, UserModel).join(UserModel, ActivityModel.user_id == UserModel.id)
        if user_id:
            query = query.filter(ActivityModel.user_id == user_id)

        total = query.count()
        rows = query.order_by(ActivityModel.created_at.desc()).offset(offset).limit(limit).all()
        has_more = (offset + len(rows)) < total

        # Cek kudo yang sudah diberikan user yang sedang login
        user_kudos_activity_ids = set()
        if current_user_id:
            user_kudos = db.query(ActivityKudoModel.activity_id).filter_by(user_id=current_user_id).all()
            user_kudos_activity_ids = {k[0] for k in user_kudos}

        results = []
        for act, user in rows:
            coords = []
            if act.route_coordinates:
                try:
                    coords = json.loads(act.route_coordinates)
                except Exception:
                    coords = []

            photos = []
            if act.photos:
                try:
                    photos = json.loads(act.photos)
                except Exception:
                    photos = []

            results.append({
                "id": act.id,
                "userId": user.id,
                "userName": user.display_name,
                "userAvatar": user.avatar_url,
                "userRole": user.role,
                "title": act.title,
                "notes": act.notes,
                "distanceKm": round(act.distance_km, 2),
                "durationSeconds": act.duration_seconds,
                "avgSpeed": round(act.avg_speed, 1),
                "maxSpeed": round(act.max_speed or 0.0, 1),
                "avgPace": act.avg_pace or "0:00 /km",
                "calories": act.calories or 0,
                "routeCoordinates": coords,
                "photos": photos,
                "kudosCount": act.kudos_count,
                "hasKudo": act.id in user_kudos_activity_ids,
                "createdAt": act.created_at.isoformat(),
            })

        return jsonify({
            "activities": results,
            "total": total,
            "hasMore": has_more,
            "offset": offset,
            "limit": limit
        })
    finally:
        db.close()


@activity_bp.route("/activities/<act_id>", methods=["GET"])
@require_db
def api_get_activity_detail(act_id):
    """Ambil detail satu aktivitas."""
    current_user_id = request.headers.get("X-User-Id")
    db = SessionLocal()
    try:
        row = db.query(ActivityModel, UserModel).join(UserModel, ActivityModel.user_id == UserModel.id).filter(ActivityModel.id == act_id).first()
        if not row:
            return jsonify({"error": "Aktivitas tidak ditemukan"}), 404

        act, user = row
        coords = json.loads(act.route_coordinates) if act.route_coordinates else []
        photos = json.loads(act.photos) if act.photos else []

        has_kudo = False
        if current_user_id:
            has_kudo = db.query(ActivityKudoModel).filter_by(activity_id=act.id, user_id=current_user_id).first() is not None

        return jsonify({
            "id": act.id,
            "userId": user.id,
            "userName": user.display_name,
            "userAvatar": user.avatar_url,
            "title": act.title,
            "notes": act.notes,
            "distanceKm": act.distance_km,
            "durationSeconds": act.duration_seconds,
            "avgSpeed": act.avg_speed,
            "maxSpeed": act.max_speed,
            "avgPace": act.avg_pace,
            "calories": act.calories,
            "routeCoordinates": coords,
            "photos": photos,
            "kudosCount": act.kudos_count,
            "hasKudo": has_kudo,
            "createdAt": act.created_at.isoformat(),
        })
    finally:
        db.close()


@activity_bp.route("/activities/<act_id>", methods=["DELETE"])
@require_db
@require_auth
def api_delete_activity(act_id):
    """Hapus aktivitas milik sendiri."""
    user_id = request.headers.get("X-User-Id")
    db = SessionLocal()
    try:
        act = db.query(ActivityModel).get(act_id)
        if not act:
            return jsonify({"error": "Aktivitas tidak ditemukan"}), 404
        if act.user_id != user_id:
            return jsonify({"error": "Bukan pemilik aktivitas ini"}), 403

        db.delete(act)
        db.commit()
        return jsonify({"message": "Aktivitas berhasil dihapus"})
    finally:
        db.close()


@activity_bp.route("/activities/<act_id>/kudos", methods=["POST"])
@require_db
@require_auth
def api_toggle_kudos(act_id):
    """Beri atau cabut 'Gaskeun!' (Kudos) pada aktivitas."""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "X-User-Id diperlukan"}), 400

    db = SessionLocal()
    try:
        act = db.query(ActivityModel).get(act_id)
        if not act:
            return jsonify({"error": "Aktivitas tidak ditemukan"}), 404

        existing = db.query(ActivityKudoModel).filter_by(activity_id=act_id, user_id=user_id).first()
        if existing:
            db.delete(existing)
            act.kudos_count = max(0, act.kudos_count - 1)
            has_kudo = False
        else:
            kudo = ActivityKudoModel(activity_id=act_id, user_id=user_id)
            db.add(kudo)
            act.kudos_count += 1
            has_kudo = True

        db.commit()
        return jsonify({"kudosCount": act.kudos_count, "hasKudo": has_kudo})
    finally:
        db.close()


@activity_bp.route("/users/<user_id>/stats", methods=["GET"])
@require_db
def api_get_user_stats(user_id):
    """Ambil statistik kumulatif karir gowes seorang pengguna."""
    db = SessionLocal()
    try:
        user = db.query(UserModel).get(user_id)
        if not user:
            return jsonify({"error": "User tidak ditemukan"}), 404

        activities = db.query(ActivityModel).filter_by(user_id=user_id).all()

        total_distance = sum(a.distance_km for a in activities)
        total_duration = sum(a.duration_seconds for a in activities)
        total_calories = sum(a.calories or 0 for a in activities)
        total_rides = len(activities)
        longest_ride = max((a.distance_km for a in activities), default=0.0)

        hours = total_duration / 3600.0 if total_duration > 0 else 0
        avg_speed = round(total_distance / hours, 1) if hours > 0 else 0.0
        avg_pace = _format_pace(total_duration, total_distance) if total_distance > 0 else "0:00 /km"

        return jsonify({
            "userId": user.id,
            "displayName": user.display_name,
            "avatarUrl": user.avatar_url,
            "totalDistanceKm": round(total_distance, 1),
            "totalDurationSeconds": total_duration,
            "totalHours": round(hours, 1),
            "totalRides": total_rides,
            "totalCalories": total_calories,
            "longestRideKm": round(longest_ride, 1),
            "avgSpeed": avg_speed,
            "avgPace": avg_pace,
        })
    finally:
        db.close()
