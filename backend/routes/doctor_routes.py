from flask import Blueprint, request, jsonify
from services.doctor_service import get_all_doctors, get_doctor_by_id, add_doctor

doctor_bp = Blueprint("doctors", __name__)

@doctor_bp.route("/doctors", methods=["GET"])
def list_doctors():
    doctors = get_all_doctors()
    return jsonify(doctors), 200

@doctor_bp.route("/doctors/<doctor_id>", methods=["GET"])
def get_doctor(doctor_id: str):
    doctor = get_doctor_by_id(doctor_id)
    if not doctor:
        return jsonify({"success": False, "error": "Doctor not found"}), 404
    return jsonify(doctor), 200

@doctor_bp.route("/doctors", methods=["POST"])
def create_doctor():
    data = request.get_json(silent=True) or {}
    result, err = add_doctor(data)
    if err:
        return jsonify({"success": False, "error": err}), 400
    return jsonify(result), 201
