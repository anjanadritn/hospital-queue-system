from flask import Blueprint, request, jsonify
from services.queue_service import (
    join_queue,
    get_queue_status,
    get_all_queues,
    escalate_emergency,
    mark_patient_arrived,
    update_queue_status
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
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")
    
    # SECURITY: Reject if no valid patient ID in JWT
    if not auth_patient_id:
        return jsonify({"error": "Unauthorized: No valid patient identifier in token"}), 401
    
    data["patient_id"] = auth_patient_id

    res, error = join_queue(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 201

@queue_bp.route("/queue/status/<queue_id>", methods=["GET"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def queue_status_route(queue_id):
    """
    Private Queue Tracker Status:
    Patients can ONLY view their own queue status.
    Doctors and Admins can view any queue status for operational oversight.
    """
    jwt_user = getattr(request, "current_user", {})
    user_role = jwt_user.get("role", "patient")
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")

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

@queue_bp.route("/queue/doctor/<doctor_id>", methods=["GET"])
@require_auth(allowed_roles=["doctor", "admin"])
def doctor_queue_route(doctor_id):
    """Get queue for a specific doctor"""
    res, error = get_all_queues()
    if error:
        return jsonify({"error": error}), 400
    
    # Filter for this doctor only
    doctor_queue = [q for q in (res or []) if q.get("doctor_id") == doctor_id]
    return jsonify(doctor_queue), 200

@queue_bp.route("/queue/my", methods=["GET"])
@require_auth(allowed_roles=["patient"])
def my_queue_route():
    """Get current authenticated patient's active queue token"""
    jwt_user = getattr(request, "current_user", {})
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")
    
    from database.mongodb import get_db, serialize_doc
    db = get_db()
    
    try:
        queue_entry = db.queue.find_one({
            "patient_id": auth_patient_id,
            "status": {"$nin": ["completed", "cancelled", "no_show"]}
        }, sort=[("joined_at", -1)])
        
        if queue_entry:
            return jsonify(serialize_doc(queue_entry)), 200
    except Exception:
        pass
    
    return jsonify({"error": "No active queue found for this patient"}), 404

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
    queue_data, error = get_queue_status(queue_id)
    if error:
        return jsonify({"error": error}), 404

    jwt_user = getattr(request, "current_user", {})
    auth_patient_id = jwt_user.get("patient_id") or jwt_user.get("user_id")

    if queue_data.get("patient_id") and queue_data.get("patient_id") != auth_patient_id:
        return jsonify({
            "error": "Unauthorized access. You can only mark arrival for your own queue entry."
        }), 403

    res, error = mark_patient_arrived(queue_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@queue_bp.route("/queue/<queue_id>/call", methods=["POST"])
@require_auth(allowed_roles=["doctor", "admin"])
def call_patient_route(queue_id):
    res, error = update_queue_status(queue_id, "called")
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@queue_bp.route("/queue/<queue_id>/start", methods=["POST"])
@require_auth(allowed_roles=["doctor", "admin"])
def start_consultation_route(queue_id):
    res, error = update_queue_status(queue_id, "in_consultation")
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@queue_bp.route("/queue/<queue_id>/complete", methods=["POST"])
@require_auth(allowed_roles=["doctor", "admin"])
def complete_queue_route(queue_id):
    res, error = update_queue_status(queue_id, "completed")
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@queue_bp.route("/queue/<queue_id>/cancel", methods=["POST"])
@require_auth(allowed_roles=["patient", "doctor", "admin"])
def cancel_queue_route(queue_id):
    res, error = update_queue_status(queue_id, "cancelled")
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@queue_bp.route("/queue/<queue_id>/no-show", methods=["POST"])
@require_auth(allowed_roles=["doctor", "admin"])
def no_show_queue_route(queue_id):
    res, error = update_queue_status(queue_id, "no_show")
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200