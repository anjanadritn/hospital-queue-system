from flask import Blueprint, request, jsonify
from services.queue_service import (
    join_queue,
    get_queue_status,
    get_all_queues,
    escalate_emergency,
    mark_patient_arrived
)
from services.rbac_middleware import require_auth
from services.auth_service import decode_jwt_token

queue_bp = Blueprint("queue_bp", __name__)

@queue_bp.route("/queue/join", methods=["POST"])
@require_auth(allowed_roles=["patient"])
def join_queue_route():
    data = request.get_json(silent=True) or {}
    
    # CRITICAL PATIENT ID SECURITY: Override patient_id with authenticated JWT identity!
    jwt_user = getattr(request, "current_user", {})
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id") or "P001"
    data["patient_id"] = auth_patient_id

    res, error = join_queue(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 201

@queue_bp.route("/queue/status/<queue_id>", methods=["GET"])
def queue_status_route(queue_id):
    """
    Private Queue Tracker Status:
    Requires authentication. Patients can ONLY view their own queue status.
    Doctors and Admins can view any queue status for operational oversight.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return jsonify({
            "error": "Authentication required. Please login to track your consultation queue."
        }), 401

    decoded = decode_jwt_token(auth_header)
    if not decoded:
        return jsonify({
            "error": "Your session has expired. Please login again to track your queue."
        }), 401

    user_role = decoded.get("role", "patient")
    auth_patient_id = decoded.get("patient_id") or decoded.get("user_id")

    res, error = get_queue_status(queue_id)
    if error:
        return jsonify({"error": error}), 404

    # PATIENT OWNERSHIP SECURITY: Patients can only view their own queue entries!
    if user_role == "patient":
        target_patient_id = res.get("patient_id")
        if target_patient_id and target_patient_id != auth_patient_id:
            return jsonify({
                "error": "Unauthorized access. You don't have permission to view this queue information."
            }), 403

    return jsonify(res), 200

@queue_bp.route("/queue/all", methods=["GET"])
@require_auth(allowed_roles=["doctor", "admin"])
def all_queues_route():
    department = request.args.get("department", "")
    res, error = get_all_queues(department)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@queue_bp.route("/queue/emergency", methods=["POST"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def emergency_route():
    data = request.get_json(silent=True) or {}
    queue_id = data.get("queue_id")
    if not queue_id:
        return jsonify({"error": "queue_id is required"}), 400

    res, error = escalate_emergency(queue_id)
    if error:
        return jsonify({"error": error}), 400
    res["success"] = True
    res["new_position"] = res.get("position", 1)
    return jsonify(res), 200

@queue_bp.route("/queue/<queue_id>/arrive", methods=["POST"])
@require_auth(allowed_roles=["patient"])
def mark_arrived_route(queue_id):
    # Verify queue entry exists and belongs to authenticated patient identity
    queue_data, error = get_queue_status(queue_id)
    if error:
        return jsonify({"error": error}), 404

    jwt_user = getattr(request, "current_user", {})
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")

    # PATIENT OWNERSHIP VERIFICATION
    if queue_data.get("patient_id") and queue_data.get("patient_id") != auth_patient_id:
        return jsonify({
            "error": "Unauthorized access. You can only mark arrival for your own queue entry."
        }), 403

    res, error = mark_patient_arrived(queue_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200
