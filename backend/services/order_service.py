import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple, Any
from database.mongodb import get_db, serialize_doc, serialize_docs

logger = logging.getLogger("smart-hospital-backend")

# ============================================================
# STATUS DEFINITIONS & TRANSITION RULES
# ============================================================

# Pharmacy Order Statuses: waiting -> preparing -> dispensed
PHARMACY_STATUS_FLOW = ["waiting", "preparing", "dispensed"]
VALID_PHARMACY_TRANSITIONS = {
    "waiting": ["preparing"],
    "preparing": ["dispensed"],
    "dispensed": []
}

# Lab Order Statuses: waiting -> sample_collected -> processing -> report_ready
LAB_STATUS_FLOW = ["waiting", "sample_collected", "processing", "report_ready"]
VALID_LAB_TRANSITIONS = {
    "waiting": ["sample_collected"],
    "sample_collected": ["processing"],
    "processing": ["report_ready"],
    "report_ready": []
}


def _get_utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# PHARMACY ORDERS SERVICE
# ============================================================

def clean_prescription_item(p: Any) -> Optional[Dict]:
    """Clean a prescription item for pharmacy dispensing order."""
    if not isinstance(p, dict):
        return None
    medicine = str(p.get("medicine") or p.get("name") or "").strip()
    if not medicine:
        return None

    cleaned = {
        "medicine": medicine,
        "dosage": str(p.get("dosage") or "").strip(),
        "frequency": str(p.get("frequency") or "").strip(),
        "duration": str(p.get("duration") or "").strip(),
        "instructions": str(p.get("instructions") or "").strip()
    }
    if p.get("rxcui"):
        cleaned["rxcui"] = str(p["rxcui"]).strip()
    if p.get("term_type") or p.get("tty"):
        cleaned["term_type"] = str(p.get("term_type") or p.get("tty")).strip()
    if p.get("prescribable_name"):
        cleaned["prescribable_name"] = str(p.get("prescribable_name")).strip()
    return cleaned


