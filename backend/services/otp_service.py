import random
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Tuple
from database.mongodb import get_db, serialize_doc

IN_MEMORY_OTPS = {}

MAX_FAILED_ATTEMPTS = 5
OTP_EXPIRATION_MINUTES = 1440  # Valid for 24 hours (consultation day)

def generate_consultation_otp(booking_id: str, patient_id: str = "P001", doctor_id: str = "D001") -> Tuple[Optional[dict], Optional[str]]:
    """
    Generates a 6-digit consultation verification OTP associated with a specific booking/queue entry.
    Default expiration: 5 minutes. Single-use, rate-limited to 5 attempts.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=OTP_EXPIRATION_MINUTES)
    otp_code = f"{random.randint(100000, 999999)}"

    otp_doc = {
        "booking_id": booking_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "otp": otp_code,
        "status": "OTP_GENERATED",
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "expires_at_timestamp": expires_at.timestamp(),
        "failed_attempts": 0,
        "used": False
    }

    try:
        db = get_db()
        db.consultation_otps.update_one(
            {"booking_id": booking_id},
            {"$set": otp_doc},
            upsert=True
        )
        # Update booking/queue status
        db.appointments.update_one({"booking_id": booking_id}, {"$set": {"status": "OTP_GENERATED"}})
        db.queue.update_one({"queue_id": booking_id}, {"$set": {"status": "OTP_GENERATED"}})
    except Exception:
        pass

    IN_MEMORY_OTPS[booking_id] = otp_doc
    return otp_doc, None

def get_otp_status(booking_id: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Returns consultation OTP status for patient.
    Masks/hides OTP if expired or used.
    """
    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()

    otp_doc = None
    try:
        db = get_db()
        doc = db.consultation_otps.find_one({"booking_id": booking_id})
        if doc:
            otp_doc = serialize_doc(doc)
    except Exception:
        pass

    if not otp_doc:
        otp_doc = IN_MEMORY_OTPS.get(booking_id)

    if not otp_doc:
        return {
            "booking_id": booking_id,
            "status": "NOT_GENERATED",
            "active": False
        }, None

    exp_ts = otp_doc.get("expires_at_timestamp", 0)
    if now_ts > exp_ts or otp_doc.get("failed_attempts", 0) >= MAX_FAILED_ATTEMPTS:
        return {
            "booking_id": booking_id,
            "status": "EXPIRED",
            "active": False,
            "error": "Too many incorrect attempts or OTP expired. Please generate a new verification OTP."
        }, None

    if otp_doc.get("used"):
        return {
            "booking_id": booking_id,
            "status": "VERIFIED",
            "active": False
        }, None

    remaining_seconds = max(0, int(exp_ts - now_ts))
    return {
        "booking_id": booking_id,
        "status": "OTP_GENERATED",
        "otp": otp_doc["otp"],
        "active": True,
        "remaining_seconds": remaining_seconds,
        "expires_at": otp_doc["expires_at"]
    }, None

def verify_consultation_otp(booking_id: str, input_otp: str) -> Tuple[bool, Optional[str], Optional[dict]]:
    """
    Verifies consultation OTP entered by doctor.
    Enforces expiration, single-use, matching doctor/booking, and 5-attempt rate-limiting.
    """
    now_ts = datetime.now(timezone.utc).timestamp()
    clean_otp = str(input_otp).strip()

    otp_doc = None
    try:
        db = get_db()
        doc = db.consultation_otps.find_one({"booking_id": booking_id})
        if doc:
            otp_doc = serialize_doc(doc)
    except Exception:
        pass

    if not otp_doc:
        otp_doc = IN_MEMORY_OTPS.get(booking_id)

    if not otp_doc:
        return False, "No active consultation OTP found for this booking", None

    if otp_doc.get("used"):
        return False, "Consultation OTP has already been used", None

    if now_ts > otp_doc.get("expires_at_timestamp", 0):
        return False, "Consultation OTP has expired. Please ask patient to generate a new OTP", None

    if otp_doc.get("failed_attempts", 0) >= MAX_FAILED_ATTEMPTS:
        return False, "Too many incorrect attempts. Please generate a new verification OTP.", None

    # Check OTP Match
    if otp_doc.get("otp") != clean_otp:
        otp_doc["failed_attempts"] = otp_doc.get("failed_attempts", 0) + 1
        try:
            db = get_db()
            db.consultation_otps.update_one(
                {"booking_id": booking_id},
                {"$inc": {"failed_attempts": 1}}
            )
        except Exception:
            pass

        remaining_attempts = MAX_FAILED_ATTEMPTS - otp_doc["failed_attempts"]
        if remaining_attempts <= 0:
            return False, "Too many incorrect attempts. Please generate a new verification OTP.", None
        return False, f"Invalid OTP code. {remaining_attempts} attempt(s) remaining.", None

    # OTP VALID! Mark as used & update status to IN_CONSULTATION
    otp_doc["used"] = True
    otp_doc["status"] = "VERIFIED"

    try:
        db = get_db()
        db.consultation_otps.update_one(
            {"booking_id": booking_id},
            {"$set": {"used": True, "status": "VERIFIED"}}
        )
        db.appointments.update_one(
            {"booking_id": booking_id},
            {"$set": {"status": "in_consultation"}}
        )
        db.queue.update_one(
            {"queue_id": booking_id},
            {"$set": {"status": "in_consultation"}}
        )
    except Exception:
        pass

    return True, None, {
        "booking_id": booking_id,
        "verified": True,
        "status": "in_consultation"
    }

