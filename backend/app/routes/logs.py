"""
Log routes (admin only)
-----------------------
GET /api/logs               — full audit log (paginated)
GET /api/logs/book/<id>     — logs for a specific book
GET /api/logs/user/<email>  — logs for a specific user
"""

from bson import ObjectId
from flask import Blueprint, request, jsonify

from ..db import get_db
from ..middleware.auth import admin_required

logs_bp = Blueprint("logs", __name__)


def _serialize(log: dict) -> dict:
    log["id"] = str(log.pop("_id"))
    return log


# ---------------------------------------------------------------------------
# GET /api/logs
# Query params:
#   page  (default 1)
#   limit (default 50, max 200)
# ---------------------------------------------------------------------------
@logs_bp.route("", methods=["GET"])
@admin_required
def get_logs():
    db    = get_db()
    page  = max(1, int(request.args.get("page",  1)))
    limit = min(200, max(1, int(request.args.get("limit", 50))))
    skip  = (page - 1) * limit

    total  = db.logs.count_documents({})
    cursor = db.logs.find({}).sort("timestamp", -1).skip(skip).limit(limit)
    logs   = [_serialize(l) for l in cursor]

    return jsonify({
        "total": total,
        "page":  page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "logs":  logs,
    }), 200


# ---------------------------------------------------------------------------
# GET /api/logs/book/<book_id>
# ---------------------------------------------------------------------------
@logs_bp.route("/book/<book_id>", methods=["GET"])
@admin_required
def get_book_logs(book_id):
    db   = get_db()
    logs = list(
        db.logs.find({"book_id": book_id}).sort("timestamp", -1)
    )
    return jsonify([_serialize(l) for l in logs]), 200


# ---------------------------------------------------------------------------
# GET /api/logs/user/<email>
# ---------------------------------------------------------------------------
@logs_bp.route("/user/<email>", methods=["GET"])
@admin_required
def get_user_logs(email):
    db = get_db()
    logs = list(
        db.logs.find({
            "$or": [
                {"performed_by_email": email},
                {"target_user_email":  email},
            ]
        }).sort("timestamp", -1)
    )
    return jsonify([_serialize(l) for l in logs]), 200