def create_or_update_pharmacy_order_from_consultation(
    consultation_doc: Dict
) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Creates or updates a Pharmacy Order from structured prescriptions
    stored in a completed consultation record.
    Returns (order_doc, None) on success.
    """
    try:
        db = get_db()
        raw_prescriptions = consultation_doc.get("prescriptions") or []
        clean_items = []
        for p in raw_prescriptions:
            cleaned = clean_prescription_item(p)
            if cleaned:
                clean_items.append(cleaned)

        # If no prescriptions exist, preserve backward compatibility
        if not clean_items:
            return None, None

        consultation_id = consultation_doc.get("consultation_id")
        queue_id = consultation_doc.get("queue_id")
        booking_id = consultation_doc.get("booking_id")
        patient_id = consultation_doc.get("patient_id")
        patient_name = consultation_doc.get("patient_name") or "Patient"
        doctor_id = consultation_doc.get("doctor_id")
        doctor_name = consultation_doc.get("doctor_name") or "Medical Officer"
        department = consultation_doc.get("department") or "General Medicine"

        now_iso = _get_utc_now_iso()

        # Check if pharmacy order already exists for this consultation
        existing = db.pharmacy_orders.find_one({"consultation_id": consultation_id}) if consultation_id else None
        if existing:
            order_id = existing.get("order_id")
            update_data = {
                "prescriptions": clean_items,
                "items": clean_items,
                "patient_name": patient_name,
                "doctor_name": doctor_name,
                "department": department,
                "updated_at": now_iso
            }
            db.pharmacy_orders.update_one({"order_id": order_id}, {"$set": update_data})
            updated = db.pharmacy_orders.find_one({"order_id": order_id})
            return serialize_doc(updated), None

        # Create new pharmacy order
        unique_suffix = consultation_id.replace("CON_", "") if consultation_id else uuid.uuid4().hex[:8].upper()
        order_id = f"PHARM_{unique_suffix}"

        order_doc = {
            "order_id": order_id,
            "order_type": "pharmacy",
            "consultation_id": consultation_id,
            "queue_id": queue_id,
            "appointment_id": booking_id,
            "booking_id": booking_id,
            "patient_id": patient_id,
            "patient_name": patient_name,
            "doctor_id": doctor_id,
            "doctor_name": doctor_name,
            "department": department,
            "prescriptions": clean_items,
            "items": clean_items,
            "status": "waiting",  # waiting -> preparing -> dispensed
            "status_history": [
                {
                    "status": "waiting",
                    "timestamp": now_iso,
                    "updated_by": "system",
                    "notes": "Pharmacy order generated from completed consultation"
                }
            ],
            "notes": consultation_doc.get("doctor_assessment", {}).get("advice") or "",
            "created_at": now_iso,
            "updated_at": now_iso,
            "preparing_at": None,
            "dispensed_at": None
        }

        db.pharmacy_orders.insert_one(order_doc)
        logger.info(f"[Pharmacy] Auto-created order {order_id} for patient {patient_id}")
        return serialize_doc(order_doc), None
    except Exception as e:
        logger.error(f"[Pharmacy] Error creating order from consultation: {e}", exc_info=True)
        return None, str(e)


def create_pharmacy_order(data: Dict) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Creates a new Pharmacy Order via direct API.
    Required: patient_id (or consultation_id) and non-empty prescriptions.
    """
    try:
        db = get_db()
        consultation_id = data.get("consultation_id")
        patient_id = data.get("patient_id")
        appointment_id = data.get("appointment_id") or data.get("booking_id")
        queue_id = data.get("queue_id")
        doctor_id = data.get("doctor_id")
        doctor_name = data.get("doctor_name")
        patient_name = data.get("patient_name")
        department = data.get("department")

        # If consultation_id provided, look up existing consultation to autofill missing metadata
        if consultation_id:
            cons = db.consultations.find_one({"consultation_id": consultation_id})
            if cons:
                patient_id = patient_id or cons.get("patient_id")
                patient_name = patient_name or cons.get("patient_name")
                appointment_id = appointment_id or cons.get("booking_id")
                queue_id = queue_id or cons.get("queue_id")
                doctor_id = doctor_id or cons.get("doctor_id")
                doctor_name = doctor_name or cons.get("doctor_name")
                department = department or cons.get("department")

        if not patient_id:
            return None, "patient_id is required to create a pharmacy order"

        raw_prescriptions = data.get("prescriptions") or data.get("items") or []
        clean_items = []
        for p in raw_prescriptions:
            cleaned = clean_prescription_item(p)
            if cleaned:
                clean_items.append(cleaned)

        if not clean_items:
            return None, "At least one valid prescription item is required to create a pharmacy order"

        now_iso = _get_utc_now_iso()
        order_id = f"PHARM_{uuid.uuid4().hex[:8].upper()}"

        order_doc = {
            "order_id": order_id,
            "order_type": "pharmacy",
            "consultation_id": consultation_id,
            "queue_id": queue_id,
            "appointment_id": appointment_id,
            "booking_id": appointment_id,
            "patient_id": patient_id,
            "patient_name": patient_name or "Patient",
            "doctor_id": doctor_id or "D001",
            "doctor_name": doctor_name or "Attending Physician",
            "department": department or "General Medicine",
            "prescriptions": clean_items,
            "items": clean_items,
            "status": "waiting",
            "status_history": [
                {
                    "status": "waiting",
                    "timestamp": now_iso,
                    "updated_by": data.get("created_by") or "doctor",
                    "notes": data.get("notes") or "Prescription order initiated"
                }
            ],
            "notes": data.get("notes") or "",
            "created_at": now_iso,
            "updated_at": now_iso,
            "preparing_at": None,
            "dispensed_at": None
        }

        db.pharmacy_orders.insert_one(order_doc)
        logger.info(f"[Pharmacy] Created manual order {order_id} for patient {patient_id}")
        return serialize_doc(order_doc), None
    except Exception as e:
        logger.error(f"[Pharmacy] Error creating manual order: {e}", exc_info=True)
        return None, str(e)


def get_pharmacy_order(order_id: str) -> Optional[Dict]:
    """Retrieve a single pharmacy order by order_id or consultation_id."""
    try:
        db = get_db()
        doc = db.pharmacy_orders.find_one({"$or": [{"order_id": order_id}, {"consultation_id": order_id}]})
        return serialize_doc(doc)
    except Exception as e:
        logger.error(f"[Pharmacy] Error fetching order {order_id}: {e}", exc_info=True)
        return None