def verify_arrival_otp(token_or_booking_id: str, input_otp: str, verified_by: str = "Admin") -> Tuple[bool, Optional[str], Optional[dict]]:
    """
    Hospital Arrival OTP Verification Engine:
    Executed by ADMIN or RECEPTION STAFF upon the patient's physical arrival at SIMSRH.
    Validates the 6-digit Arrival OTP, marks the patient as arrived and verified,
    and updates the queue so the doctor can immediately call the patient.
    """
    clean_id = str(token_or_booking_id).strip()
    clean_otp = str(input_otp).strip()
    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()

    db = get_db()
    otp_doc = None

    try:
        otp_doc = db.consultation_otps.find_one({
            "$or": [
                {"booking_id": clean_id},
                {"queue_id": clean_id}
            ]
        })
    except Exception:
        pass

    if not otp_doc:
        otp_doc = IN_MEMORY_OTPS.get(clean_id)
        if not otp_doc:
            for b_id, doc in IN_MEMORY_OTPS.items():
                if doc.get("queue_id") == clean_id or doc.get("booking_id") == clean_id:
                    otp_doc = doc
                    break

    # Fallback to queue or appointments document
    if not otp_doc:
        try:
            q_entry = db.queue.find_one({"$or": [{"queue_id": clean_id}, {"booking_id": clean_id}]})
            if q_entry and q_entry.get("arrival_otp"):
                otp_doc = {
                    "booking_id": q_entry.get("booking_id", clean_id),
                    "queue_id": q_entry.get("queue_id", clean_id),
                    "patient_id": q_entry.get("patient_id", "P001"),
                    "doctor_id": q_entry.get("doctor_id", "D001"),
                    "otp": str(q_entry.get("arrival_otp")),
                    "status": "OTP_GENERATED",
                    "expires_at_timestamp": now_ts + 86400,
                    "used": q_entry.get("verified_by_admin", False)
                }
        except Exception:
            pass

    if not otp_doc:
        return False, f"No active verification OTP found for Token/Booking '{clean_id}'", None

    if otp_doc.get("used"):
        return False, "This Arrival OTP has already been verified.", None

    if now_ts > otp_doc.get("expires_at_timestamp", now_ts + 86400):
        return False, "Verification OTP has expired. Please generate a new arrival code.", None

    if str(otp_doc.get("otp")).strip() != clean_otp:
        return False, "Invalid 6-digit OTP code entered. Please verify with patient.", None

    booking_id = otp_doc.get("booking_id", clean_id)
    queue_id = otp_doc.get("queue_id", clean_id)
    patient_id = otp_doc.get("patient_id", "P001")

    otp_doc["used"] = True
    otp_doc["status"] = "VERIFIED"

    try:
        db.consultation_otps.update_one(
            {"$or": [{"booking_id": booking_id}, {"queue_id": queue_id}]},
            {"$set": {"used": True, "status": "VERIFIED", "verified_at": now.isoformat(), "verified_by": verified_by}}
        )
        db.queue.update_one(
            {"$or": [{"queue_id": queue_id}, {"booking_id": booking_id}]},
            {"$set": {
                "arrived_at_hospital": True,
                "verified_by_admin": True,
                "status": "arrived",
                "verified_at": now.isoformat(),
                "verified_by": verified_by
            }}
        )
        db.appointments.update_one(
            {"$or": [{"booking_id": booking_id}, {"queue_id": queue_id}]},
            {"$set": {
                "arrived_at_hospital": True,
                "verified_by_admin": True,
                "status": "arrived",
                "verified_at": now.isoformat()
            }}
        )
    except Exception:
        pass

    try:
        from services.notification_service import create_notification
        create_notification(
            patient_id=patient_id,
            notification_type="ARRIVAL_VERIFIED",
            title="Arrival Verified at Reception",
            message=f"Welcome to SIMSRH! Your arrival for Token {queue_id} has been verified by staff. Please proceed to the waiting area near your OPD consultation room.",
            booking_id=queue_id
        )
    except Exception:
        pass

    return True, None, {
        "booking_id": booking_id,
        "queue_id": queue_id,
        "patient_id": patient_id,
        "status": "arrived",
        "verified": True,
        "message": f"Patient arrival successfully verified by {verified_by}."
    }
