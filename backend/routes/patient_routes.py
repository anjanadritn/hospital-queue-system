from flask import Blueprint, request, jsonify, g
from middleware.auth import jwt_required, roles_required
from utils.validators import validate_patient_payload
from services.patient_service import (
    create_patient_profile, get_patient_by_id, update_patient_profile, get_patient_by_user_id
)

patient_bp = Blueprint("patients", __name__, url_prefix="/patients")

@patient_bp.route("", methods=["POST"])
@jwt_required
def create_patient():
    data = request.get_json(silent=True) or {}
    is_valid, err_msg = validate_patient_payload(data)
    if not is_valid:
        return jsonify({"success": False, "error": err_msg}), 400

    current_user = g.current_user
    # Allow user to specify user_id if admin, else use current_user's user_id
    target_user_id = data.get("user_id", current_user["user_id"])
    if current_user["role"] != "admin" and target_user_id != current_user["user_id"]:
        return jsonify({"success": False, "error": "Cannot create profile for another user"}), 403

    result, err = create_patient_profile(target_user_id, data)
    if err:
        return jsonify({"success": False, "error": err}), 400

    return jsonify(result), 201

@patient_bp.route("/<patient_id>", methods=["GET"])
@jwt_required
def get_patient(patient_id: str):
    current_user = g.current_user
    patient = get_patient_by_id(patient_id)
    if not patient:
        return jsonify({"success": False, "error": "Patient profile not found"}), 404

    # Security check: Patient can only view own profile; Admin can view any
    if current_user["role"] != "admin" and patient["user_id"] != current_user["user_id"]:
        return jsonify({"success": False, "error": "Unauthorized access to patient profile"}), 403

    return jsonify(patient), 200

@patient_bp.route("/<patient_id>", methods=["PUT"])
@jwt_required
def update_patient(patient_id: str):
    data = request.get_json(silent=True) or {}
    current_user = g.current_user
    
    patient = get_patient_by_id(patient_id)
    if not patient:
        return jsonify({"success": False, "error": "Patient profile not found"}), 404

    # Security check: Patient can only update own profile; Admin can update any
    if current_user["role"] != "admin" and patient["user_id"] != current_user["user_id"]:
        return jsonify({"success": False, "error": "Unauthorized to modify this patient profile"}), 403

    result, err = update_patient_profile(patient_id, data)
    if err:
        return jsonify({"success": False, "error": err}), 400

    return jsonify(result), 200
