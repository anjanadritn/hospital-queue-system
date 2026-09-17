from flask import Blueprint, request, jsonify
from services.prediction_service import predict_consultation_duration_service

prediction_bp = Blueprint("prediction", __name__)

@prediction_bp.route("/predict", methods=["POST"])
@prediction_bp.route("/predictions", methods=["POST"])
@prediction_bp.route("/predictions/predict", methods=["POST"])
def request_prediction():
    data = request.get_json(silent=True) or {}

    symptoms = data.get("symptoms")
    department = data.get("department")
    priority = data.get("priority")
    queue_position = data.get("queue_position")

    # 1. Validate symptoms: must be list of strings
    if symptoms is None or not isinstance(symptoms, list):
        return jsonify({
            "success": False,
            "error": "symptoms must be a list of strings"
        }), 400

    if not all(isinstance(s, str) for s in symptoms):
        return jsonify({
            "success": False,
            "error": "All items in symptoms list must be strings"
        }), 400

    # 2. Validate department: non-empty string
    if not department or not isinstance(department, str) or not department.strip():
        return jsonify({
            "success": False,
            "error": "department must be a non-empty string"
        }), 400

    # 3. Validate priority: "normal" or "emergency"
    if not priority or not isinstance(priority, str) or priority.lower() not in ["normal", "emergency"]:
        return jsonify({
            "success": False,
            "error": "priority must be 'normal' or 'emergency'"
        }), 400

    # 4. Validate queue_position: integer >= 1
    if queue_position is None or isinstance(queue_position, bool) or not isinstance(queue_position, int) or queue_position < 1:
        return jsonify({
            "success": False,
            "error": "queue_position must be an integer >= 1"
        }), 400

    predicted_duration = predict_consultation_duration_service(
        symptoms=symptoms,
        department=department.strip(),
        priority=priority.strip().lower(),
        queue_position=queue_position
    )

    return jsonify({
        "predicted_consultation_duration_min": predicted_duration
    }), 200
