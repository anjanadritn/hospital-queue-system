from flask import Blueprint, request, jsonify
from services.rbac_middleware import require_auth
from services.patient_service import (
    create_patient_profile, get_patient_by_id, update_patient_profile, get_patient_by_user_id
)
from services.consultation_service import (
    get_patient_consultations, get_consultation_by_id
)
from database.mongodb import get_db, serialize_docs

patient_bp = Blueprint("patients", __name__, url_prefix="/patients")

@patient_bp.route("", methods=["POST"])
@require_auth(allowed_roles=["patient", "admin"])
def create_patient():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"success": False, "error": "Patient name is required"}), 400

    current_user = getattr(request, "current_user", {})
    target_user_id = data.get("user_id") or current_user.get("user_id")
    if current_user.get("role") != "admin" and target_user_id != current_user.get("user_id"):
        return jsonify({"success": False, "error": "Cannot create profile for another user"}), 403

    result, err = create_patient_profile(target_user_id, data)
    if err:
        return jsonify({"success": False, "error": err}), 400

    return jsonify(result), 201

@patient_bp.route("/me", methods=["GET"])
@require_auth(allowed_roles=["patient"])
def get_my_profile():
    current_user = getattr(request, "current_user", {})
    user_id = current_user.get("user_id")
    patient = get_patient_by_user_id(user_id)
    if not patient:
        # Fallback to current user info
        return jsonify({
            "patient_id": current_user.get("patient_id") or f"P_{user_id}",
            "user_id": user_id,
            "name": current_user.get("name", "Patient"),
            "phone": current_user.get("phone", ""),
            "email": current_user.get("email", ""),
            "age": current_user.get("age"),
            "gender": current_user.get("gender"),
            "city": current_user.get("city") or "Tumakuru",
            "height_cm": current_user.get("height_cm"),
            "weight_kg": current_user.get("weight_kg")
        }), 200
    return jsonify(patient), 200

@patient_bp.route("/me", methods=["PUT"])
@require_auth(allowed_roles=["patient"])
def update_my_profile():
    data = request.get_json(silent=True) or {}
    current_user = getattr(request, "current_user", {})
    patient_id = current_user.get("patient_id") or current_user.get("user_id")

    result, err = update_patient_profile(patient_id, data)
    if err:
        return jsonify({"success": False, "error": err}), 400

    return jsonify(result), 200

@patient_bp.route("/me/history", methods=["GET"])
@require_auth(allowed_roles=["patient"])
def get_my_medical_history():
    current_user = getattr(request, "current_user", {})
    patient_id = current_user.get("patient_id") or current_user.get("user_id")

    consultations = get_patient_consultations(patient_id)
    return jsonify({
        "success": True,
        "patient_id": patient_id,
        "consultations": consultations,
        "total_consultations": len(consultations)
    }), 200

@patient_bp.route("/<patient_id>", methods=["GET"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def get_patient(patient_id: str):
    current_user = getattr(request, "current_user", {})
    patient = get_patient_by_id(patient_id)
    if not patient:
        return jsonify({"success": False, "error": "Patient profile not found"}), 404

    # Security check: Patient can only view own profile; Doctor/Admin can view any
    if current_user.get("role") == "patient":
        auth_patient_id = current_user.get("patient_id") or current_user.get("user_id")
        if patient.get("patient_id") != auth_patient_id and patient.get("user_id") != current_user.get("user_id"):
            return jsonify({"success": False, "error": "Unauthorized access to patient profile"}), 403

    return jsonify(patient), 200

@patient_bp.route("/<patient_id>", methods=["PUT"])
@require_auth(allowed_roles=["patient", "admin"])
def update_patient(patient_id: str):
    data = request.get_json(silent=True) or {}
    current_user = getattr(request, "current_user", {})

    patient = get_patient_by_id(patient_id)
    if not patient:
        return jsonify({"success": False, "error": "Patient profile not found"}), 404

    # Security check: Patient can only update own profile; Admin can update any
    if current_user.get("role") != "admin":
        auth_patient_id = current_user.get("patient_id") or current_user.get("user_id")
        if patient.get("patient_id") != auth_patient_id and patient.get("user_id") != current_user.get("user_id"):
            return jsonify({"success": False, "error": "Unauthorized to modify this patient profile"}), 403

    result, err = update_patient_profile(patient_id, data)
    if err:
        return jsonify({"success": False, "error": err}), 400

    return jsonify(result), 200

@patient_bp.route("/<patient_id>/history", methods=["GET"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def get_patient_history(patient_id: str):
    """Retrieve completed consultations, appointments, and prescriptions history chronologically"""
    current_user = getattr(request, "current_user", {})
    if current_user.get("role") == "patient":
        auth_patient_id = current_user.get("patient_id") or current_user.get("user_id")
        if patient_id != auth_patient_id:
            return jsonify({"error": "Unauthorized access to patient history"}), 403

    consultations = get_patient_consultations(patient_id)

    # Also include legacy appointments for backward compatibility if needed
    try:
        db = get_db()
        apt_records = list(db.appointments.find({"patient_id": patient_id}).sort([("consultation_date", -1)]))
    except Exception:
        apt_records = []

    return jsonify({
        "success": True,
        "patient_id": patient_id,
        "consultations": consultations,
        "appointments": serialize_docs(apt_records),
        "total_consultations": len(consultations),
        "total_visits": len(consultations)
    }), 200

@patient_bp.route("/records/<consultation_id>", methods=["GET"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def get_single_consultation_record(consultation_id: str):
    """Retrieve full clinical consultation record sheet"""
    record = get_consultation_by_id(consultation_id)
    if not record:
        return jsonify({"error": "Consultation record not found"}), 404

    current_user = getattr(request, "current_user", {})
    if current_user.get("role") == "patient":
        auth_patient_id = current_user.get("patient_id") or current_user.get("user_id")
        if record.get("patient_id") and record.get("patient_id") != auth_patient_id:
            return jsonify({"error": "Unauthorized access to this consultation record"}), 403

    return jsonify({"success": True, "record": record}), 200