def resolve_patient_order_ids(patient_id: str) -> List[str]:
    """Resolves all linked identifier aliases (patient_id, user_id, phone) for a patient."""
    clean_pid = str(patient_id).strip()
    search_ids = {clean_pid}
    try:
        db = get_db()
        u = db.users.find_one({"$or": [{"patient_id": clean_pid}, {"user_id": clean_pid}, {"phone": clean_pid}]})
        if u:
            if u.get("patient_id"): search_ids.add(str(u["patient_id"]))
            if u.get("user_id"): search_ids.add(str(u["user_id"]))
            if u.get("phone"): search_ids.add(str(u["phone"]))
        p = db.patients.find_one({"$or": [{"patient_id": clean_pid}, {"phone": clean_pid}]})
        if p:
            if p.get("patient_id"): search_ids.add(str(p["patient_id"]))
            if p.get("user_id"): search_ids.add(str(p["user_id"]))
            if p.get("phone"): search_ids.add(str(p["phone"]))
    except Exception:
        pass
    return list(search_ids)


def list_pharmacy_orders(filters: Optional[Dict] = None) -> List[Dict]:
    """List pharmacy orders with optional filters."""
    try:
        db = get_db()
        clauses: List[Dict[str, Any]] = []
        if filters:
            if filters.get("status"):
                clauses.append({"status": str(filters["status"]).strip().lower()})
            if filters.get("patient_id"):
                pids = resolve_patient_order_ids(filters["patient_id"])
                clauses.append({"$or": [{"patient_id": {"$in": pids}}, {"user_id": {"$in": pids}}]})
            if filters.get("doctor_id"):
                clauses.append({"doctor_id": str(filters["doctor_id"]).strip()})
            if filters.get("consultation_id"):
                clauses.append({"consultation_id": str(filters["consultation_id"]).strip()})
            if filters.get("appointment_id") or filters.get("booking_id"):
                b_id = str(filters.get("appointment_id") or filters.get("booking_id")).strip()
                clauses.append({"$or": [{"appointment_id": b_id}, {"booking_id": b_id}]})

        query = {"$and": clauses} if clauses else {}
        docs = list(db.pharmacy_orders.find(query).sort("created_at", -1))
        return serialize_docs(docs)
    except Exception as e:
        logger.error(f"[Pharmacy] Error listing orders: {e}", exc_info=True)
        return []


