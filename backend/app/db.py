from pymongo import MongoClient
from flask import current_app

# Module-level singleton — created once per process, shared across all requests.
# MongoClient manages an internal connection pool; do not create it per-request.
_client: MongoClient | None = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(current_app.config["MONGO_URI"])
    return _client.get_default_database()


def init_db(app):
    """Called once at app startup — nothing to set up for the singleton pattern."""
    pass
