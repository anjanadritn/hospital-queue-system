from flask import Blueprint, request, jsonify
from services.appointment_service import (
    book_appointment,
    get_booking_by_id,
    get_patient_appointments,
    cancel_appointment
)
from services.rbac_middleware import require_auth

appointment_bp = Blueprint("appointment_bp", __name__)

@appointment_bp.route("/appointments/book", methods=["POST"])
@require_auth(allowed_roles=["patient"])
def book_appointment_route():
    data = request.get_json(silent=True) or {}
    
    # CRITICAL PATIENT ID SECURITY: Bind authenticated identity to booked_by and patient_id!
    jwt_user = getattr(request, "current_user", {})
    authenticated_patient_id = (
        jwt_user.get("patient_id")
        or jwt_user.get("user_id")
        or jwt_user.get("id")
        or jwt_user.get("sub")
    )
    if not authenticated_patient_id and jwt_user.get("phone"):
        try:
            from database.mongodb import get_db
            db = get_db()
            u = db.users.find_one({"phone": jwt_user["phone"]}) or db.patients.find_one({"phone": jwt_user["phone"]})
            if u:
                authenticated_patient_id = u.get("patient_id") or u.get("user_id")
        except Exception:
            pass
        if not authenticated_patient_id:
            authenticated_patient_id = f"P_{jwt_user['phone'][-6:]}"
    
    # SECURITY: Reject if no valid patient ID in JWT
    if not authenticated_patient_id:
        return jsonify({"error": "Unauthorized: No valid patient identifier in token"}), 401
    
    # Always stamp the authenticated booker
    data["booked_by"] = authenticated_patient_id
    data["booked_by_user_id"] = jwt_user.get("user_id")
    data["booked_by_patient_id"] = jwt_user.get("patient_id")
    data["booked_by_phone"] = jwt_user.get("phone")
    
    # If booking for myself, patient_id is always the authenticated patient
    if str(data.get("booking_for", "myself")).lower() == "myself" or not data.get("patient_id"):
        data["patient_id"] = authenticated_patient_id

    # GUARD: Block booking if doctor is on leave
    doctor_id = data.get("doctor_id")
    if doctor_id:
        try:
            from database.mongodb import get_db
            db = get_db()
            doctor_doc = db.doctors.find_one({"doctor_id": doctor_id})
            if doctor_doc and doctor_doc.get("on_leave"):
                doctor_name = doctor_doc.get("name", f"Dr. {doctor_id}")
                return jsonify({
                    "error": f"Dr. {doctor_name} is currently on leave and not accepting new appointments today. "
                             "Please choose another available doctor or contact the hospital reception."
                }), 400
        except Exception:
            pass  # If DB check fails, allow booking to proceed (fail-open for availability)

    res, error = book_appointment(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 201


@appointment_bp.route("/appointments/<booking_id>", methods=["GET"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def get_appointment(booking_id):
    jwt_user = getattr(request, "current_user", {})
    user_role = jwt_user.get("role")
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")
    auth_user_id = jwt_user.get("user_id")
    
    res = get_booking_by_id(booking_id)
    if not res:
        return jsonify({"error": f"Booking '{booking_id}' not found"}), 404
    
    # SECURITY: Patient can view appointments they booked or appointments for them!
    if user_role == "patient":
        booking_owners = {
            res.get("patient_id"),
            res.get("booked_by"),
            res.get("booked_by_patient_id"),
            res.get("booked_by_user_id"),
            res.get("user_id")
        }
        booking_owners.discard(None)
        booking_owners.discard("")
        if not ({auth_patient_id, auth_user_id} & booking_owners):
            return jsonify({"error": "Unauthorized: You can only view your own appointments"}), 403
    
    return jsonify(res), 200

@appointment_bp.route("/appointments/me", methods=["GET"])
@require_auth(allowed_roles=["patient"])
def get_my_appointments():
    jwt_user = getattr(request, "current_user", {})
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")
    res = get_patient_appointments(auth_patient_id)
    return jsonify(res), 200

@appointment_bp.route("/appointments/patient/<patient_id>", methods=["GET"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def get_appointments_for_patient(patient_id):
    jwt_user = getattr(request, "current_user", {})
    user_role = jwt_user.get("role")
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")
    auth_user_id = jwt_user.get("user_id")

    # Patient isolation: Patients can only access their own appointments!
    allowed_ids = {auth_patient_id, auth_user_id, "me"}
    allowed_ids.discard(None)
    if user_role == "patient" and patient_id not in allowed_ids:
        return jsonify({"error": "Unauthorized access. You can only view your own appointments."}), 403

    target_id = auth_patient_id if patient_id == "me" else patient_id
    res = get_patient_appointments(target_id)
    return jsonify(res), 200

@appointment_bp.route("/appointments/<booking_id>/cancel", methods=["POST"])
@require_auth(allowed_roles=["patient", "admin"])
def cancel_appointment_route(booking_id):
    jwt_user = getattr(request, "current_user", {})
    user_role = jwt_user.get("role")
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")

    if not auth_patient_id:
        return jsonify({"error": "Unauthorized: No valid identifier in token"}), 401

    data = request.get_json(silent=True) or {}
    reason = data.get("reason") or data.get("cancellation_reason")

    is_admin = (user_role == "admin")
    res, error, status_code = cancel_appointment(
        booking_id=booking_id,
        authenticated_patient_id=auth_patient_id,
        reason=reason,
        is_admin=is_admin
    )
    if error:
        return jsonify({"error": error}), status_code

    response_data = dict(res)
    response_data["message"] = "Appointment cancelled successfully."
    return jsonify(response_data), status_code

@appointment_bp.route("/appointments/slots", methods=["GET"])
def get_slots_availability():
    """
    Get live consultation slot availability and booking counts from the database.
    Query params:
      - date: YYYY-MM-DD (defaults to today)
      - doctor_id: optional doctor filter
      - department: optional department filter
    """
    consultation_date = request.args.get("date")
    doctor_id = request.args.get("doctor_id")
    department = request.args.get("department")

    from services.slot_service import get_slot_counts
    slot_data = get_slot_counts(
        consultation_date=consultation_date,
        doctor_id=doctor_id,
        department=department
    )
    return jsonify({
        "date": consultation_date or "",
        "slots": slot_data
    }), 200
