import logging
import os

from flask import Flask, jsonify, request
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
from routes.department_routes import department_bp
from routes.patient_routes import patient_bp
from routes.location_routes import location_bp
from routes.medicine_routes import medicine_bp
from routes.order_routes import order_bp

# ============================================================
# LOGGING CONFIGURATION
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

logger = logging.getLogger("smart-hospital-backend")


import re

def is_origin_allowed(origin: str, allowed_list) -> bool:
    if not origin:
        return False
    norm_origin = origin.strip().rstrip("/")
    for allowed in allowed_list:
        if isinstance(allowed, str):
            if allowed == "*" or allowed.rstrip("/") == norm_origin:
                return True
        elif hasattr(allowed, "match") and allowed.match(norm_origin):
            return True
        elif hasattr(allowed, "search") and allowed.search(norm_origin):
            return True
    return False


# ============================================================
# VERCEL / RENDER API PREFIX & CORS PREFLIGHT WSGI MIDDLEWARE
# ============================================================

class ApiPrefixAndCorsMiddleware:
    """
    WSGI middleware that:
    1. Normalizes '/api' prefixed requests forwarded by Vercel or Render production
       rewrites to native Flask routes, while keeping direct routes fully operational.
    2. Intercepts CORS OPTIONS preflight requests globally and returns 200 OK with
       full Access-Control headers before hitting routing or rate-limiting.
    3. Guarantees CORS headers on all downstream responses to prevent browser blocks.
    """

    def __init__(self, wsgi_app, allowed_origins=None):
        self.wsgi_app = wsgi_app
        self.allowed_origins = allowed_origins or []

    def is_allowed(self, origin: str) -> bool:
        return is_origin_allowed(origin, self.allowed_origins)

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        # Normalize /api and /api/ prefixes
        if path == "/api" or path == "/api/":
            environ["PATH_INFO"] = "/"
            environ["SCRIPT_NAME"] = environ.get("SCRIPT_NAME", "") + "/api"
        elif path.startswith("/api/"):
            environ["PATH_INFO"] = path[4:]
            environ["SCRIPT_NAME"] = environ.get("SCRIPT_NAME", "") + "/api"

        method = environ.get("REQUEST_METHOD", "").upper()
        origin = environ.get("HTTP_ORIGIN", "")

        # Globally handle CORS preflight OPTIONS requests
        if method == "OPTIONS":
            allow_origin = origin if (origin and self.is_allowed(origin)) else "https://hospital-queue-system-1-yd7t.onrender.com"
            headers = [
                ("Access-Control-Allow-Origin", allow_origin),
                ("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"),
                ("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept"),
                ("Access-Control-Allow-Credentials", "true"),
                ("Access-Control-Max-Age", "86400"),
                ("Vary", "Origin"),
                ("Content-Length", "0"),
                ("Content-Type", "text/plain"),
            ]
            start_response("200 OK", headers)
            return [b""]

        def custom_start_response(status, response_headers, exc_info=None):
            if origin and self.is_allowed(origin):
                header_names = {h[0].lower() for h in response_headers}
                if "access-control-allow-origin" not in header_names:
                    response_headers.append(("Access-Control-Allow-Origin", origin))
                if "access-control-allow-credentials" not in header_names:
                    response_headers.append(("Access-Control-Allow-Credentials", "true"))
                if "access-control-allow-methods" not in header_names:
                    response_headers.append(("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"))
                if "access-control-allow-headers" not in header_names:
                    response_headers.append(("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept"))
                if "vary" not in header_names:
                    response_headers.append(("Vary", "Origin"))
            return start_response(status, response_headers, exc_info)

        return self.wsgi_app(environ, custom_start_response)


# ============================================================
# CREATE FLASK APPLICATION
# ============================================================

def create_app() -> Flask:
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config)

    # Disable strict slashes so /auth/login and /auth/login/ both match identically
    app.url_map.strict_slashes = False

    # ========================================================
    # CORS CONFIGURATION
    # Supported development origins: 3003, 3002, 3001, 3000, 5173
    # Production: https://hospital-queue-system-1-yd7t.onrender.com, https://hqms-frontend.onrender.com, *.onrender.com, *.vercel.app
    # ========================================================

    cors_origins_str = getattr(config, "CORS_ORIGINS", "")
    allowed_origins = [
        origin.strip()
        for origin in cors_origins_str.split(",")
        if origin.strip()
    ]
    explicit_origins = [
        "https://hospital-queue-system-1-yd7t.onrender.com",
        "https://hqms-frontend.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    for orig in explicit_origins:
        if orig not in allowed_origins:
            allowed_origins.append(orig)

    allowed_origins.append(re.compile(r"^https://.*\.onrender\.com$"))
    allowed_origins.append(re.compile(r"^https://.*\.vercel\.app$"))
    allowed_origins.append(re.compile(r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"))

    logger.info("Allowed CORS origins: %s", allowed_origins)

    CORS(
        app,
        resources={
            r"/*": {
                "origins": allowed_origins,
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
                "expose_headers": ["Content-Type", "Authorization"],
                "supports_credentials": True,
                "max_age": 86400,
            }
        },
        supports_credentials=True,
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
    app.register_blueprint(department_bp)
    app.register_blueprint(patient_bp)
    app.register_blueprint(location_bp)
    app.register_blueprint(medicine_bp)
    app.register_blueprint(order_bp)

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
    @app.route("/api/health", methods=["GET"])
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
    # SERVER TIME ENDPOINT (IST / Asia:Kolkata)
    # Frontend uses this to validate slot availability without
    # trusting the browser clock for critical booking operations.
    # ========================================================

    @app.route("/time", methods=["GET"])
    @app.route("/api/time", methods=["GET"])
    def server_time():
        from services.time_service import get_server_time_payload
        return jsonify(get_server_time_payload()), 200

    # ========================================================
    # ROOT ENDPOINT
    # ========================================================

    @app.route("/", methods=["GET"])
    @app.route("/api", methods=["GET"])
    @app.route("/api/", methods=["GET"])
    def root():
        return jsonify({
            "message": "Smart Hospital Queue System API",
            "status": "running",
            "service": "hospital-queue-backend",
            "health": "/health"
        }), 200

    # Response hook to ensure CORS headers on every response
    @app.after_request
    def apply_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin and is_origin_allowed(origin, allowed_origins):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
        return response

    # Apply Vercel/Render /api prefix normalization and CORS preflight WSGI middleware
    app.wsgi_app = ApiPrefixAndCorsMiddleware(app.wsgi_app, allowed_origins=allowed_origins)

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