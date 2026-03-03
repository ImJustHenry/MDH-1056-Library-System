from flask import Flask
from flask_cors import CORS
from .config import Config
from .db import init_db


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGIN"]}})

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
