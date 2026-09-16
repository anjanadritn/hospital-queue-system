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
    try:
        db = get_db()
        for seed_u in INITIAL_USERS:
            db.users.update_one(
                {"phone": seed_u["phone"]},
                {"$set": dict(seed_u)},
                upsert=True
            )
    except Exception as e:
        logger.warning(f"init_seed_users warning: {e}")

    for seed_u in INITIAL_USERS:
        found = False
        for idx, u in enumerate(IN_MEMORY_USERS):
            if u.get("phone") == seed_u["phone"]:
                IN_MEMORY_USERS[idx] = dict(seed_u)
                found = True
                break
        if not found:
            IN_MEMORY_USERS.append(dict(seed_u))

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
        clean_token = token.replace("Bearer ", "").strip()
        decoded = jwt.decode(clean_token, JWT_SECRET, algorithms=["HS256"])
        return decoded
    except Exception:
        return None

def normalize_phone(phone_input: str) -> str:
    """Normalizes phone input to standard 10-digit number."""
    digits = re.sub(r"\D", "", str(phone_input).strip())
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits

def get_user_by_phone(phone: str) -> Optional[dict]:
    clean_phone = normalize_phone(phone)
    try:
        db = get_db()
        doc = db.users.find_one({"phone": clean_phone})
        if doc:
            return serialize_doc(doc)
    except Exception:
        pass

    for u in IN_MEMORY_USERS:
        if u.get("phone") == clean_phone:
            return serialize_doc(u)
    return None

def send_auth_otp(phone: str, purpose: str = "ACCOUNT_VERIFICATION") -> Tuple[Optional[dict], Optional[str]]:
    clean_phone = normalize_phone(phone)
    if not clean_phone or len(clean_phone) < 10:
        return None, "Valid 10-digit phone number is required"

    if purpose == "ACCOUNT_VERIFICATION":
        existing = get_user_by_phone(clean_phone)
        if existing:
            return None, f"An account with phone number '{clean_phone}' already exists. Please login."

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=5)
    otp_code = f"{random.randint(100000, 999999)}"

    otp_doc = {
        "phone": clean_phone,
        "purpose": purpose,
        "otp": otp_code,
        "created_at": now.isoformat(),
        "expires_at_ts": expires_at.timestamp(),
        "failed_attempts": 0,
        "verified": False
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

    # Dispatch via MSG91 if enabled (fail-safe: SMS failure does NOT break auth flow)
    sms_sent = False
    try:
        from services.sms_service import sms_service, mask_phone
        if getattr(config, "MSG91_SMS_ENABLED", False):
            success, res, err = sms_service.send_otp(clean_phone, otp_code)
            sms_sent = success
            if not success:
                logger.warning(
                    "MSG91 SMS OTP dispatch failed for %s: %s (continuing with auth flow)",
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

    if otp_doc.get("verified"):
        return False, "OTP has already been used"

    if now_ts > otp_doc.get("expires_at_ts", 0):
        return False, "OTP has expired. Please request a new OTP"

    if otp_doc.get("failed_attempts", 0) >= 5:
        return False, "Too many incorrect attempts. Please request a new OTP"

    if otp_doc.get("otp") != clean_otp:
        otp_doc["failed_attempts"] = otp_doc.get("failed_attempts", 0) + 1
        try:
            db = get_db()
            db.auth_otps.update_one(
                {"phone": clean_phone, "purpose": purpose},
                {"$inc": {"failed_attempts": 1}}
            )
        except Exception:
            pass
        return False, f"Invalid OTP code. {5 - otp_doc['failed_attempts']} attempt(s) remaining."

    # SUCCESS
    otp_doc["verified"] = True
    try:
        db = get_db()
        db.auth_otps.update_one(
            {"phone": clean_phone, "purpose": purpose},
            {"$set": {"verified": True}}
        )
    except Exception:
        pass

    return True, None

def register_patient(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    name = data.get("name", "").strip()
    phone = normalize_phone(data.get("phone", ""))
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    otp = data.get("otp", "").strip()

    if not name or not phone or not password:
        return None, "Full name, phone number, and password are required"

    if len(phone) < 10:
        return None, "Valid 10-digit phone number is required"

    # Verify OTP first
    if otp:
        ok, err = verify_auth_otp(phone, otp, "ACCOUNT_VERIFICATION")
        if not ok:
            return None, f"Phone verification failed: {err}"

    # Check if user exists
    existing = get_user_by_phone(phone)
    if existing:
        return None, "An account with this phone number already exists. Please login."

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
    except Exception:
        IN_MEMORY_USERS.append(user_doc)
        token = generate_jwt_token(user_doc)
        user_clean = serialize_doc(user_doc)
        user_clean.pop("password_hash", None)
        return {"user": user_clean, "token": token}, None

def login_user(phone: str, password: str, role: Optional[str] = None) -> Tuple[Optional[dict], Optional[str]]:
    clean_phone = normalize_phone(phone)
    if not clean_phone or len(clean_phone) < 10:
        return None, "Invalid phone number or password."

    user = get_user_by_phone(clean_phone)

    if not user:
        return None, "Invalid phone number or password."

    if not user.get("phone_verified"):
        return None, "Please verify your phone number before logging in."

    if not check_password_hash(user.get("password_hash", ""), password):
        return None, "Invalid phone number or password."

    # ROLE VALIDATION MATCHING
    if role and user.get("role") != role:
        return None, f"Selected role '{role}' does not match account credentials. Please select the correct role."

    token = generate_jwt_token(user)
    user_clean = dict(user)
    user_clean.pop("password_hash", None)

    return {
        "token": token,
        "user": user_clean,
        "redirect": "/staff" if user.get("role") in ["doctor", "admin"] else "/patient"
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
    except Exception:
        pass

    for u in IN_MEMORY_USERS:
        if u.get("phone") == clean_phone:
            u["password_hash"] = new_hash

    return True, None
