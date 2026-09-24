import os
from dotenv import load_dotenv

# Explicitly load .env from the backend directory to ensure reliability
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ENV_PATH = os.path.join(_BACKEND_DIR, ".env")
if os.path.exists(_ENV_PATH):
    load_dotenv(dotenv_path=_ENV_PATH, override=True)
else:
    load_dotenv(override=True)

def resolve_mongo_database() -> str:
    """
    Safely resolves the MongoDB database name from environment variables.
    Guards against:
    - Hostnames passed as database name (e.g. 'cluster0.mjkbasv.mongodb.net' containing '.')
    - Full URIs passed as database name (e.g. 'mongodb+srv://.../hospital_queue_db')
    - Invalid characters forbidden by MongoDB ('.', '/', '\\', ' ', '"', '$', '\0')
    - Defaults safely to 'hospital_queue_db'
    """
    raw_db = (
        os.getenv("MONGO_DATABASE")
        or os.getenv("MONGODB_DATABASE")
        or ""
    ).strip()

    # If raw_db looks like a full URI (e.g. mongodb:// or mongodb+srv://), extract the database component
    if raw_db.startswith("mongodb://") or raw_db.startswith("mongodb+srv://"):
        try:
            from pymongo.uri_parser import parse_uri
            parsed_db = parse_uri(raw_db).get("database")
            if parsed_db:
                raw_db = parsed_db.strip()
        except Exception:
            raw_db = ""

    # If raw_db contains a path separator (e.g. hostname/dbname or /dbname)
    if "/" in raw_db:
        path_part = raw_db.split("/")[-1].split("?")[0].strip()
        if path_part:
            raw_db = path_part

    # MongoDB database names cannot contain '.', '$', '/', '\\', '\0', or space
    invalid_chars = {".", "/", "\\", " ", '"', "$", "\0"}
    if not raw_db or any(c in invalid_chars for c in raw_db):
        raw_uri = (os.getenv("MONGO_URI") or os.getenv("MONGODB_URI") or "").strip()
        if raw_uri.startswith("mongodb://") or raw_uri.startswith("mongodb+srv://"):
            try:
                from pymongo.uri_parser import parse_uri
                uri_db = parse_uri(raw_uri).get("database")
                if uri_db and not any(c in invalid_chars for c in uri_db):
                    return uri_db.strip()
            except Exception:
                pass
        return "hospital_queue_db"

    return raw_db


class Config:
    MONGO_URI = os.getenv("MONGO_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    MONGO_DATABASE = resolve_mongo_database()
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    
    # CORS Origins (Allowing development ports 3003, 3002, 3001, 3000, 5173)
    CORS_ORIGINS = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3003,http://localhost:3002,http://localhost:3001,http://localhost:3000,http://localhost:5173,http://127.0.0.1:3003,http://127.0.0.1:3002,http://127.0.0.1:3001,http://127.0.0.1:3000,http://127.0.0.1:5173"
    )

    # OTP Provider Mode (development / twilio / sms)
    OTP_PROVIDER = os.getenv("OTP_PROVIDER", "development").lower()

    # JWT Secret Key
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-later-456")

    # OpenRouteService API Key
    OPENROUTESERVICE_API_KEY = os.getenv("OPENROUTESERVICE_API_KEY", "")

    # Fast2SMS Provider Configuration
    FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")
    FAST2SMS_SMS_ENABLED = os.getenv("FAST2SMS_SMS_ENABLED", "False").lower() in ("true", "1", "t")

    # MSG91 SMS Provider Configuration (Legacy fallback)
    MSG91_AUTH_KEY = os.getenv("MSG91_AUTH_KEY", "")
    MSG91_SENDER_ID = os.getenv("MSG91_SENDER_ID", "SIMSRH")
    MSG91_SMS_ENABLED = os.getenv("MSG91_SMS_ENABLED", "False").lower() in ("true", "1", "t")
    MSG91_OTP_TEMPLATE_ID = os.getenv("MSG91_OTP_TEMPLATE_ID", "")
    MSG91_FLOW_ID = os.getenv("MSG91_FLOW_ID", "")

config = Config()

# Module-level definitions for direct import and config.<VAR> access
FAST2SMS_API_KEY = config.FAST2SMS_API_KEY
FAST2SMS_SMS_ENABLED = config.FAST2SMS_SMS_ENABLED

def __getattr__(name: str):
    """
    Delegate module-level attribute lookup to the `config` instance dynamically.
    Ensures that runtime modifications or test patches on `config.<name>` are mirrored.
    """
    if hasattr(config, name):
        return getattr(config, name)
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

