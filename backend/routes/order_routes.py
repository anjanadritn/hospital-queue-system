import logging
from flask import Blueprint, request, jsonify
from services.order_service import (
    create_pharmacy_order,
    get_pharmacy_order,
    list_pharmacy_orders,
    update_pharmacy_order_status,
    create_lab_order,
    get_lab_order,
    list_lab_orders,
    update_lab_order_status,
    PHARMACY_STATUS_FLOW,
    LAB_STATUS_FLOW
)

logger = logging.getLogger("smart-hospital-backend")

order_bp = Blueprint("order_bp", __name__)


# ============================================================
# PHARMACY ORDERS ENDPOINTS
# ============================================================

@order_bp.route("/pharmacy/orders", methods=["POST"])
@order_bp.route("/api/pharmacy/orders", methods=["POST"])
def create_pharmacy_order_route():
    """
    Create a new Pharmacy Order for prescription fulfillment.
    Payload:
      - patient_id (required, or consultation_id to autofill)
      - prescriptions or items (required list of medicines)
      - doctor_id, department, notes (optional)
    """
    data = request.get_json(silent=True) or {}
    order, error = create_pharmacy_order(data)
    if error:
        return jsonify({"success": False, "error": error}), 400
    return jsonify({"success": True, "order": order}), 201


@order_bp.route("/pharmacy/orders", methods=["GET"])
@order_bp.route("/api/pharmacy/orders", methods=["GET"])
def list_pharmacy_orders_route():
    """
    List pharmacy orders with optional query filters:
      - status: waiting | preparing | dispensed
      - patient_id: string
      - doctor_id: string
      - consultation_id: string
      - appointment_id / booking_id: string
    """
    filters = {
        "status": request.args.get("status"),
        "patient_id": request.args.get("patient_id"),
        "doctor_id": request.args.get("doctor_id"),
        "consultation_id": request.args.get("consultation_id"),
        "appointment_id": request.args.get("appointment_id") or request.args.get("booking_id")
    }
    # Clean None filters
    active_filters = {k: v for k, v in filters.items() if v is not None and str(v).strip() != ""}
    orders = list_pharmacy_orders(active_filters)
    return jsonify({"success": True, "orders": orders, "count": len(orders)}), 200


@order_bp.route("/pharmacy/orders/<order_id>", methods=["GET"])
@order_bp.route("/api/pharmacy/orders/<order_id>", methods=["GET"])
def get_pharmacy_order_route(order_id: str):
    """Get a single pharmacy order by order_id or consultation_id."""
    order = get_pharmacy_order(order_id)
    if not order:
        return jsonify({"success": False, "error": f"Pharmacy order '{order_id}' not found"}), 404
    return jsonify({"success": True, "order": order}), 200


@order_bp.route("/pharmacy/orders/<order_id>/status", methods=["PATCH", "PUT"])
@order_bp.route("/api/pharmacy/orders/<order_id>/status", methods=["PATCH", "PUT"])
def update_pharmacy_order_status_route(order_id: str):
    """
    Update pharmacy order status.
    Lifecycle: waiting -> preparing -> dispensed
    Payload:
      - status (required): preparing | dispensed
      - notes (optional): pharmacist notes
      - updated_by (optional): identifier of the updating staff member
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({
            "success": False,
            "error": f"'status' field is required. Allowed values: {', '.join(PHARMACY_STATUS_FLOW)}"
        }), 400

    notes = data.get("notes")
    updated_by = data.get("updated_by") or "pharmacist"

    updated_order, error = update_pharmacy_order_status(
        order_id=order_id,
        new_status=new_status,
        notes=notes,
        updated_by=updated_by
    )

    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"success": False, "error": error}), status_code

    return jsonify({"success": True, "order": updated_order}), 200


# ============================================================
# LABORATORY ORDERS ENDPOINTS
# ============================================================

@order_bp.route("/lab/orders", methods=["POST"])
@order_bp.route("/api/lab/orders", methods=["POST"])
def create_lab_order_route():
    """
    Create a new Laboratory Requisition Order.
    Payload:
      - patient_id (required, or consultation_id to autofill)
      - tests (required list of test names or objects)
      - doctor_id, department, clinical_indication, notes (optional)
    """
    data = request.get_json(silent=True) or {}
    order, error = create_lab_order(data)
    if error:
        return jsonify({"success": False, "error": error}), 400
    return jsonify({"success": True, "order": order}), 201


@order_bp.route("/lab/orders", methods=["GET"])
@order_bp.route("/api/lab/orders", methods=["GET"])
def list_lab_orders_route():
    """
    List laboratory orders with optional query filters:
      - status: waiting | sample_collected | processing | report_ready
      - patient_id: string
      - doctor_id: string
      - consultation_id: string
      - appointment_id / booking_id: string
    """
    filters = {
        "status": request.args.get("status"),
        "patient_id": request.args.get("patient_id"),
        "doctor_id": request.args.get("doctor_id"),
        "consultation_id": request.args.get("consultation_id"),
        "appointment_id": request.args.get("appointment_id") or request.args.get("booking_id")
    }
    active_filters = {k: v for k, v in filters.items() if v is not None and str(v).strip() != ""}
    orders = list_lab_orders(active_filters)
    return jsonify({"success": True, "orders": orders, "count": len(orders)}), 200


@order_bp.route("/lab/orders/<order_id>", methods=["GET"])
@order_bp.route("/api/lab/orders/<order_id>", methods=["GET"])
def get_lab_order_route(order_id: str):
    """Get a single laboratory order by order_id or consultation_id."""
    order = get_lab_order(order_id)
    if not order:
        return jsonify({"success": False, "error": f"Lab order '{order_id}' not found"}), 404
    return jsonify({"success": True, "order": order}), 200


@order_bp.route("/lab/orders/<order_id>/status", methods=["PATCH", "PUT"])
@order_bp.route("/api/lab/orders/<order_id>/status", methods=["PATCH", "PUT"])
def update_lab_order_status_route(order_id: str):
    """
    Update laboratory order status.
    Lifecycle: waiting -> sample_collected -> processing -> report_ready
    Payload:
      - status (required): sample_collected | processing | report_ready
      - notes (optional): technician notes
      - report_data (optional): findings / laboratory report details
      - updated_by (optional): identifier of staff member
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({
            "success": False,
            "error": f"'status' field is required. Allowed values: {', '.join(LAB_STATUS_FLOW)}"
        }), 400

    notes = data.get("notes")
    report_data = data.get("report_data")
    updated_by = data.get("updated_by") or "lab_technician"

    updated_order, error = update_lab_order_status(
        order_id=order_id,
        new_status=new_status,
        notes=notes,
        report_data=report_data,
        updated_by=updated_by
    )

    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"success": False, "error": error}), status_code

    return jsonify({"success": True, "order": updated_order}), 200
