from flask import Blueprint, request, jsonify
from services.rbac_middleware import require_auth
from services.department_service import (
    get_all_departments, get_department_by_id, create_department, update_department, soft_delete_department
)

department_bp = Blueprint("departments", __name__, url_prefix="/departments")

@department_bp.route("", methods=["GET"])
def list_departments():
    departments = get_all_departments(active_only=False)
    return jsonify(departments), 200

@department_bp.route("/<department_id>", methods=["GET"])
def get_department(department_id: str):
    dept = get_department_by_id(department_id)
    if not dept:
        return jsonify({"success": False, "error": "Department not found"}), 404

    return jsonify(dept), 200

@department_bp.route("", methods=["POST"])
@require_auth(allowed_roles=["admin"])
def add_department():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"success": False, "error": "Department name is required"}), 400

    result, err = create_department(data)
    if err:
        return jsonify({"success": False, "error": err}), 409

    return jsonify(result), 201

@department_bp.route("/<department_id>", methods=["PUT"])
@require_auth(allowed_roles=["admin"])
def edit_department(department_id: str):
    data = request.get_json(silent=True) or {}
    result, err = update_department(department_id, data)
    if err:
        return jsonify({"success": False, "error": err}), 404 if "not found" in err else 400

    return jsonify(result), 200

@department_bp.route("/<department_id>", methods=["DELETE"])
@require_auth(allowed_roles=["admin"])
def remove_department(department_id: str):
    success, err = soft_delete_department(department_id)
    if not success:
        return jsonify({"success": False, "error": err or "Failed to deactivate department"}), 404

    return jsonify({"success": True, "message": f"Department {department_id} deactivated successfully"}), 200
