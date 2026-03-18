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

SHELF_COLUMNS = ["A", "B", "C", "D"]
SHELF_LEVELS = [1, 2, 3, 4, 5, 6]


def _normalize_location(location_code: str) -> str:
    code = (location_code or "").strip().upper()
    if len(code) != 2:
        return ""
    if code[0] not in SHELF_COLUMNS or code[1] not in {str(level) for level in SHELF_LEVELS}:
        return ""
    return code


def _normalize_location_counts(raw_counts) -> dict:
    if not isinstance(raw_counts, dict):
        return {}

    normalized = {}
    for raw_code, raw_count in raw_counts.items():
        code = _normalize_location(str(raw_code))
        if not code:
            continue
        try:
            count = int(raw_count)
        except Exception:
            continue
        if count > 0:
            normalized[code] = normalized.get(code, 0) + count
    return normalized


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


@dashboard_bp.route("/shelf-map", methods=["GET"])
@admin_required
def get_shelf_map():
    db = get_db()

    books = list(db.books.find({}, {
        "title": 1,
        "location_code": 1,
        "location_counts": 1,
        "total_copies": 1,
        "available_copies": 1,
    }))

    slots = {f"{column}{level}": {
        "location_code": f"{column}{level}",
        "shelf": column,
        "level": level,
        "title_count": 0,
        "copies_total": 0,
        "available_total": 0,
        "titles": [],
    } for level in SHELF_LEVELS for column in SHELF_COLUMNS}

    for book in books:
        location_counts = _normalize_location_counts(book.get("location_counts", {}))
        if not location_counts:
            fallback = _normalize_location(book.get("location_code", ""))
            if fallback and fallback in slots:
                location_counts = {fallback: int(book.get("available_copies", 0) or 0)}

        for location_code, count in location_counts.items():
            if location_code not in slots:
                continue
            slot = slots[location_code]
            slot["title_count"] += 1
            slot["copies_total"] += count
            slot["available_total"] += count
            slot["titles"].append(book.get("title", "Untitled"))

    ordered_slots = [slots[f"{column}{level}"] for level in SHELF_LEVELS for column in SHELF_COLUMNS]

    return jsonify({
        "shelves": SHELF_COLUMNS,
        "levels": SHELF_LEVELS,
        "slots": ordered_slots,
    }), 200
