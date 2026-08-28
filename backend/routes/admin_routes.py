from flask import Blueprint, request, jsonify
from services.rbac_middleware import require_auth
from services.doctor_service import add_doctor, get_all_doctors
from database.mongodb import get_db, serialize_docs

admin_bp = Blueprint("admin_bp", __name__)

@admin_bp.route("/admin/stats", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def get_admin_system_stats():
    return jsonify({
        "system": "Smart Hospital Queue Management System",
        "status": "OPERATIONAL",
        "roles_enabled": ["patient", "doctor", "admin"],
        "authentication": "JWT_AND_PHONE_OTP"
    }), 200

@admin_bp.route("/admin/users", methods=["GET"])
@require_auth(allowed_roles=["admin"])
def list_system_users():
    try:
        db = get_db()
        users = list(db.users.find())
        clean = serialize_docs(users)
        for u in clean:
            u.pop("password_hash", None)
        return jsonify(clean), 200
    except Exception:
        from services.auth_service import IN_MEMORY_USERS
        clean = serialize_docs(IN_MEMORY_USERS)
        for u in clean:
            u.pop("password_hash", None)
        return jsonify(clean), 200

@admin_bp.route("/admin/doctors", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def admin_create_doctor():
    data = request.get_json(silent=True) or {}
    res, error = add_doctor(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 201
