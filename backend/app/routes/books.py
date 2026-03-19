"""
Book routes
-----------
GET    /api/books          — catalog (search + filter)        [token_required]
GET    /api/books/<id>     — single book detail               [token_required]
POST   /api/books          — add a book                       [admin_required]
PUT    /api/books/<id>     — edit a book                      [admin_required]
DELETE /api/books/<id>     — delete a book                    [admin_required]
"""

import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify, current_app

from ..db import get_db
from ..middleware.auth import token_required, admin_required

books_bp = Blueprint("books", __name__)

SHELF_COLUMNS = {"A", "B", "C", "D"}
SHELF_LEVELS = {"1", "2", "3", "4", "5", "6"}


def _normalize_location(location_code: str) -> str:
    code = (location_code or "").strip().upper()
    if len(code) != 2:
        return ""
    if code[0] not in SHELF_COLUMNS or code[1] not in SHELF_LEVELS:
        return ""
    return code


def _normalize_isbn(isbn_value: str) -> str:
    return (isbn_value or "").strip().replace("-", "").replace(" ", "").upper()


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


def _rebalance_location_counts(counts: dict, target_available: int, fallback_location: str) -> dict:
    working = {code: int(count) for code, count in counts.items() if int(count) > 0}
    current_total = sum(working.values())

    if current_total > target_available:
        to_remove = current_total - target_available
        for code in sorted(working.keys(), reverse=True):
            if to_remove <= 0:
                break
            take = min(working[code], to_remove)
            working[code] -= take
            to_remove -= take
            if working[code] <= 0:
                del working[code]
    elif current_total < target_available:
        add = target_available - current_total
        if fallback_location:
            working[fallback_location] = working.get(fallback_location, 0) + add

    return working


def _serialize(book: dict) -> dict:
    book["id"] = str(book.pop("_id"))
    return book


# ---------------------------------------------------------------------------
# GET /api/books
# Query params:
#   q          — full-text search (title / author / isbn)
#   available  — "true" → only books with available_copies > 0
# ---------------------------------------------------------------------------
@books_bp.route("", methods=["GET"])
@token_required
def get_books():
    db = get_db()
    query = {}

    search_term = request.args.get("q", "").strip()
    if search_term:
        query["$text"] = {"$search": search_term}

    available = request.args.get("available", "").lower()
    if available == "true":
        query["available_copies"] = {"$gt": 0}
    elif available == "false":
        query["available_copies"] = 0

    books = list(db.books.find(query, {"score": {"$meta": "textScore"}} if search_term else {}))
    return jsonify([_serialize(b) for b in books]), 200


# ---------------------------------------------------------------------------
# GET /api/books/<id>
# ---------------------------------------------------------------------------
@books_bp.route("/<book_id>", methods=["GET"])
@token_required
def get_book(book_id):
    db = get_db()
    try:
        book = db.books.find_one({"_id": ObjectId(book_id)})
    except Exception:
        return jsonify({"error": "Invalid book ID."}), 400
    if not book:
        return jsonify({"error": "Book not found."}), 404
    return jsonify(_serialize(book)), 200


# ---------------------------------------------------------------------------
# POST /api/books  (admin only)
# ---------------------------------------------------------------------------
@books_bp.route("", methods=["POST"])
@admin_required
def add_book():
    data = request.get_json(silent=True) or {}
    title  = data.get("title",  "").strip()
    author = data.get("author", "").strip()
    location_code = _normalize_location(data.get("location_code", ""))

    if not title or not author:
        return jsonify({"error": "title and author are required."}), 400
    if not location_code:
        return jsonify({"error": "location_code is required and must be A1-D6."}), 400

    total = int(data.get("total_copies", 1))
    if total < 1:
        return jsonify({"error": "total_copies must be at least 1."}), 400

    db = get_db()

    isbn = data.get("isbn", "").strip()
    isbn_normalized = _normalize_isbn(isbn)
    if isbn_normalized:
        existing = db.books.find_one({
            "$or": [
                {"isbn_normalized": isbn_normalized},
                {"isbn": isbn},
            ]
        })
        if existing:
            return jsonify({"error": "There is duplicate ISBN."}), 409

    now = datetime.datetime.utcnow()
    location_counts = _normalize_location_counts(data.get("location_counts", {}))
    if location_counts:
        location_counts = _rebalance_location_counts(location_counts, total, location_code)
    else:
        location_counts = {location_code: total}

    doc = {
        "title":            title,
        "author":           author,
        "isbn":             isbn,
        "isbn_normalized":  isbn_normalized,
        "location_code":    location_code,
        "location_counts":  location_counts,
        "description":      data.get("description", "").strip(),
        "total_copies":     total,
        "available_copies": total,
        "created_at":       now,
        "updated_at":       now,
    }
    result = db.books.insert_one(doc)

    # ── Log the action ────────────────────────────────────────────────────
    _log(db, action="add_book", user=request.user,
         book_id=result.inserted_id, book_title=title)

    doc["_id"] = result.inserted_id
    return jsonify(_serialize(doc)), 201


