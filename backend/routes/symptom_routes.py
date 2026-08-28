from flask import Blueprint, request, jsonify
from services.symptom_service import get_all_symptoms, search_symptoms

symptom_bp = Blueprint("symptom_bp", __name__)

@symptom_bp.route("/symptoms", methods=["GET"])
def list_symptoms():
    q = request.args.get("q", "").strip()
    if q:
        results = search_symptoms(q)
    else:
        results = get_all_symptoms()
    return jsonify(results), 200

@symptom_bp.route("/symptoms/search", methods=["GET"])
def search_symptoms_endpoint():
    q = request.args.get("q", "").strip()
    results = search_symptoms(q)
    return jsonify(results), 200
