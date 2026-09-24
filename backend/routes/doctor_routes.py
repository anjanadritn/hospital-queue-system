from flask import Blueprint, request, jsonify
from services.doctor_service import (
    get_all_doctors, get_doctor_by_id, add_doctor, get_doctor_reviews, add_doctor_review
)

doctor_bp = Blueprint("doctors", __name__)

@doctor_bp.route("/doctors", methods=["GET"])
def list_doctors():
    department = request.args.get("department", "").strip()
    doctors = get_all_doctors(department_filter=department if department else None)
    return jsonify(doctors), 200

@doctor_bp.route("/doctors/<doctor_id>", methods=["GET"])
def get_doctor(doctor_id: str):
    doctor = get_doctor_by_id(doctor_id)
    if not doctor:
        return jsonify({"success": False, "error": "Doctor not found"}), 404
    return jsonify(doctor), 200

@doctor_bp.route("/doctors/<doctor_id>/reviews", methods=["GET"])
def doctor_reviews_route(doctor_id: str):
    reviews = get_doctor_reviews(doctor_id)
    return jsonify(reviews), 200

@doctor_bp.route("/doctors/<doctor_id>/reviews", methods=["POST"])
def submit_doctor_review_route(doctor_id: str):
    data = request.get_json(silent=True) or {}
    res, err = add_doctor_review(doctor_id, data)
    if err:
        return jsonify({"success": False, "error": err}), 400
    return jsonify(res), 201

@doctor_bp.route("/doctors", methods=["POST"])
def create_doctor():
    data = request.get_json(silent=True) or {}
    result, err = add_doctor(data)
    if err:
        return jsonify({"success": False, "error": err}), 400
    return jsonify(result), 201