def update_pharmacy_order_status(
    order_id: str,
    new_status: str,
    notes: Optional[str] = None,
    updated_by: Optional[str] = None
) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Updates a pharmacy order's status along the allowed lifecycle:
    waiting -> preparing -> dispensed
    """
    try:
        db = get_db()
        target_status = str(new_status).strip().lower()
        if target_status not in PHARMACY_STATUS_FLOW:
            return None, f"Invalid pharmacy status '{target_status}'. Allowed: {', '.join(PHARMACY_STATUS_FLOW)}"

        doc = db.pharmacy_orders.find_one({"order_id": order_id})
        if not doc:
            return None, f"Pharmacy order '{order_id}' not found"

        current_status = doc.get("status", "waiting")
        if current_status == target_status:
            return serialize_doc(doc), None

        allowed_next = VALID_PHARMACY_TRANSITIONS.get(current_status, [])
        if target_status not in allowed_next:
            return None, (
                f"Cannot transition pharmacy order from '{current_status}' to '{target_status}'. "
                f"Valid next status is: {', '.join(allowed_next) if allowed_next else 'None (terminal)'}"
            )

        now_iso = _get_utc_now_iso()
        update_set: Dict[str, Any] = {
            "status": target_status,
            "updated_at": now_iso
        }

        if target_status == "preparing":
            update_set["preparing_at"] = now_iso
        elif target_status == "dispensed":
            update_set["dispensed_at"] = now_iso
            # Dispatch in-app notification to patient
            patient_id = doc.get("patient_id")
            if patient_id:
                try:
                    from services.notification_service import create_notification
                    doc_name = doc.get("doctor_name") or "Attending Physician"
                    create_notification(
                        patient_id=patient_id,
                        notification_type="PHARMACY_DISPENSED",
                        title="Prescription Dispensed",
                        message=f"Your prescription from {doc_name} has been dispensed by the pharmacy and is ready for pickup at the pharmacy counter.",
                        booking_id=doc.get("booking_id") or doc.get("consultation_id"),
                        suppress_sms=True,
                        extra_fields={
                            "order_id": order_id,
                            "order_type": "pharmacy",
                            "status": "dispensed"
                        }
                    )
                except Exception as notif_err:
                    logger.warning(f"[Pharmacy] In-app notification error: {notif_err}")

        history_entry = {
            "status": target_status,
            "timestamp": now_iso,
            "updated_by": updated_by or "pharmacist",
            "notes": notes or f"Status changed from {current_status} to {target_status}"
        }

        db.pharmacy_orders.update_one(
            {"order_id": order_id},
            {
                "$set": update_set,
                "$push": {"status_history": history_entry}
            }
        )

        updated = db.pharmacy_orders.find_one({"order_id": order_id})
        logger.info(f"[Pharmacy] Order {order_id} transitioned: {current_status} -> {target_status}")
        return serialize_doc(updated), None
    except Exception as e:
        logger.error(f"[Pharmacy] Error updating order {order_id} status: {e}", exc_info=True)
        return None, str(e)


# ============================================================
# LABORATORY ORDERS SERVICE
# ============================================================

def clean_lab_test_item(t: Any) -> Optional[Dict]:
    """Clean a lab test item into a standardized structure."""
    if isinstance(t, str):
        test_name = t.strip()
        if not test_name:
            return None
        return {
            "test_name": test_name,
            "test_code": test_name.upper().replace(" ", "_"),
            "category": "General Pathology",
            "instructions": "Standard specimen collection"
        }
    elif isinstance(t, dict):
        test_name = str(t.get("test_name") or t.get("name") or "").strip()
        if not test_name:
            return None
        return {
            "test_name": test_name,
            "test_code": str(t.get("test_code") or t.get("code") or test_name.upper().replace(" ", "_")).strip(),
            "category": str(t.get("category") or "General Pathology").strip(),
            "instructions": str(t.get("instructions") or "Standard specimen collection").strip()
        }
    return None


def create_lab_order_from_consultation(
    consultation_doc: Dict,
    lab_tests: List[Any]
) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Creates a Laboratory Order from lab tests requested during a consultation.
    """
    try:
        db = get_db()
        clean_tests = []
        for t in lab_tests:
            cleaned = clean_lab_test_item(t)
            if cleaned:
                clean_tests.append(cleaned)

        if not clean_tests:
            return None, None

        consultation_id = consultation_doc.get("consultation_id")
        queue_id = consultation_doc.get("queue_id")
        booking_id = consultation_doc.get("booking_id")
        patient_id = consultation_doc.get("patient_id")
        patient_name = consultation_doc.get("patient_name") or "Patient"
        doctor_id = consultation_doc.get("doctor_id")
        doctor_name = consultation_doc.get("doctor_name") or "Medical Officer"
        department = consultation_doc.get("department") or "General Medicine"

        now_iso = _get_utc_now_iso()

        # Check if lab order already exists for this consultation
        existing = db.lab_orders.find_one({"consultation_id": consultation_id}) if consultation_id else None
        if existing:
            order_id = existing.get("order_id")
            update_data = {
                "tests": clean_tests,
                "patient_name": patient_name,
                "doctor_name": doctor_name,
                "department": department,
                "updated_at": now_iso
            }
            db.lab_orders.update_one({"order_id": order_id}, {"$set": update_data})
            updated = db.lab_orders.find_one({"order_id": order_id})
            return serialize_doc(updated), None

        unique_suffix = consultation_id.replace("CON_", "") if consultation_id else uuid.uuid4().hex[:8].upper()
        order_id = f"LAB_{unique_suffix}"

        order_doc = {
            "order_id": order_id,
            "order_type": "laboratory",
            "consultation_id": consultation_id,
            "queue_id": queue_id,
            "appointment_id": booking_id,
            "booking_id": booking_id,
            "patient_id": patient_id,
            "patient_name": patient_name,
            "doctor_id": doctor_id,
            "doctor_name": doctor_name,
            "department": department,
            "tests": clean_tests,
            "status": "waiting",  # waiting -> sample_collected -> processing -> report_ready
            "status_history": [
                {
                    "status": "waiting",
                    "timestamp": now_iso,
                    "updated_by": "doctor",
                    "notes": "Lab investigation requisition created during clinical consultation"
                }
            ],
            "clinical_indication": consultation_doc.get("doctor_assessment", {}).get("diagnosis") or "",
            "notes": consultation_doc.get("doctor_assessment", {}).get("notes") or "",
            "created_at": now_iso,
            "updated_at": now_iso,
            "sample_collected_at": None,
            "processing_at": None,
            "report_ready_at": None,
            "report_data": None
        }

        db.lab_orders.insert_one(order_doc)
        logger.info(f"[Lab] Created lab order {order_id} for patient {patient_id}")
        return serialize_doc(order_doc), None
    except Exception as e:
        logger.error(f"[Lab] Error creating lab order from consultation: {e}", exc_info=True)
        return None, str(e)