# ---------------------------------------------------------------------------
# PUT /api/books/<id>  (admin only)
# ---------------------------------------------------------------------------
@books_bp.route("/<book_id>", methods=["PUT"])
@admin_required
def edit_book(book_id):
    db = get_db()
    try:
        oid = ObjectId(book_id)
    except Exception:
        return jsonify({"error": "Invalid book ID."}), 400

    book = db.books.find_one({"_id": oid})
    if not book:
        return jsonify({"error": "Book not found."}), 404

    data = request.get_json(silent=True) or {}
    allowed = ["title", "author", "isbn", "description", "total_copies", "location_code", "location_counts"]
    updates = {k: data[k] for k in allowed if k in data}

    if "location_code" in updates:
        normalized = _normalize_location(updates["location_code"])
        if not normalized:
            return jsonify({"error": "location_code must be in A1-D6 format."}), 400
        updates["location_code"] = normalized

    if "total_copies" in updates:
        new_total = int(updates["total_copies"])
        if new_total < 1:
            return jsonify({"error": "total_copies must be at least 1."}), 400
        checked_out = book["total_copies"] - book["available_copies"]
        if new_total < checked_out:
            return jsonify({"error": f"Cannot set total_copies below checked-out count ({checked_out})."}), 400
        updates["available_copies"] = max(0, new_total - checked_out)
        updates["total_copies"]     = new_total

    if "isbn" in updates:
        raw_isbn = (updates.get("isbn") or "").strip()
        normalized_isbn = _normalize_isbn(raw_isbn)
        if normalized_isbn:
            duplicate = db.books.find_one({
                "$and": [
                    {"_id": {"$ne": oid}},
                    {
                        "$or": [
                            {"isbn_normalized": normalized_isbn},
                            {"isbn": raw_isbn},
                        ]
                    },
                ]
            })
            if duplicate:
                return jsonify({"error": "There is duplicate ISBN."}), 409
        updates["isbn"] = raw_isbn
        updates["isbn_normalized"] = normalized_isbn

    if "location_counts" in updates:
        normalized_counts = _normalize_location_counts(updates["location_counts"])
        if not normalized_counts:
            return jsonify({"error": "location_counts must include at least one valid A1-D6 entry with count > 0."}), 400
        target_available = updates.get("available_copies", book.get("available_copies", 0))
        fallback_location = updates.get("location_code", book.get("location_code", ""))
        updates["location_counts"] = _rebalance_location_counts(normalized_counts, target_available, fallback_location)
    else:
        fallback_location = updates.get("location_code", book.get("location_code", ""))
        existing_counts = _normalize_location_counts(book.get("location_counts", {}))
        if not existing_counts and fallback_location:
            existing_counts = {fallback_location: book.get("available_copies", 0)}
        target_available = updates.get("available_copies", book.get("available_copies", 0))
        updates["location_counts"] = _rebalance_location_counts(existing_counts, target_available, fallback_location)

    updates["updated_at"] = datetime.datetime.utcnow()
    db.books.update_one({"_id": oid}, {"$set": updates})

    updated = db.books.find_one({"_id": oid})
    return jsonify(_serialize(updated)), 200


# ---------------------------------------------------------------------------
# DELETE /api/books/<id>  (admin only)
# ---------------------------------------------------------------------------
@books_bp.route("/<book_id>", methods=["DELETE"])
@admin_required
def delete_book(book_id):
    db = get_db()
    try:
        oid = ObjectId(book_id)
    except Exception:
        return jsonify({"error": "Invalid book ID."}), 400

    book = db.books.find_one({"_id": oid})
    if not book:
        return jsonify({"error": "Book not found."}), 404

    active = db.checkouts.count_documents({"book_id": oid, "status": "active"})
    if active > 0:
        return jsonify({"error": "Cannot delete a book that has active checkouts."}), 409

    db.books.delete_one({"_id": oid})

    _log(db, action="delete_book", user=request.user,
         book_id=oid, book_title=book["title"])

    return jsonify({"message": f"'{book['title']}' deleted."}), 200


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------
def _log(db, action, user, book_id=None, book_title=None, details=""):
    db.logs.insert_one({
        "action":             action,
        "performed_by_id":    user["sub"],
        "performed_by_email": user["email"],
        "book_id":            str(book_id) if book_id else None,
        "book_title":         book_title,
        "target_user_email":  None,
        "timestamp":          datetime.datetime.utcnow(),
        "details":            details,
    })
