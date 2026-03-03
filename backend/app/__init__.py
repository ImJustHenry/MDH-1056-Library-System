from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from .config import Config
from .db import init_db

# Global limiter — keyed by the real client IP.
# On Render (behind a proxy) we trust the X-Forwarded-For header.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],          # no blanket limit; we set per-route limits
    storage_uri="memory://",
)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Trust the proxy headers Render sends so IP detection works correctly
    app.config["RATELIMIT_HEADERS_ENABLED"] = True
    app.wsgi_app = __import__("werkzeug.middleware.proxy_fix",
                              fromlist=["ProxyFix"]).ProxyFix(
        app.wsgi_app, x_for=1, x_proto=1, x_host=1
    )

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGIN"]}})
    limiter.init_app(app)

    init_db(app)

    # ── Blueprints ────────────────────────────────────────────────────────
    from .routes.auth      import auth_bp
    from .routes.books     import books_bp
    from .routes.checkouts import checkouts_bp
    from .routes.logs      import logs_bp
    from .routes.dashboard import dashboard_bp

    app.register_blueprint(auth_bp,      url_prefix="/api/auth")
    app.register_blueprint(books_bp,     url_prefix="/api/books")
    app.register_blueprint(checkouts_bp, url_prefix="/api/checkouts")
    app.register_blueprint(logs_bp,      url_prefix="/api/logs")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    @app.route("/api/health")
    def health():
        return {"status": "ok"}, 200

    return app
