import secrets
import datetime
import time

import jwt
from bson import ObjectId
from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash

from ..db import get_db
from ..email_utils import send_verification_email
from .. import limiter

auth_bp = Blueprint("auth", __name__)


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email    = data.get("email", "").lower().strip()
    password = data.get("password", "")

    # ── Domain check ──────────────────────────────────────────────────────
    allowed = current_app.config["ALLOWED_EMAIL_DOMAIN"]
    if not email.endswith(f"@{allowed}"):
        return jsonify({"error": f"Only @{allowed} email addresses are allowed."}), 400

    # ── Password length ───────────────────────────────────────────────────
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    db = get_db()

    # ── Duplicate check ───────────────────────────────────────────────────
    if db.users.find_one({"email": email}):
        return jsonify({"error": "An account with that email already exists."}), 409

    # ── Assign role ───────────────────────────────────────────────────────
    admin_emails = current_app.config["ADMIN_EMAILS"]
    role = "admin" if email in admin_emails else "user"

    # ── Build user document ───────────────────────────────────────────────
    verification_token = secrets.token_urlsafe(32)
    user_doc = {
        "email":              email,
        "password_hash":      generate_password_hash(password),
        "role":               role,
        "verified":           False,
        "verification_token": verification_token,
        "created_at":         datetime.datetime.utcnow(),
    }
    db.users.insert_one(user_doc)

    # ── Send verification email ───────────────────────────────────────────
    try:
        send_verification_email(email, verification_token)
    except Exception as exc:
        current_app.logger.error("Email send failed: %s", exc)
        # In debug mode expose the link so you can test without SMTP
        if current_app.debug:
            verify_url = (
                f"{current_app.config['FRONTEND_URL']}"
                f"/verify-email?token={verification_token}"
            )
            return jsonify({
                "message": "Registered. SMTP not configured — use the debug link.",
                "debug_verify_url": verify_url,
            }), 201
        return jsonify({"error": "Failed to send verification email. Check SMTP settings."}), 500

    return jsonify({
        "message": f"Registration successful. Check {email} to verify your account."
    }), 201


# ---------------------------------------------------------------------------
# GET /api/auth/verify/<token>
# ---------------------------------------------------------------------------
@auth_bp.route("/verify/<token>", methods=["GET"])
def verify_email(token):
    db = get_db()
    user = db.users.find_one({"verification_token": token})

    if not user:
        return jsonify({"error": "Invalid or expired verification token."}), 400

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"verified": True}, "$unset": {"verification_token": ""}},
    )

    return jsonify({"message": "Email verified. You can now log in."}), 200


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------
@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")          # per IP — real users never hit this
@limiter.limit("50 per hour")            # secondary cap
def login():
    data = request.get_json(silent=True) or {}
    email    = data.get("email", "").lower().strip()
    password = data.get("password", "")

    db = get_db()
    user = db.users.find_one({"email": email})

    # Generic message to avoid user enumeration.
    # 500 ms delay on failure — negligible for real users, crippling for bots.
    if not user or not check_password_hash(user["password_hash"], password):
        time.sleep(0.5)
        return jsonify({"error": "Invalid email or password."}), 401

    if not user["verified"]:
        return jsonify({"error": "Please verify your email before logging in."}), 403

    # ── Issue JWT ─────────────────────────────────────────────────────────
    expiry_hours = current_app.config["JWT_EXPIRY_HOURS"]
    payload = {
        "sub":   str(user["_id"]),
        "email": user["email"],
        "role":  user["role"],
        "exp":   datetime.datetime.utcnow() + datetime.timedelta(hours=expiry_hours),
    }
    token = jwt.encode(
        payload,
        current_app.config["JWT_SECRET"],
        algorithm="HS256",
    )

    return jsonify({
        "token": token,
        "user": {
            "email": user["email"],
            "role":  user["role"],
        },
    }), 200


# ---------------------------------------------------------------------------
# POST /api/auth/forgot-password
# Body: { "email": "..." }
# Always returns 200 (avoids user enumeration)
# ---------------------------------------------------------------------------
@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("5 per minute")   # prevent email-bombing
def forgot_password():
    from ..email_utils import send_reset_email
    data  = request.get_json(silent=True) or {}
    email = data.get("email", "").lower().strip()

    db   = get_db()
    user = db.users.find_one({"email": email})

    GENERIC = {"message": "If that email exists you will receive a reset link shortly."}

    if not user or not user.get("verified"):
        return jsonify(GENERIC), 200

    reset_token   = secrets.token_urlsafe(32)
    token_expiry  = datetime.datetime.utcnow() + datetime.timedelta(hours=1)

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "reset_token":        reset_token,
            "reset_token_expiry": token_expiry,
        }},
    )

    try:
        send_reset_email(email, reset_token)
    except Exception as exc:
        current_app.logger.error("Reset email send failed: %s", exc)
        if current_app.debug:
            reset_url = (
                f"{current_app.config['FRONTEND_URL']}"
                f"/reset-password?token={reset_token}"
            )
            return jsonify({**GENERIC, "debug_reset_url": reset_url}), 200

    return jsonify(GENERIC), 200


# ---------------------------------------------------------------------------
# POST /api/auth/reset-password
# Body: { "token": "...", "password": "..." }
# ---------------------------------------------------------------------------
@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data     = request.get_json(silent=True) or {}
    token    = data.get("token", "")
    password = data.get("password", "")

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    db   = get_db()
    user = db.users.find_one({"reset_token": token})

    if not user:
        return jsonify({"error": "Invalid or expired reset token."}), 400

    if datetime.datetime.utcnow() > user.get("reset_token_expiry", datetime.datetime.min):
        return jsonify({"error": "Reset token has expired. Please request a new one."}), 400

    db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set":   {"password_hash": generate_password_hash(password)},
            "$unset": {"reset_token": "", "reset_token_expiry": ""},
        },
    )

    return jsonify({"message": "Password reset successfully. You can now log in."}), 200
