"""Endpoint development: seed data contoh."""
from flask import Blueprint, jsonify

from seed import seed_data
from utils import require_db

dev_bp = Blueprint("dev", __name__, url_prefix="/api/dev")


@dev_bp.route("/seed", methods=["POST"])
@require_db
def api_seed_data():
    """Seed sample data for development."""
    payload, status = seed_data()
    return jsonify(payload), status
