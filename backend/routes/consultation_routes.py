from flask import Blueprint, request, jsonify
from services.otp_service import generate_consultation_otp, get_otp_status, verify_consultation_otp
from services.queue_service import complete_consultation, get_queue_status
from services.rbac_middleware import require_auth

consultation_bp = Blueprint("consultation_bp", __name__)

@consultation_bp.route("/consultation/<booking_id>/generate-otp", methods=["POST"])
@require_auth(allowed_roles=["patient"])
def request_generate_consultation_otp(booking_id):
    jwt_user = getattr(request, "current_user", {})
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")

    # Verify queue/booking exists and belongs to authenticated patient
    queue_data, _ = get_queue_status(booking_id)
    if queue_data and queue_data.get("patient_id") and queue_data.get("patient_id") != auth_patient_id:
        return jsonify({"error": "Unauthorized access. You can only generate consultation OTP for your own booking."}), 403

    data = request.get_json(silent=True) or {}
    patient_id = auth_patient_id
    doctor_id = data.get("doctor_id", "D001")

    res, error = generate_consultation_otp(booking_id, patient_id, doctor_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(res), 200

@consultation_bp.route("/consultation/<booking_id>/otp-status", methods=["GET"])
def request_otp_status(booking_id):
    res, error = get_otp_status(booking_id)
    return jsonify(res), 200

@consultation_bp.route("/doctor/consultation/<booking_id>/verify-otp", methods=["POST"])
def request_verify_consultation_otp(booking_id):
    """
    Doctor Verification: Requires 6-digit consultation OTP provided by patient.
    """
    data = request.get_json(silent=True) or {}
    otp = data.get("otp", "")
    if not otp:
        return jsonify({"verified": False, "error": "6-digit OTP code is required"}), 400

    verified, error, _ = verify_consultation_otp(booking_id, otp)
    if not verified:
        return jsonify({"verified": False, "error": error}), 400

    return jsonify({
        "verified": True,
        "booking_id": booking_id,
        "status": "in_consultation"
    }), 200

@consultation_bp.route("/doctor/consultation/<booking_id>/complete", methods=["POST"])
def request_complete_consultation(booking_id):
    data = request.get_json(silent=True) or {}
    actual_duration = data.get("actual_duration_mins", 15)

    res, error = complete_consultation(booking_id, actual_duration)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(res), 200
