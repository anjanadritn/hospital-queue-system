from flask import Blueprint, request, jsonify
from services.rbac_middleware import require_auth
from services.patient_service import (
    create_patient_profile, get_patient_by_id, update_patient_profile, get_patient_by_user_id,
    update_profile_picture
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


@patient_bp.route("/me/picture", methods=["PUT"])
@require_auth(allowed_roles=["patient"])
def update_my_profile_picture():
    """
    Upload or update profile picture for the authenticated patient.
    Accepts:
      - multipart/form-data with field 'picture' (file upload)
      - application/json with field 'image_base64' (base64 string) and 'mime_type'
    Validates type (jpeg/png/webp) and size (max 2 MB).
    JWT identity is used — patient can only update their OWN picture.
    """
    import base64
    current_user = getattr(request, "current_user", {})
    patient_id = current_user.get("patient_id") or current_user.get("user_id")

    image_bytes = None
    mime_type = None

    content_type = request.content_type or ""
    if "multipart/form-data" in content_type:
        # File upload via form
        file = request.files.get("picture")
        if not file:
            return jsonify({"success": False, "error": "No picture file provided in form field 'picture'"}), 400
        mime_type = file.content_type or "image/jpeg"
        image_bytes = file.read()
    else:
        # JSON body with base64
        data = request.get_json(silent=True) or {}
        b64_str = data.get("image_base64", "")
        mime_type = data.get("mime_type", "image/jpeg")
        if not b64_str:
            return jsonify({"success": False, "error": "No image data provided. Send 'image_base64' or use multipart/form-data."}), 400
        # Strip data-URI prefix if present
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        try:
            image_bytes = base64.b64decode(b64_str)
        except Exception:
            return jsonify({"success": False, "error": "Invalid base64 image data"}), 400

    result, err = update_profile_picture(patient_id, image_bytes, mime_type)
    if err:
        return jsonify({"success": False, "error": err}), 400

    return jsonify({"success": True, "patient": result}), 200

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
