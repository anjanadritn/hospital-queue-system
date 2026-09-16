from flask import Blueprint, request, jsonify
from services.queue_service import (
    join_queue,
    get_queue_status,
    get_all_queues,
    escalate_emergency,
    mark_patient_arrived,
    update_queue_status,
    skip_patient_service
)
from services.rbac_middleware import require_auth
from services.auth_service import decode_jwt_token
from services.travel_service import calculate_travel_metrics, TUMKUR_LANDMARKS
from database.mongodb import get_db, serialize_docs

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
def doctor_queue_route(doctor_id):
    """Get queue for a specific doctor (accessible for OPD profile status)"""
    try:
        db = get_db()
        queue_items = list(db.queue.find({
            "doctor_id": doctor_id,
            "status": {"$in": ["waiting", "arrived", "ready", "called", "in_consultation"]}
        }).sort([("priority", -1), ("position", 1)]))
        return jsonify(serialize_docs(queue_items)), 200
    except Exception:
        res, error = get_all_queues()
        if error:
            return jsonify([]), 200
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

@queue_bp.route("/queue/verify-arrival-otp", methods=["POST"])
@require_auth(allowed_roles=["admin", "doctor"])
def verify_arrival_otp_route():
    """
    Arrival Verification Desk:
    Admin or reception staff verifies the patient's 6-digit arrival OTP when arriving at SIMSRH.
    Upon verification, the patient is marked as arrived and verified, allowing the doctor to proceed.
    """
    data = request.get_json(silent=True) or {}
    token_or_booking_id = data.get("token_or_booking_id") or data.get("queue_id") or data.get("booking_id")
    otp_code = str(data.get("otp") or data.get("otp_code") or data.get("arrival_otp") or "").strip()

    if not token_or_booking_id or not otp_code:
        return jsonify({"error": "token_or_booking_id and 6-digit otp are required"}), 400

    jwt_user = getattr(request, "current_user", {})
    verified_by = jwt_user.get("name") or jwt_user.get("user_id") or "Reception Admin"

    from services.otp_service import verify_arrival_otp
    success, error, queue_entry = verify_arrival_otp(token_or_booking_id, otp_code, verified_by=verified_by)
    if not success:
        return jsonify({"verified": False, "error": error}), 400

    return jsonify({
        "success": True,
        "verified": True,
        "message": f"Patient arrival verified successfully for {token_or_booking_id}. Queue status updated to arrived.",
        "queue_entry": queue_entry
    }), 200

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
    data = request.get_json(silent=True) or {}
    res, error = update_queue_status(queue_id, "completed", metadata=data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@queue_bp.route("/queue/<queue_id>/skip", methods=["POST"])
@require_auth(allowed_roles=["doctor", "admin"])
def skip_queue_route(queue_id):
    res, error = skip_patient_service(queue_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({
        "success": True,
        "message": f"Token {queue_id} marked as Missed Consultation and moved to end of active queue.",
        "data": res
    }), 200

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

@queue_bp.route("/travel/calculate", methods=["POST"])
def travel_calculate_route():
    data = request.get_json(silent=True) or {}
    origin = data.get("origin") or data.get("patient_address") or "Tumkur City"
    expected_iso = data.get("expected_consultation_iso")
    buffer_min = data.get("safety_buffer_min", 10)

    origin_coords = None
    lat = data.get("origin_latitude") if data.get("origin_latitude") is not None else data.get("latitude")
    lon = data.get("origin_longitude") if data.get("origin_longitude") is not None else data.get("longitude")
    if lat is not None and lon is not None:
        try:
            origin_coords = [float(lon), float(lat)]
        except (ValueError, TypeError):
            origin_coords = None
    elif data.get("origin_coords") and isinstance(data.get("origin_coords"), list):
        origin_coords = data.get("origin_coords")

    metrics = calculate_travel_metrics(
        patient_address=origin,
        expected_consultation_iso=expected_iso,
        safety_buffer_min=int(buffer_min),
        origin_coords=origin_coords
    )
    metrics["landmarks"] = list(TUMKUR_LANDMARKS.keys())
    return jsonify(metrics), 200