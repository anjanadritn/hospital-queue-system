from flask import Blueprint, request, jsonify
from services.appointment_service import (
    book_appointment,
    get_booking_by_id,
    get_patient_appointments
)
from services.rbac_middleware import require_auth

appointment_bp = Blueprint("appointment_bp", __name__)

@appointment_bp.route("/appointments/book", methods=["POST"])
@require_auth(allowed_roles=["patient"])
def book_appointment_route():
    data = request.get_json(silent=True) or {}
    
    # CRITICAL PATIENT ID SECURITY: Override patient_id with authenticated JWT identity!
    jwt_user = getattr(request, "current_user", {})
    authenticated_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")
    
    # SECURITY: Reject if no valid patient ID in JWT
    if not authenticated_patient_id:
        return jsonify({"error": "Unauthorized: No valid patient identifier in token"}), 401
    
    data["patient_id"] = authenticated_patient_id

    res, error = book_appointment(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 201

@appointment_bp.route("/appointments/<booking_id>", methods=["GET"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def get_appointment(booking_id):
    # Add ownership verification
    jwt_user = getattr(request, "current_user", {})
    user_role = jwt_user.get("role")
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")
    
    res = get_booking_by_id(booking_id)
    if not res:
        return jsonify({"error": f"Booking '{booking_id}' not found"}), 404
    
    # SECURITY: Patient can only view their own appointments!
    if user_role == "patient":
        booking_patient_id = res.get("patient_id")
        if booking_patient_id and booking_patient_id != auth_patient_id:
            return jsonify({"error": "Unauthorized: You can only view your own appointments"}), 403
    
    return jsonify(res), 200

@appointment_bp.route("/appointments/patient/<patient_id>", methods=["GET"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def get_appointments_for_patient(patient_id):
    jwt_user = getattr(request, "current_user", {})
    user_role = jwt_user.get("role")
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")

    # Patient isolation: Patients can only access their own appointments!
    if user_role == "patient" and auth_patient_id != patient_id:
        return jsonify({"error": "Unauthorized access. You can only view your own appointments."}), 403

    res = get_patient_appointments(patient_id)
    return jsonify(res), 200

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
