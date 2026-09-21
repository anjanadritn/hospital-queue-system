import os
from dotenv import load_dotenv

# Explicitly load .env from the backend directory to ensure reliability
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ENV_PATH = os.path.join(_BACKEND_DIR, ".env")
if os.path.exists(_ENV_PATH):
    load_dotenv(dotenv_path=_ENV_PATH, override=True)
else:
    load_dotenv(override=True)

class Config:
    MONGO_URI = os.getenv("MONGO_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    MONGO_DATABASE = os.getenv("MONGO_DATABASE", os.getenv("MONGODB_DATABASE", "hospital_queue"))
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