def create_lab_order(data: Dict) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Creates a new Lab Order via direct API.
    Required: patient_id (or consultation_id) and non-empty tests.
    """
    try:
        db = get_db()
        consultation_id = data.get("consultation_id")
        patient_id = data.get("patient_id")
        appointment_id = data.get("appointment_id") or data.get("booking_id")
        queue_id = data.get("queue_id")
        doctor_id = data.get("doctor_id")
        doctor_name = data.get("doctor_name")
        patient_name = data.get("patient_name")
        department = data.get("department")

        if consultation_id:
            cons = db.consultations.find_one({"consultation_id": consultation_id})
            if cons:
                patient_id = patient_id or cons.get("patient_id")
                patient_name = patient_name or cons.get("patient_name")
                appointment_id = appointment_id or cons.get("booking_id")
                queue_id = queue_id or cons.get("queue_id")
                doctor_id = doctor_id or cons.get("doctor_id")
                doctor_name = doctor_name or cons.get("doctor_name")
                department = department or cons.get("department")

        if not patient_id:
            return None, "patient_id is required to create a lab order"

        raw_tests = data.get("tests") or []
        clean_tests = []
        for t in raw_tests:
            cleaned = clean_lab_test_item(t)
            if cleaned:
                clean_tests.append(cleaned)

        if not clean_tests:
            return None, "At least one valid laboratory test is required to create a lab order"

        now_iso = _get_utc_now_iso()
        order_id = f"LAB_{uuid.uuid4().hex[:8].upper()}"

        order_doc = {
            "order_id": order_id,
            "order_type": "laboratory",
            "consultation_id": consultation_id,
            "queue_id": queue_id,
            "appointment_id": appointment_id,
            "booking_id": appointment_id,
            "patient_id": patient_id,
            "patient_name": patient_name or "Patient",
            "doctor_id": doctor_id or "D001",
            "doctor_name": doctor_name or "Attending Physician",
            "department": department or "General Medicine",
            "tests": clean_tests,
            "status": "waiting",
            "status_history": [
                {
                    "status": "waiting",
                    "timestamp": now_iso,
                    "updated_by": data.get("created_by") or "doctor",
                    "notes": data.get("notes") or "Lab order requisition requested"
                }
            ],
            "clinical_indication": data.get("clinical_indication") or "",
            "notes": data.get("notes") or "",
            "created_at": now_iso,
            "updated_at": now_iso,
            "sample_collected_at": None,
            "processing_at": None,
            "report_ready_at": None,
            "report_data": None
        }

        db.lab_orders.insert_one(order_doc)
        logger.info(f"[Lab] Created manual order {order_id} for patient {patient_id}")
        return serialize_doc(order_doc), None
    except Exception as e:
        logger.error(f"[Lab] Error creating manual lab order: {e}", exc_info=True)
        return None, str(e)


def get_lab_order(order_id: str) -> Optional[Dict]:
    """Retrieve a single lab order by order_id or consultation_id."""
    try:
        db = get_db()
        doc = db.lab_orders.find_one({"$or": [{"order_id": order_id}, {"consultation_id": order_id}]})
        return serialize_doc(doc)
    except Exception as e:
        logger.error(f"[Lab] Error fetching lab order {order_id}: {e}", exc_info=True)
        return None


def list_lab_orders(filters: Optional[Dict] = None) -> List[Dict]:
    """List lab orders with optional filters."""
    try:
        db = get_db()
        clauses: List[Dict[str, Any]] = []
        if filters:
            if filters.get("status"):
                clauses.append({"status": str(filters["status"]).strip().lower()})
            if filters.get("patient_id"):
                pids = resolve_patient_order_ids(filters["patient_id"])
                clauses.append({"$or": [{"patient_id": {"$in": pids}}, {"user_id": {"$in": pids}}]})
            if filters.get("doctor_id"):
                clauses.append({"doctor_id": str(filters["doctor_id"]).strip()})
            if filters.get("consultation_id"):
                clauses.append({"consultation_id": str(filters["consultation_id"]).strip()})
            if filters.get("appointment_id") or filters.get("booking_id"):
                b_id = str(filters.get("appointment_id") or filters.get("booking_id")).strip()
                clauses.append({"$or": [{"appointment_id": b_id}, {"booking_id": b_id}]})

        query = {"$and": clauses} if clauses else {}
        docs = list(db.lab_orders.find(query).sort("created_at", -1))
        return serialize_docs(docs)
    except Exception as e:
        logger.error(f"[Lab] Error listing lab orders: {e}", exc_info=True)
        return []


def update_lab_order_status(
    order_id: str,
    new_status: str,
    notes: Optional[str] = None,
    report_data: Optional[Dict] = None,
    updated_by: Optional[str] = None
) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Updates a laboratory order's status along the allowed lifecycle:
    waiting -> sample_collected -> processing -> report_ready
    """
    try:
        db = get_db()
        target_status = str(new_status).strip().lower()
        if target_status not in LAB_STATUS_FLOW:
            return None, f"Invalid lab status '{target_status}'. Allowed: {', '.join(LAB_STATUS_FLOW)}"

        doc = db.lab_orders.find_one({"order_id": order_id})
        if not doc:
            return None, f"Lab order '{order_id}' not found"

        current_status = doc.get("status", "waiting")
        if current_status == target_status:
            return serialize_doc(doc), None

        allowed_next = VALID_LAB_TRANSITIONS.get(current_status, [])
        if target_status not in allowed_next:
            return None, (
                f"Cannot transition lab order from '{current_status}' to '{target_status}'. "
                f"Valid next status is: {', '.join(allowed_next) if allowed_next else 'None (terminal)'}"
            )

        now_iso = _get_utc_now_iso()
        update_set: Dict[str, Any] = {
            "status": target_status,
            "updated_at": now_iso
        }

        if target_status == "sample_collected":
            update_set["sample_collected_at"] = now_iso
        elif target_status == "processing":
            update_set["processing_at"] = now_iso
        elif target_status == "report_ready":
            update_set["report_ready_at"] = now_iso
            if report_data is not None:
                update_set["report_data"] = report_data
            # Dispatch in-app notification to patient
            patient_id = doc.get("patient_id")
            if patient_id:
                try:
                    from services.notification_service import create_notification
                    doc_name = doc.get("doctor_name") or "Attending Physician"
                    create_notification(
                        patient_id=patient_id,
                        notification_type="LAB_REPORT_READY",
                        title="Lab Report Ready",
                        message=f"Your diagnostic laboratory investigations ordered by {doc_name} have been processed and your report is ready.",
                        booking_id=doc.get("booking_id") or doc.get("consultation_id"),
                        suppress_sms=True,
                        extra_fields={
                            "order_id": order_id,
                            "order_type": "laboratory",
                            "status": "report_ready"
                        }
                    )
                except Exception as notif_err:
                    logger.warning(f"[Lab] In-app notification error: {notif_err}")

        history_entry = {
            "status": target_status,
            "timestamp": now_iso,
            "updated_by": updated_by or "lab_technician",
            "notes": notes or f"Status changed from {current_status} to {target_status}"
        }

        db.lab_orders.update_one(
            {"order_id": order_id},
            {
                "$set": update_set,
                "$push": {"status_history": history_entry}
            }
        )

        updated = db.lab_orders.find_one({"order_id": order_id})
        logger.info(f"[Lab] Order {order_id} transitioned: {current_status} -> {target_status}")
        return serialize_doc(updated), None
    except Exception as e:
        logger.error(f"[Lab] Error updating lab order {order_id} status: {e}", exc_info=True)
        return None, str(e)
