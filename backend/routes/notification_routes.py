from flask import Blueprint, request, jsonify
from services.notification_service import (
    get_patient_notifications,
    mark_notification_read,
    mark_all_notifications_read
)
from services.rbac_middleware import require_auth

notification_bp = Blueprint("notification_bp", __name__)

@notification_bp.route("/notifications/<patient_id>", methods=["GET"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def get_notifications_route(patient_id):
    jwt_user = getattr(request, "current_user", {})
    user_role = jwt_user.get("role")
    auth_id = jwt_user.get("patient_id") or jwt_user.get("user_id") or jwt_user.get("doctor_id")

    # Patient isolation check
    if user_role == "patient" and auth_id != patient_id:
        return jsonify({"error": "Unauthorized access. You can only view your own notifications."}), 403

    res = get_patient_notifications(patient_id)
    return jsonify(res), 200

@notification_bp.route("/notifications/<notification_id>/read", methods=["POST"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def mark_read_route(notification_id):
    res, error = mark_notification_read(notification_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@notification_bp.route("/notifications/patient/<patient_id>/read-all", methods=["POST"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def mark_all_read_route(patient_id):
    jwt_user = getattr(request, "current_user", {})
    user_role = jwt_user.get("role")
    auth_id = jwt_user.get("patient_id") or jwt_user.get("user_id") or jwt_user.get("doctor_id")
    if user_role == "patient" and auth_id != patient_id:
        return jsonify({"error": "Unauthorized access. You can only mark your own notifications as read."}), 403

    res, error = mark_all_notifications_read(patient_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200
