import logging
import os
import threading
import time

from flask import Flask, request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .db import PLACEHOLDER_DATABASE_URI, db, resolve_database_url
from .routes import bp

logger = logging.getLogger(__name__)


def _clear_db_engines(app: Flask) -> None:
    """Drop cached SQLAlchemy engines so a new URI is picked up."""
    db.session.remove()
    engines = getattr(db, "_app_engines", {}).get(app)
    if not engines:
        return
    for engine in list(engines.values()):
        engine.dispose()
    engines.clear()


def _try_configure_database(app: Flask) -> bool:
    """Resolve credentials and create schema. Returns True when DB is usable."""
    try:
        uri = resolve_database_url()
    except Exception as exc:  # noqa: BLE001 - keep serving /health while AWS/DB warms up
        logger.warning("Database URL not ready: %s", exc)
        return False

    with app.app_context():
        app.config["SQLALCHEMY_DATABASE_URI"] = uri
        _clear_db_engines(app)
        from . import models  # noqa: F401

        try:
            db.session.execute(text("SELECT 1"))
            db.create_all()
            db.session.commit()
            app.config["DB_READY"] = True
            logger.info("Database schema is ready")
            return True
        except SQLAlchemyError as exc:
            db.session.rollback()
            logger.warning("Database not reachable yet: %s", exc)
            return False


def _background_db_init(app: Flask) -> None:
    for attempt in range(1, 61):
        with app.app_context():
            if _try_configure_database(app):
                return
        time.sleep(5)
        logger.info("Retrying database init (%s/60)", attempt)


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-me")
    app.config["APP_NAME"] = os.environ.get("APP_NAME", "Daymark")
    app.config["SQLALCHEMY_DATABASE_URI"] = PLACEHOLDER_DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    app.config["DB_READY"] = False

    db.init_app(app)
    app.register_blueprint(bp)

    # Bind the HTTP port immediately so ALB /health succeeds while DB warms up.
    if not _try_configure_database(app):
        threading.Thread(target=_background_db_init, args=(app,), daemon=True).start()

    @app.before_request
    def _require_db_except_health():
        if request.path == "/health":
            return None
        if app.config.get("DB_READY"):
            return None
        if _try_configure_database(app):
            return None
        return (
            "Attendance database is still starting. Retry in a moment.",
            503,
            {"Content-Type": "text/plain; charset=utf-8"},
        )

    return app
