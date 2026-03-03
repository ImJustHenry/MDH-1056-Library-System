from pymongo import MongoClient
from flask import current_app, g


def get_db():
    if "db" not in g:
        client = MongoClient(current_app.config["MONGO_URI"])
        g.db = client.get_default_database()
    return g.db


def init_db(app):
    @app.teardown_appcontext
    def close_db(exception):
        db = g.pop("db", None)
        if db is not None:
            db.client.close()
