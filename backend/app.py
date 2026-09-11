import logging
import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter

from config import config
from database.mongodb import is_db_connected, init_db

from routes.queue_routes import queue_bp
from routes.doctor_routes import doctor_bp
from routes.prediction_routes import prediction_bp
from routes.symptom_routes import symptom_bp
from routes.appointment_routes import appointment_bp
from routes.notification_routes import notification_bp
from routes.consultation_routes import consultation_bp
from routes.auth_routes import auth_bp, limiter
from routes.admin_routes import admin_bp

# ============================================================
# LOGGING CONFIGURATION
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

logger = logging.getLogger("smart-hospital-backend")


# ============================================================
# CREATE FLASK APPLICATION
# ============================================================

def create_app() -> Flask:
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config)

    # ========================================================
    # CORS CONFIGURATION
    # Supported development origins: 3003, 3002, 3001, 3000, 5173
    # NO wildcard origins="*" used for strict security
    # ========================================================

    cors_origins_str = getattr(config, "CORS_ORIGINS", "")
    allowed_origins = [
        origin.strip()
        for origin in cors_origins_str.split(",")
        if origin.strip()
    ]

    logger.info("Allowed CORS origins: %s", allowed_origins)

    CORS(
        app,
        resources={
            r"/*": {
                "origins": allowed_origins
            }
        },
        supports_credentials=True
    )

    # ========================================================
    # RATE LIMITER INITIALIZATION
    # ========================================================

    limiter.init_app(app)
    logger.info("Flask-Limiter initialized")

    # ========================================================
    # REGISTER BLUEPRINTS
    # ========================================================

    app.register_blueprint(queue_bp)
    app.register_blueprint(doctor_bp)
    app.register_blueprint(prediction_bp)
    app.register_blueprint(symptom_bp)
    app.register_blueprint(appointment_bp)
    app.register_blueprint(notification_bp)
    app.register_blueprint(consultation_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)

    # ========================================================
    # DATABASE INITIALIZATION
    # ========================================================

    try:
        init_db()
        logger.info("MongoDB initialization completed")
    except Exception as e:
        logger.warning("Database initialization warning: %s", e)

    # ========================================================
    # HEALTH CHECK
    # ========================================================

    @app.route("/health", methods=["GET"])
    def health():
        db_ok = is_db_connected()
        return jsonify({
            "status": "ok",
            "service": "hospital-queue-backend",
            "database_connected": db_ok,
            "database": {
                "connected": db_ok,
                "detail": "connected" if db_ok else "disconnected"
            }
        }), 200

    # ========================================================
    # ROOT ENDPOINT
    # ========================================================

    @app.route("/", methods=["GET"])
    def root():
        return jsonify({
            "message": "Smart Hospital Queue System API",
            "status": "running",
            "service": "hospital-queue-backend",
            "health": "/health"
        }), 200

    logger.info("Smart Hospital Flask application created successfully")
    return app


app = create_app()

if __name__ == "__main__":
    logger.info("Starting Smart Hospital Queue Backend on port %s", config.PORT)
    logger.info("Debug mode: %s", config.DEBUG)

    app.run(
        host="0.0.0.0",
        port=config.PORT,
        debug=config.DEBUG,
        use_reloader=False
    )