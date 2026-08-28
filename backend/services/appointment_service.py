from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Tuple
from database.mongodb import get_db, serialize_doc, serialize_docs
from services.ml_service import predict_consultation_duration
from services.travel_service import calculate_travel_metrics
from services.notification_service import create_notification

IN_MEMORY_BOOKINGS = []

def generate_booking_id() -> str:
    try:
        db = get_db()
        count = db.appointments.count_documents({}) + 1
        return f"B{count:03d}"
    except Exception:
        return f"B{len(IN_MEMORY_BOOKINGS) + 1:03d}"

def book_appointment(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    """
    Advance Consultation Booking Engine:
    - Enforces STRICT 2-day advance booking limit.
    - Runs Random Forest ML model for consultation duration prediction.
    - Computes travel metrics & recommended departure time.
    - Generates BOOKING_CONFIRMED and DEPARTURE_REMINDER notifications.
    """
    patient_id = data.get("patient_id", "P001").strip()
    doctor_id = data.get("doctor_id", "D001").strip()
    department = data.get("department", "Cardiology").strip()
    consultation_date_str = data.get("consultation_date", "").strip()
    priority = data.get("priority", "normal").strip().lower()
    symptoms = data.get("symptoms", [])
    custom_symptoms = data.get("custom_symptoms", "").strip()

    if not consultation_date_str:
        consultation_date_str = date.today().isoformat()

    # 1. STRICT 2-DAY ADVANCE BOOKING RULE VALIDATION
    try:
        booking_date = datetime.strptime(consultation_date_str, "%Y-%m-%d").date()
        today = date.today()
        max_allowed_date = today + timedelta(days=2)

        if booking_date < today:
            return None, "Cannot book consultations for past dates"
        if booking_date > max_allowed_date:
            return None, "Appointments can only be booked up to 2 days in advance."
    except ValueError:
        return None, "Invalid date format. Use YYYY-MM-DD"

    booking_id = generate_booking_id()
    now_str = datetime.now(timezone.utc).isoformat()

    # 2. RANDOM FOREST ML PREDICTION FOR CONSULTATION DURATION
    predicted_duration = predict_consultation_duration(
        symptoms=symptoms,
        department=department,
        doctor_id=doctor_id,
        priority=priority
    )

    # 3. CALCULATE TRAVEL & DEPARTURE METRICS
    travel_info = calculate_travel_metrics(
        patient_address=data.get("address", "Patient Location")
    )

    booking_doc = {
        "booking_id": booking_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "department": department,
        "consultation_date": consultation_date_str,
        "priority": "emergency" if priority == "emergency" else "normal",
        "symptoms": symptoms,
        "custom_symptoms": custom_symptoms,
        "predicted_consultation_duration": predicted_duration,
        "room_number": "Room 204",
        "status": "booked",
        "travel_info": travel_info,
        "created_at": now_str
    }

    try:
        db = get_db()
        db.appointments.insert_one(booking_doc)
        updated = db.appointments.find_one({"booking_id": booking_id})
        res = serialize_doc(updated)
    except Exception:
        IN_MEMORY_BOOKINGS.append(booking_doc)
        res = serialize_doc(booking_doc)

    # 4. GENERATE IN-APP NOTIFICATIONS
    create_notification(
        patient_id=patient_id,
        notification_type="BOOKING_CONFIRMED",
        title="Consultation Booked Successfully",
        message=f"Confirmed for {consultation_date_str} with {doctor_id} ({department}). Room 204.",
        booking_id=booking_id
    )

    create_notification(
        patient_id=patient_id,
        notification_type="DEPARTURE_REMINDER",
        title="Departure Reminder",
        message=travel_info["departure_alert"],
        booking_id=booking_id
    )

    return res, None

def get_booking_by_id(booking_id: str) -> Optional[dict]:
    try:
        db = get_db()
        apt = db.appointments.find_one({"booking_id": booking_id})
        if apt:
            return serialize_doc(apt)
    except Exception:
        pass

    for b in IN_MEMORY_BOOKINGS:
        if b["booking_id"] == booking_id:
            return serialize_doc(b)
    return None

def get_patient_appointments(patient_id: str) -> List[dict]:
    try:
        db = get_db()
        apts = list(db.appointments.find({"patient_id": patient_id}).sort("created_at", -1))
        if apts:
            return serialize_docs(apts)
    except Exception:
        pass

    user_apts = [b for b in IN_MEMORY_BOOKINGS if b.get("patient_id") == patient_id]
    user_apts.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return serialize_docs(user_apts)
