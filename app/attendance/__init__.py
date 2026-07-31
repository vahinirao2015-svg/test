import time

from flask import Flask
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from .db import db, resolve_database_url
from .routes import bp


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = __import__("os").environ.get("SECRET_KEY", "dev-only-change-me")
    app.config["APP_NAME"] = __import__("os").environ.get("APP_NAME", "Daymark")
    app.config["SQLALCHEMY_DATABASE_URI"] = resolve_database_url()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    db.init_app(app)
    app.register_blueprint(bp)

    with app.app_context():
        # Import models so metadata is registered before create_all.
        from . import models  # noqa: F401

        for attempt in range(36):
            try:
                db.session.execute(text("SELECT 1"))
                db.create_all()
                break
            except OperationalError:
                if attempt == 35:
                    raise
                time.sleep(5)

    return app
