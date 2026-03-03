"""
Dashboard route (admin only)
-----------------------------
GET /api/dashboard   — summary stats
"""

from flask import jsonify
from flask import Blueprint

from ..db import get_db
from ..middleware.auth import admin_required

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("", methods=["GET"])
@admin_required
def get_dashboard():
    db = get_db()

    total_books      = db.books.count_documents({})
    total_copies     = list(db.books.aggregate([
        {"$group": {"_id": None,
                    "total":     {"$sum": "$total_copies"},
                    "available": {"$sum": "$available_copies"}}}
    ]))

    total_copies_sum     = total_copies[0]["total"]     if total_copies else 0
    available_copies_sum = total_copies[0]["available"] if total_copies else 0
    checked_out_copies   = total_copies_sum - available_copies_sum

    active_checkouts = db.checkouts.count_documents({"status": "active"})
    total_users      = db.users.count_documents({"verified": True})

    return jsonify({
        "total_titles":          total_books,
        "total_copies":          total_copies_sum,
        "available_copies":      available_copies_sum,
        "checked_out_copies":    checked_out_copies,
        "active_checkouts":      active_checkouts,
        "total_verified_users":  total_users,
    }), 200
