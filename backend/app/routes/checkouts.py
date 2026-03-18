"""
Checkout routes
---------------
POST /api/checkouts                      — checkout a book            [token_required]
POST /api/checkouts/<id>/return          — return a book              [token_required]
GET  /api/checkouts                      — user: own checkouts        [token_required]
                                           admin: all checkouts
GET  /api/checkouts/active               — all currently active       [admin_required]
POST /api/checkouts/admin-checkout       — admin checkout for user    [admin_required]
"""

import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify

from ..db import get_db
from ..middleware.auth import token_required, admin_required

checkouts_bp = Blueprint("checkouts", __name__)

SHELF_COLUMNS = {"A", "B", "C", "D"}
SHELF_LEVELS = {"1", "2", "3", "4", "5", "6"}


def _normalize_location(location_code: str) -> str:
    code = (location_code or "").strip().upper()
    if len(code) != 2:
        return ""
    if code[0] not in SHELF_COLUMNS or code[1] not in SHELF_LEVELS:
        return ""
    return code




def _serialize(doc: dict) -> dict:
    doc["id"]      = str(doc.pop("_id"))
    doc["book_id"] = str(doc["book_id"])
    doc["user_id"] = str(doc["user_id"])
    return doc


def _log(db, action, user, book_id=None, book_title=None,
         target_user_email=None, details=""):
    db.logs.insert_one({
        "action":             action,
        "performed_by_id":    user["sub"],
        "performed_by_email": user["email"],
        "book_id":            str(book_id) if book_id else None,
        "book_title":         book_title,
        "target_user_email":  target_user_email,
        "timestamp":          datetime.datetime.utcnow(),
        "details":            details,
    })


def _do_checkout(db, book_id_str: str, user_id: str,
                 user_email: str, performed_by) -> tuple:
    """
    Core checkout logic shared by user self-checkout and admin-checkout.
    Returns (checkout_doc, error_tuple_or_None).
    """
    try:
        oid = ObjectId(book_id_str)
    except Exception:
        return None, ({"error": "Invalid book ID."}, 400)

    book = db.books.find_one({"_id": oid})
    if not book:
        return None, ({"error": "Book not found."}, 404)
    if book["available_copies"] < 1:
        return None, ({"error": "No copies available."}, 409)

    try:
        uid = ObjectId(user_id)
    except Exception:
        return None, ({"error": "Invalid user ID."}, 400)

    now = datetime.datetime.utcnow()
    doc = {
        "book_id":        oid,
        "book_title":     book["title"],
        "book_isbn":      book.get("isbn", ""),
        "book_location":  book.get("location_code", ""),
        "user_id":        uid,
        "user_email":     user_email,
        "checked_out_at": now,
        "returned_at":    None,
        "status":         "active",
    }
    result = db.checkouts.insert_one(doc)
    db.books.update_one({"_id": oid}, {"$inc": {"available_copies": -1}})

    _log(db, action="checkout", user=performed_by,
         book_id=oid, book_title=book["title"],
         target_user_email=user_email if user_email != performed_by["email"] else None)

    doc["_id"] = result.inserted_id
    return doc, None


# ---------------------------------------------------------------------------
# POST /api/checkouts  — user checks out for themselves
# Body: { "book_id": "..." }
# ---------------------------------------------------------------------------
@checkouts_bp.route("", methods=["POST"])
@token_required
def checkout():
    data = request.get_json(silent=True) or {}
    book_id = data.get("book_id", "")
    user    = request.user

    db = get_db()
    doc, err = _do_checkout(db, book_id, user["sub"], user["email"], user)
    if err:
        return jsonify(err[0]), err[1]

    return jsonify(_serialize(doc)), 201


# ---------------------------------------------------------------------------
# POST /api/checkouts/cart-checkout  — checkout multiple books at once
# Body: [{"book_id": "...", "quantity": 2}, ...]
# ---------------------------------------------------------------------------
@checkouts_bp.route("/cart-checkout", methods=["POST"])
@token_required
def cart_checkout():
    items = request.get_json(silent=True) or []
    if not isinstance(items, list) or not items:
        return jsonify({"error": "Cart is empty."}), 400

    user = request.user
    db   = get_db()

    # Pre-validate every item before touching the DB
    errors = []
    for item in items:
        qty = max(1, int(item.get("quantity", 1)))
        try:
            oid = ObjectId(item.get("book_id", ""))
        except Exception:
            errors.append(f"Invalid book ID: {item.get('book_id')}")
            continue
        book = db.books.find_one({"_id": oid})
        if not book:
            errors.append(f"Book not found: {item.get('book_id')}")
        elif book["available_copies"] < qty:
            avail = book["available_copies"]
            errors.append(
                f'"{book["title"]}": only {avail} cop{"ies" if avail != 1 else "y"} available.'
            )
    if errors:
        return jsonify({"error": "; ".join(errors)}), 409

    # Execute checkouts
    results = []
    for item in items:
        qty = max(1, int(item.get("quantity", 1)))
        for _ in range(qty):
            doc, err = _do_checkout(db, item["book_id"], user["sub"], user["email"], user)
            if err:
                continue   # shouldn't happen after pre-validation
            results.append(_serialize(doc))

    return jsonify({"checked_out": len(results), "checkouts": results}), 201

