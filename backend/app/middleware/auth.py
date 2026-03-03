import jwt
from functools import wraps
from flask import request, jsonify, current_app


def _decode_token():
    """Extract and decode the Bearer token from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, ({"error": "Missing or invalid Authorization header"}, 401)

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(
            token,
            current_app.config["JWT_SECRET"],
            algorithms=["HS256"],
        )
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, ({"error": "Token has expired. Please log in again."}, 401)
    except jwt.InvalidTokenError:
        return None, ({"error": "Invalid token."}, 401)


def token_required(f):
    """Decorator: requires a valid JWT. Injects request.user (payload dict)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload, err = _decode_token()
        if err:
            return jsonify(err[0]), err[1]
        request.user = payload
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorator: requires a valid JWT with role == 'admin'."""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload, err = _decode_token()
        if err:
            return jsonify(err[0]), err[1]
        if payload.get("role") != "admin":
            return jsonify({"error": "Admin access required."}), 403
        request.user = payload
        return f(*args, **kwargs)
    return decorated
