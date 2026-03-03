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

    if not title or not author:
        return jsonify({"error": "title and author are required."}), 400

    total = int(data.get("total_copies", 1))
    if total < 1:
        return jsonify({"error": "total_copies must be at least 1."}), 400

    db = get_db()

    isbn = data.get("isbn", "").strip()
    if isbn and db.books.find_one({"isbn": isbn}):
        return jsonify({"error": "A book with that ISBN already exists."}), 409

    now = datetime.datetime.utcnow()
    doc = {
        "title":            title,
        "author":           author,
        "isbn":             isbn,
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
    allowed = ["title", "author", "isbn", "description", "total_copies"]
    updates = {k: data[k] for k in allowed if k in data}

    if "total_copies" in updates:
        new_total = int(updates["total_copies"])
        if new_total < 1:
            return jsonify({"error": "total_copies must be at least 1."}), 400
        checked_out = book["total_copies"] - book["available_copies"]
        updates["available_copies"] = max(0, new_total - checked_out)
        updates["total_copies"]     = new_total

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