# ---------------------------------------------------------------------------
# POST /api/checkouts/admin-checkout  — admin checks out on behalf of a user
# Body: { "book_id": "...", "user_id": "...", "user_email": "..." }
# ---------------------------------------------------------------------------
@checkouts_bp.route("/admin-checkout", methods=["POST"])
@admin_required
def admin_checkout():
    data       = request.get_json(silent=True) or {}
    book_id    = data.get("book_id", "")
    user_id    = data.get("user_id", "")
    user_email = data.get("user_email", "")

    if not user_id and not user_email:
        return jsonify({"error": "user_id or user_email is required."}), 400

    db = get_db()

    # Look up the user by id or email
    query = {"_id": ObjectId(user_id)} if user_id else {"email": user_email}
    try:
        target = db.users.find_one(query)
    except Exception:
        return jsonify({"error": "Invalid user ID."}), 400

    if not target:
        return jsonify({"error": "User not found."}), 404

    doc, err = _do_checkout(
        db,
        book_id,
        str(target["_id"]),
        target["email"],
        request.user,
    )
    if err:
        return jsonify(err[0]), err[1]

    return jsonify(_serialize(doc)), 201


# ---------------------------------------------------------------------------
# POST /api/checkouts/<checkout_id>/return
# ---------------------------------------------------------------------------
@checkouts_bp.route("/<checkout_id>/return", methods=["POST"])
@token_required
def return_book(checkout_id):
    data = request.get_json(silent=True) or {}
    location_code = _normalize_location(data.get("location_code", ""))
    if not location_code:
        return jsonify({"error": "location_code is required and must be A1-D6."}), 400

    db = get_db()
    try:
        oid = ObjectId(checkout_id)
    except Exception:
        return jsonify({"error": "Invalid checkout ID."}), 400

    checkout = db.checkouts.find_one({"_id": oid})
    if not checkout:
        return jsonify({"error": "Checkout record not found."}), 404
    if checkout["status"] == "returned":
        return jsonify({"error": "This book has already been returned."}), 409

    user = request.user
    # Users can only return their own books; admins can return any
    if user["role"] != "admin" and str(checkout["user_id"]) != user["sub"]:
        return jsonify({"error": "You can only return your own books."}), 403

    now = datetime.datetime.utcnow()
    db.checkouts.update_one(
        {"_id": oid},
        {"$set": {"status": "returned", "returned_at": now, "returned_location": location_code}},
    )
    db.books.update_one(
        {"_id": checkout["book_id"]},
        {"$inc": {"available_copies": 1}, "$set": {"location_code": location_code}},
    )

    _log(db, action="return", user=user,
         book_id=checkout["book_id"], book_title=checkout["book_title"],
         target_user_email=checkout["user_email"] if checkout["user_email"] != user["email"] else None,
         details=f"returned_location={location_code}")

    return jsonify({
        "message": f"'{checkout['book_title']}' returned successfully.",
        "location_code": location_code,
    }), 200


# ---------------------------------------------------------------------------
# GET /api/checkouts
# Admin → all checkouts; User → own checkouts
# Query params: status=active|returned  (optional)
# ---------------------------------------------------------------------------
@checkouts_bp.route("", methods=["GET"])
@token_required
def get_checkouts():
    db   = get_db()
    user = request.user
    query = {}

    if user["role"] != "admin":
        query["user_id"] = ObjectId(user["sub"])

    status = request.args.get("status", "").lower()
    if status in ("active", "returned"):
        query["status"] = status

    records = list(db.checkouts.find(query).sort("checked_out_at", -1))
    return jsonify([_serialize(r) for r in records]), 200


# ---------------------------------------------------------------------------
# GET /api/checkouts/active  — admin: all active checkouts
# ---------------------------------------------------------------------------
@checkouts_bp.route("/active", methods=["GET"])
@admin_required
def get_active_checkouts():
    db      = get_db()
    records = list(db.checkouts.find({"status": "active"}).sort("checked_out_at", -1))
    return jsonify([_serialize(r) for r in records]), 200
