import re
import random
import logging
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, List
from werkzeug.security import generate_password_hash, check_password_hash
from database.mongodb import get_db, serialize_doc, serialize_docs
from config import config

logger = logging.getLogger(__name__)

JWT_SECRET = config.JWT_SECRET_KEY
DEVELOPMENT_MODE = True  # Set to True for local development and testing

IN_MEMORY_USERS = []
IN_MEMORY_AUTH_OTPS = {}

class DatabaseUnavailableError(Exception):
    """Raised when MongoDB is unreachable or query execution fails."""
    pass

INITIAL_USERS = [
    {
        "user_id": "U_ADMIN",
        "name": "System Administrator",
        "phone": "9999999999",
        "email": "admin@smarthospital.org",
        "password_hash": generate_password_hash("AdminPass123!"),
        "role": "admin",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D001",
        "doctor_id": "D001",
        "name": "Dr. Ananya Sharma",
        "phone": "9876543210",
        "email": "ananya.sharma@smarthospital.org",
        "password_hash": generate_password_hash("DoctorPass123!"),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D002",
        "doctor_id": "D002",
        "name": "Dr. Rajesh Kumar",
        "phone": "9876543220",
        "email": "rajesh.kumar@smarthospital.org",
        "password_hash": generate_password_hash("DoctorPass123!"),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_PAT_P001",
        "patient_id": "P001",
        "name": "Anjan",
        "phone": "9876543211",
        "email": "anjan@hospital.local",
        "password_hash": generate_password_hash("PatientPass123!"),
        "role": "patient",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_PAT_P002",
        "patient_id": "P002",
        "name": "Priya Sharma",
        "phone": "9876543212",
        "email": "priya@hospital.local",
        "password_hash": generate_password_hash("PatientPass123!"),
        "role": "patient",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

def init_seed_users():
    """
    Initializes initial default users in MongoDB without overwriting
    any existing user passwords or profile data.
    """
    try:
        db = get_db()
        for seed_u in INITIAL_USERS:
            db.users.update_one(
                {"phone": seed_u["phone"]},
                {"$setOnInsert": dict(seed_u)},
                upsert=True
            )
    except Exception as e:
        logger.warning(f"init_seed_users warning: {e}")

init_seed_users()

def generate_jwt_token(user: dict) -> str:
    payload = {
        "user_id": user.get("user_id"),
        "patient_id": user.get("patient_id"),
        "doctor_id": user.get("doctor_id"),
        "role": user.get("role", "patient"),
        "name": user.get("name"),
        "phone": user.get("phone"),
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_jwt_token(token: str) -> Optional[dict]:
    try:
        if not token:
            return None
        # Handle 'Bearer <token>' case-insensitively, and strip whitespace or quotes
        clean_token = re.sub(r"^bearer\s+", "", str(token).strip(), flags=re.IGNORECASE).strip()
        clean_token = clean_token.strip("\"'")
        decoded = jwt.decode(clean_token, JWT_SECRET, algorithms=["HS256"])
        return decoded
    except Exception:
        return None

def normalize_phone(phone_input) -> str:
    """
    Normalizes any Indian phone number format to a standard 10-digit number.
    Handles:
      - +91XXXXXXXXXX, +91 XXXXX XXXXX, +91-XXXXX-XXXXX
      - 91XXXXXXXXXX
      - 0091XXXXXXXXXX
      - 0XXXXXXXXXX (trunk prefix 0)
      - Standard 10-digit XXXXXXXXXX
      - Integers (e.g. 9876543210)
      - Formatted strings with spaces, dashes, parentheses, dots
    Always returns exactly 10 digits (or empty string if invalid).
    """
    if phone_input is None:
        return ""
    raw = str(phone_input).strip()
    if not raw:
        return ""

    # Remove all non-digit characters
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    # 1. Handle international 0091 prefix
    if digits.startswith("0091") and len(digits) >= 14:
        digits = digits[4:]
    # 2. Handle +91 or 91 country code prefix (12+ digits starting with 91)
    elif digits.startswith("91") and len(digits) > 10:
        digits = digits[2:]
    # 3. Handle 091 prefix (13 digits e.g. 0919876543210)
    elif digits.startswith("091") and len(digits) == 13:
        digits = digits[3:]
    # 4. Handle leading zero trunk prefix (11 digits e.g. 09876543210)
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]

    # 5. If still longer than 10 digits, take the trailing 10 digits
    if len(digits) > 10:
        digits = digits[-10:]

    return digits

def get_user_by_phone(phone: str) -> Optional[dict]:
    """
    Looks up a user by phone number from MongoDB (authoritative store).
    Always normalizes phone input to 10 digits and checks multiple representations
    (clean 10-digit string, +91 prefixed, integer) in MongoDB to find existing users.
    If MongoDB is unavailable or the query fails, raises DatabaseUnavailableError.
    Never falls back to stale in-memory data.
    """
    clean_phone = normalize_phone(phone)
    if not clean_phone or len(clean_phone) < 10:
        return None

    try:
        db = get_db()
        phone_variants = [
            clean_phone,
            f"+91{clean_phone}",
            f"+91 {clean_phone}",
            f"+91-{clean_phone}",
            f"91{clean_phone}",
            f"0{clean_phone}",
        ]
        try:
            phone_variants.append(int(clean_phone))
        except ValueError:
            pass

        doc = db.users.find_one({"phone": {"$in": phone_variants}})
        if doc:
            # If the phone in MongoDB is not the canonical 10-digit string, normalize it in place
            if str(doc.get("phone")) != clean_phone:
                try:
                    db.users.update_one({"_id": doc["_id"]}, {"$set": {"phone": clean_phone}})
                    doc["phone"] = clean_phone
                except Exception as norm_err:
                    logger.debug("Non-fatal: could not update phone to normalized form: %s", norm_err)
            return serialize_doc(doc)
    except Exception as db_err:
        logger.error("[get_user_by_phone] MongoDB query failed for phone %s: %s",
                     clean_phone, db_err)
        raise DatabaseUnavailableError(f"Database unavailable: {db_err}") from db_err

    return None

def send_auth_otp(phone: str, purpose: str = "ACCOUNT_VERIFICATION") -> Tuple[Optional[dict], Optional[str]]:
    clean_phone = normalize_phone(phone)
    if not clean_phone or len(clean_phone) < 10:
        return None, "Valid 10-digit phone number is required"

    try:
        if purpose == "ACCOUNT_VERIFICATION":
            existing = get_user_by_phone(clean_phone)
            if existing:
                return None, f"An account with phone number '{clean_phone}' already exists. Please login."
        elif purpose in ("PASSWORD_RESET", "LOGIN"):
            existing = get_user_by_phone(clean_phone)
            if not existing:
                return None, f"No account found with phone number '{clean_phone}'."
    except DatabaseUnavailableError:
        return None, "Database service is temporarily unavailable. Please try again later."

    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()
    expires_at = now + timedelta(minutes=5)

    # 1. RESEND PROTECTION & RATE LIMITING
    existing_otp = None
    try:
        db = get_db()
        existing_otp = db.auth_otps.find_one({"phone": clean_phone, "purpose": purpose})
    except Exception:
        pass

    if not existing_otp:
        existing_otp = IN_MEMORY_AUTH_OTPS.get(f"{clean_phone}_{purpose}")

    window_start_ts = now_ts
    resend_count = 1

    if existing_otp:
        last_created_ts = existing_otp.get("created_at_ts", 0)
        time_since_last = now_ts - last_created_ts

        # 30-second cooldown between requests
        if time_since_last < 30:
            wait_sec = max(1, int(30 - time_since_last))
            return None, f"Please wait {wait_sec} seconds before requesting another OTP."

        # Rolling 10-minute window rate limit (max 5 requests)
        prev_window_start = existing_otp.get("window_start_ts", last_created_ts)
        if now_ts - prev_window_start < 600:
            prev_count = existing_otp.get("resend_count", 1)
            if prev_count >= 5:
                return None, "Too many OTP requests for this phone number. Please try again in a few minutes."
            resend_count = prev_count + 1
            window_start_ts = prev_window_start
        else:
            window_start_ts = now_ts
            resend_count = 1

    # 2. GENERATE AND SECURELY HASH OTP (NO PLAINTEXT STORAGE)
    otp_code = f"{random.randint(100000, 999999)}"
    otp_hash = generate_password_hash(otp_code)

    otp_doc = {
        "phone": clean_phone,
        "purpose": purpose,
        "otp_hash": otp_hash,
        "created_at": now.isoformat(),
        "created_at_ts": now_ts,
        "expires_at_ts": expires_at.timestamp(),
        "failed_attempts": 0,
        "verified": False,
        "used": False,
        "resend_count": resend_count,
        "window_start_ts": window_start_ts
    }

    try:
        db = get_db()
        db.auth_otps.update_one(
            {"phone": clean_phone, "purpose": purpose},
            {"$set": otp_doc},
            upsert=True
        )
    except Exception:
        pass

    IN_MEMORY_AUTH_OTPS[f"{clean_phone}_{purpose}"] = otp_doc

    # 3. DISPATCH VIA FAST2SMS SERVICE IF ENABLED
    sms_sent = False
    try:
        from services.sms_service import sms_service, mask_phone
        if getattr(config, "FAST2SMS_SMS_ENABLED", False) or getattr(config, "MSG91_SMS_ENABLED", False):
            success, res, err = sms_service.send_otp(clean_phone, otp_code)
            sms_sent = bool(success)
            if not success:
                logger.warning(
                    "SMS OTP dispatch failed for %s: %s (continuing with auth flow)",
                    mask_phone(clean_phone),
                    err
                )
    except Exception as sms_ex:
        logger.warning("Unexpected error during SMS OTP dispatch: %s", type(sms_ex).__name__)

    response = {
        "message": f"OTP sent to {clean_phone} for {purpose}",
        "phone": clean_phone,
        "purpose": purpose,
        "development_otp": otp_code,
        "sms_sent": sms_sent
    }

    return response, None

def verify_auth_otp(phone: str, otp: str, purpose: str = "ACCOUNT_VERIFICATION") -> Tuple[bool, Optional[str]]:
    clean_phone = normalize_phone(phone)
    clean_otp = str(otp).strip()
    now_ts = datetime.now(timezone.utc).timestamp()

    if not clean_otp or len(clean_otp) != 6:
        return False, "A valid 6-digit OTP code is required"

    otp_doc = None
    try:
        db = get_db()
        doc = db.auth_otps.find_one({"phone": clean_phone, "purpose": purpose})
        if doc:
            otp_doc = serialize_doc(doc)
    except Exception:
        pass

    if not otp_doc:
        otp_doc = IN_MEMORY_AUTH_OTPS.get(f"{clean_phone}_{purpose}")

    if not otp_doc:
        return False, "OTP not found for this phone number"

    if otp_doc.get("verified") or otp_doc.get("used"):
        return False, "OTP has already been used"

    if now_ts > otp_doc.get("expires_at_ts", 0):
        return False, "OTP has expired. Please request a new OTP"

    if otp_doc.get("failed_attempts", 0) >= 5:
        return False, "Too many incorrect attempts. Please request a new OTP"

    # Verify against hashed OTP (with legacy fallback for existing records)
    is_valid = False
    stored_hash = otp_doc.get("otp_hash")
    if stored_hash:
        is_valid = check_password_hash(stored_hash, clean_otp)
    elif "otp" in otp_doc:
        is_valid = (str(otp_doc["otp"]).strip() == clean_otp)

    if not is_valid:
        new_failed = otp_doc.get("failed_attempts", 0) + 1
        otp_doc["failed_attempts"] = new_failed
        try:
            db = get_db()
            db.auth_otps.update_one(
                {"phone": clean_phone, "purpose": purpose},
                {"$inc": {"failed_attempts": 1}}
            )
        except Exception:
            pass
        remaining = max(0, 5 - new_failed)
        return False, f"Invalid OTP code. {remaining} attempt(s) remaining."

    # SUCCESS: Mark as verified
    otp_doc["verified"] = True
    otp_doc["verified_at_ts"] = now_ts
    try:
        db = get_db()
        db.auth_otps.update_one(
            {"phone": clean_phone, "purpose": purpose},
            {"$set": {"verified": True, "verified_at_ts": now_ts}}
        )
    except Exception:
        pass

    return True, None

def register_patient(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    name = data.get("name", "").strip()
    phone = normalize_phone(data.get("phone", ""))
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    otp = str(data.get("otp", "")).strip()

    if not name or not phone or not password:
        return None, "Full name, phone number, and password are required"

    if len(phone) < 10:
        return None, "Valid 10-digit phone number is required"

    # MANDATORY OTP VERIFICATION
    if not otp:
        return None, "OTP verification code is required to complete registration"

    ok, err = verify_auth_otp(phone, otp, "ACCOUNT_VERIFICATION")
    if not ok:
        return None, f"Phone verification failed: {err}"

    # Check if user already exists
    try:
        existing = get_user_by_phone(phone)
    except DatabaseUnavailableError:
        return None, "Database service is temporarily unavailable. Please try again later."
    if existing:
        return None, "An account with this phone number already exists. Please login."

    # SINGLE-USE PROTECTION: Mark OTP consumed/used immediately
    try:
        db = get_db()
        db.auth_otps.update_one(
            {"phone": phone, "purpose": "ACCOUNT_VERIFICATION"},
            {"$set": {"used": True, "verified": True}}
        )
    except Exception:
        pass
    if f"{phone}_ACCOUNT_VERIFICATION" in IN_MEMORY_AUTH_OTPS:
        IN_MEMORY_AUTH_OTPS[f"{phone}_ACCOUNT_VERIFICATION"]["used"] = True
        IN_MEMORY_AUTH_OTPS[f"{phone}_ACCOUNT_VERIFICATION"]["verified"] = True

    user_id = f"U_PAT_{random.randint(1000, 9999)}"
    patient_id = f"P{random.randint(100, 999)}"

    age = int(data["age"]) if "age" in data and data["age"] not in [None, ""] else None
    gender = str(data.get("gender", "")).strip() or None
    height_cm = float(data["height_cm"]) if "height_cm" in data and data["height_cm"] not in [None, ""] else None
    weight_kg = float(data["weight_kg"]) if "weight_kg" in data and data["weight_kg"] not in [None, ""] else None
    city = str(data.get("city") or data.get("address") or "Tumakuru").strip()
    address = str(data.get("address") or data.get("city") or "").strip()

    user_doc = {
        "user_id": user_id,
        "patient_id": patient_id,
        "name": name,
        "phone": phone,
        "email": email,
        "password_hash": generate_password_hash(password),
        "role": "patient",
        "age": age,
        "gender": gender,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "city": city,
        "address": address,
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        db = get_db()
        db.users.insert_one(user_doc)
        # Also create or update patient record in patients collection
        db.patients.update_one(
            {"patient_id": patient_id},
            {"$set": {
                "patient_id": patient_id,
                "user_id": user_id,
                "name": name,
                "phone": phone,
                "email": email,
                "age": age,
                "gender": gender,
                "height_cm": height_cm,
                "weight_kg": weight_kg,
                "city": city,
                "address": address,
                "created_at": user_doc["created_at"]
            }},
            upsert=True
        )
        token = generate_jwt_token(user_doc)
        user_clean = serialize_doc(user_doc)
        user_clean.pop("password_hash", None)
        return {"user": user_clean, "token": token}, None
    except Exception as db_err:
        logger.error("[register_patient] MongoDB insertion failed: %s", db_err)
        return None, "Database service is temporarily unavailable. Could not complete registration."

def login_user(phone: str, password: str, role: Optional[str] = None) -> Tuple[Optional[dict], Optional[str]]:
    clean_phone = normalize_phone(phone)
    if not clean_phone or len(clean_phone) < 10:
        return None, "Invalid phone number or password."

    try:
        user = get_user_by_phone(clean_phone)
    except DatabaseUnavailableError:
        return None, "Database service is temporarily unavailable. Please try again later."

    if not user:
        return None, "Invalid phone number or password."

    if not user.get("phone_verified", True):
        return None, "Please verify your phone number before logging in."

    # Verify password hash (check password_hash, or legacy password field if present)
    password_valid = False
    stored_hash = user.get("password_hash")
    if stored_hash:
        try:
            password_valid = check_password_hash(stored_hash, password)
        except Exception as hash_err:
            logger.warning("Error checking password hash: %s", hash_err)
            password_valid = False
    elif user.get("password"):
        # Legacy plain password support: check and auto-upgrade to password_hash
        if str(user.get("password")) == str(password):
            password_valid = True
            try:
                db = get_db()
                new_hash = generate_password_hash(password)
                db.users.update_one(
                    {"user_id": user.get("user_id")},
                    {"$set": {"password_hash": new_hash}, "$unset": {"password": ""}}
                )
            except Exception:
                pass

    if not password_valid:
        return None, "Invalid phone number or password."

    # ROLE VALIDATION MATCHING (case-insensitive)
    user_role = str(user.get("role", "patient")).lower()
    if role and user_role != str(role).lower():
        return None, f"Selected role '{role}' does not match account credentials. Please select the correct role."

    token = generate_jwt_token(user)
    user_clean = dict(user)
    user_clean.pop("password_hash", None)
    user_clean.pop("password", None)

    # Determine redirect strictly by role
    redirect_target = "/patient"
    if user_role == "admin":
        redirect_target = "/admin"
    elif user_role == "doctor":
        redirect_target = "/doctor"

    return {
        "token": token,
        "user": user_clean,
        "redirect": redirect_target
    }, None

def reset_password(phone: str, otp: str, new_password: str) -> Tuple[bool, Optional[str]]:
    clean_phone = normalize_phone(phone)
    ok, err = verify_auth_otp(clean_phone, otp, "PASSWORD_RESET")
    if not ok:
        return False, f"Password reset failed: {err}"

    new_hash = generate_password_hash(new_password)
    try:
        db = get_db()
        db.users.update_one({"phone": clean_phone}, {"$set": {"password_hash": new_hash}})
    except Exception as e:
        logger.error("Failed to update password in MongoDB: %s", e)
        return False, "Failed to update password in database."

    return True, None

def login_user_with_otp(phone: str, otp: str, role: Optional[str] = None) -> Tuple[Optional[dict], Optional[str]]:
    clean_phone = normalize_phone(phone)
    if not clean_phone or len(clean_phone) < 10:
        return None, "Invalid phone number or OTP."

    try:
        user = get_user_by_phone(clean_phone)
    except DatabaseUnavailableError:
        return None, "Database service is temporarily unavailable. Please try again later."
    if not user:
        return None, "No account found with this phone number."

    ok, err = verify_auth_otp(clean_phone, otp, "LOGIN")
    if not ok:
        return None, f"Login verification failed: {err}"

    # Consume the OTP (single use)
    try:
        db = get_db()
        db.auth_otps.update_one(
            {"phone": clean_phone, "purpose": "LOGIN"},
            {"$set": {"used": True}}
        )
    except Exception:
        pass
    if f"{clean_phone}_LOGIN" in IN_MEMORY_AUTH_OTPS:
        IN_MEMORY_AUTH_OTPS[f"{clean_phone}_LOGIN"]["used"] = True

    user_role = str(user.get("role", "patient")).lower()
    if role and user_role != str(role).lower():
        return None, f"Selected role '{role}' does not match account credentials. Please select the correct role."

    token = generate_jwt_token(user)
    user_clean = dict(user)
    user_clean.pop("password_hash", None)
    user_clean.pop("password", None)

    redirect_target = "/patient"
    if user_role == "admin":
        redirect_target = "/admin"
    elif user_role == "doctor":
        redirect_target = "/doctor"

    return {
        "token": token,
        "user": user_clean,
        "redirect": redirect_target
    }, None

def change_authenticated_password(user_identifier: str, current_password: str, new_password: str) -> Tuple[bool, Optional[str]]:
    """
    Safely changes an authenticated user's password.
    Validates current password using check_password_hash.
    Never stores or returns plain-text passwords.
    MongoDB is the only source.
    """
    if not current_password or not new_password:
        return False, "Both current password and new password are required."

    if len(new_password) < 6:
        return False, "New password must be at least 6 characters long."

    if current_password == new_password:
        return False, "New password cannot be identical to your current password."

    user = None
    db = get_db()
    if db:
        try:
            user = db.users.find_one({"$or": [{"user_id": user_identifier}, {"patient_id": user_identifier}, {"phone": user_identifier}]})
        except Exception as e:
            logger.warning(f"Error querying users for password change: {e}")

    if not user:
        return False, "User account not found."

    stored_hash = user.get("password_hash")
    if not stored_hash or not check_password_hash(stored_hash, current_password):
        return False, "Current password is incorrect."

    new_hash = generate_password_hash(new_password)
    now = datetime.now(timezone.utc).isoformat()

    if db:
        try:
            uid = user.get("user_id")
            pid = user.get("patient_id")
            phone = user.get("phone")
            db.users.update_one(
                {"$or": [{"user_id": uid}, {"patient_id": pid}, {"phone": phone}]},
                {"$set": {"password_hash": new_hash, "updated_at": now}}
            )
            if pid:
                db.patients.update_one(
                    {"patient_id": pid},
                    {"$set": {"password_hash": new_hash, "updated_at": now}}
                )
        except Exception as e:
            logger.error(f"Error updating password hash in MongoDB: {e}")
            return False, "Failed to update password in database."

    return True, None

