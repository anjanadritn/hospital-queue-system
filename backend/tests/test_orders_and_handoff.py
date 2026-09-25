import pytest
from app import create_app
from database.mongodb import get_db
from services.consultation_service import archive_consultation, get_consultation_by_id
from services.order_service import (
    create_pharmacy_order,
    get_pharmacy_order,
    list_pharmacy_orders,
    update_pharmacy_order_status,
    create_lab_order,
    get_lab_order,
    list_lab_orders,
    update_lab_order_status
)
from services.auth_service import generate_jwt_token


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def clean_db():
    db = get_db()
    db.consultations.delete_many({"patient_id": {"$regex": "^TEST_"}})
    db.pharmacy_orders.delete_many({"patient_id": {"$regex": "^TEST_"}})
    db.lab_orders.delete_many({"patient_id": {"$regex": "^TEST_"}})
    db.notifications.delete_many({"patient_id": {"$regex": "^TEST_"}})
    yield db
    db.consultations.delete_many({"patient_id": {"$regex": "^TEST_"}})
    db.pharmacy_orders.delete_many({"patient_id": {"$regex": "^TEST_"}})
    db.lab_orders.delete_many({"patient_id": {"$regex": "^TEST_"}})
    db.notifications.delete_many({"patient_id": {"$regex": "^TEST_"}})


# ============================================================
# 1. CONSULTATION COMPLETION HAND-OFF TESTS
# ============================================================

def test_pharmacy_order_created_on_consultation_completion(clean_db):
    """When a doctor completes a consultation with prescriptions, a Pharmacy Order is created."""
    db = clean_db
    queue_id = "TEST_Q_PHARM_01"
    patient_id = "TEST_PAT_01"
    booking_id = "TEST_BOOK_01"

    # Seed mock active queue item
    db.queue.insert_one({
        "queue_id": queue_id,
        "booking_id": booking_id,
        "patient_id": patient_id,
        "patient_name": "Test Patient",
        "doctor_id": "D001",
        "department": "General Medicine",
        "status": "in_consultation"
    })

    prescriptions = [
        {
            "medicine": "Amoxicillin 500 MG Oral Capsule",
            "dosage": "500mg",
            "frequency": "1-0-1",
            "duration": "5 days",
            "instructions": "After food",
            "rxcui": "213169"
        }
    ]

    cons_doc, err = archive_consultation(
        queue_or_booking_id=queue_id,
        doctor_notes="Bacterial infection suspected",
        diagnosis="Acute Bronchitis",
        advice="Plenty of fluids",
        prescriptions=prescriptions
    )

    assert err is None
    assert cons_doc is not None
    assert cons_doc.get("pharmacy_order_id") is not None

    # Verify Pharmacy Order in db.pharmacy_orders
    pharm_order = db.pharmacy_orders.find_one({"consultation_id": cons_doc["consultation_id"]})
    assert pharm_order is not None
    assert pharm_order["status"] == "waiting"
    assert pharm_order["patient_id"] == patient_id
    assert pharm_order["booking_id"] == booking_id
    assert pharm_order["doctor_id"] == "D001"
    assert len(pharm_order["prescriptions"]) == 1
    assert pharm_order["prescriptions"][0]["medicine"] == "Amoxicillin 500 MG Oral Capsule"
    assert pharm_order["prescriptions"][0]["rxcui"] == "213169"


def test_backward_compatibility_consultation_without_prescriptions(clean_db):
    """Preserve backward compatibility when consultation has no prescriptions or lab orders."""
    db = clean_db
    queue_id = "TEST_Q_NO_PRESCRIPTIONS"
    patient_id = "TEST_PAT_02"

    db.queue.insert_one({
        "queue_id": queue_id,
        "booking_id": queue_id,
        "patient_id": patient_id,
        "patient_name": "Checkup Patient",
        "doctor_id": "D002",
        "department": "General Medicine",
        "status": "in_consultation"
    })

    cons_doc, err = archive_consultation(
        queue_or_booking_id=queue_id,
        doctor_notes="Routine health checkup normal",
        diagnosis="Normal Vitality",
        advice="Healthy diet",
        prescriptions=[],
        lab_tests=None
    )

    assert err is None
    assert cons_doc is not None
    assert cons_doc.get("pharmacy_order_id") is None
    assert cons_doc.get("lab_order_id") is None

    # Ensure no pharmacy orders or lab orders created
    pharm_count = db.pharmacy_orders.count_documents({"patient_id": patient_id})
    lab_count = db.lab_orders.count_documents({"patient_id": patient_id})
    assert pharm_count == 0
    assert lab_count == 0


def test_lab_order_created_on_consultation_completion(clean_db):
    """When a doctor completes a consultation with lab tests, a Lab Order is created."""
    db = clean_db
    queue_id = "TEST_Q_LAB_01"
    patient_id = "TEST_PAT_03"
    booking_id = "TEST_BOOK_LAB_01"

    db.queue.insert_one({
        "queue_id": queue_id,
        "booking_id": booking_id,
        "patient_id": patient_id,
        "patient_name": "Lab Test Patient",
        "doctor_id": "D003",
        "department": "Cardiology",
        "status": "in_consultation"
    })

    lab_tests = [
        {"test_name": "Lipid Profile", "category": "Biochemistry", "test_code": "LIPID_01"},
        {"test_name": "Electrocardiogram (ECG)", "category": "Cardiology"}
    ]

    cons_doc, err = archive_consultation(
        queue_or_booking_id=queue_id,
        doctor_notes="Chest tightness on exertion",
        diagnosis="Evaluate Angina",
        prescriptions=[],
        lab_tests=lab_tests
    )

    assert err is None
    assert cons_doc.get("lab_order_id") is not None

    lab_order = db.lab_orders.find_one({"consultation_id": cons_doc["consultation_id"]})
    assert lab_order is not None
    assert lab_order["status"] == "waiting"
    assert lab_order["patient_id"] == patient_id
    assert lab_order["booking_id"] == booking_id
    assert lab_order["doctor_id"] == "D003"
    assert len(lab_order["tests"]) == 2
    assert lab_order["tests"][0]["test_name"] == "Lipid Profile"


def test_get_consultation_by_id_enrichment(clean_db):
    """get_consultation_by_id enriches the record with linked pharmacy and lab orders."""
    db = clean_db
    queue_id = "TEST_Q_ENRICH_01"
    patient_id = "TEST_PAT_04"

    db.queue.insert_one({
        "queue_id": queue_id,
        "booking_id": queue_id,
        "patient_id": patient_id,
        "patient_name": "Full Hand-off Patient",
        "doctor_id": "D001",
        "department": "General Medicine",
        "status": "in_consultation"
    })

    prescriptions = [{"medicine": "Paracetamol 650mg", "dosage": "650mg", "frequency": "1-0-1"}]
    lab_tests = [{"test_name": "Complete Blood Count", "test_code": "CBC"}]

    cons_doc, _ = archive_consultation(
        queue_or_booking_id=queue_id,
        doctor_notes="Viral pyrexia",
        diagnosis="Viral Fever",
        prescriptions=prescriptions,
        lab_tests=lab_tests
    )

    enriched = get_consultation_by_id(cons_doc["consultation_id"])
    assert enriched is not None
    assert "pharmacy_order" in enriched
    assert enriched["pharmacy_order"]["status"] == "waiting"
    assert "lab_order" in enriched
    assert enriched["lab_order"]["status"] == "waiting"


# ============================================================
# 2. PHARMACY ORDER API & TRANSITION TESTS
# ============================================================

def test_pharmacy_orders_api_lifecycle(client, clean_db):
    """Test full pharmacy order API lifecycle: create -> read -> preparing -> dispensed."""
    # 1. Create pharmacy order via POST /pharmacy/orders
    create_payload = {
        "patient_id": "TEST_PAT_API_01",
        "patient_name": "Pharmacy API Patient",
        "doctor_id": "D001",
        "doctor_name": "Dr. Ananya Sharma",
        "department": "General Medicine",
        "prescriptions": [
            {
                "medicine": "Azithromycin 500mg",
                "dosage": "500mg",
                "frequency": "OD",
                "duration": "3 days"
            }
        ],
        "notes": "Dispense full course"
    }

    res_create = client.post("/pharmacy/orders", json=create_payload)
    assert res_create.status_code == 201
    create_data = res_create.get_json()
    assert create_data["success"] is True
    order = create_data["order"]
    order_id = order["order_id"]
    assert order["status"] == "waiting"
    assert order["patient_id"] == "TEST_PAT_API_01"

    # 2. Read single pharmacy order via GET /pharmacy/orders/<order_id>
    res_get = client.get(f"/pharmacy/orders/{order_id}")
    assert res_get.status_code == 200
    assert res_get.get_json()["order"]["order_id"] == order_id

    # 3. Read pharmacy orders list via GET /pharmacy/orders?patient_id=TEST_PAT_API_01
    res_list = client.get(f"/pharmacy/orders?patient_id=TEST_PAT_API_01")
    assert res_list.status_code == 200
    list_data = res_list.get_json()
    assert list_data["count"] >= 1
    assert any(o["order_id"] == order_id for o in list_data["orders"])

    # 4. Transition: waiting -> preparing
    res_prep = client.patch(f"/pharmacy/orders/{order_id}/status", json={
        "status": "preparing",
        "notes": "Pharmacist assembling medicines",
        "updated_by": "Pharmacist Ravi"
    })
    assert res_prep.status_code == 200
    prep_order = res_prep.get_json()["order"]
    assert prep_order["status"] == "preparing"
    assert prep_order["preparing_at"] is not None

    # 5. Transition: preparing -> dispensed
    res_disp = client.patch(f"/pharmacy/orders/{order_id}/status", json={
        "status": "dispensed",
        "notes": "Handed over to patient",
        "updated_by": "Pharmacist Ravi"
    })
    assert res_disp.status_code == 200
    disp_order = res_disp.get_json()["order"]
    assert disp_order["status"] == "dispensed"
    assert disp_order["dispensed_at"] is not None


def test_pharmacy_orders_invalid_transitions(client, clean_db):
    """Test that invalid pharmacy status transitions are rejected with HTTP 400."""
    # Create order in 'waiting' status
    order_doc, _ = create_pharmacy_order({
        "patient_id": "TEST_PAT_INV_01",
        "prescriptions": [{"medicine": "Metformin 500mg"}]
    })
    order_id = order_doc["order_id"]

    # 1. Invalid status value
    res_bad_val = client.patch(f"/pharmacy/orders/{order_id}/status", json={"status": "invalid_status"})
    assert res_bad_val.status_code == 400
    assert "Invalid pharmacy status" in res_bad_val.get_json()["error"]

    # 2. Cannot jump waiting -> dispensed directly
    res_jump = client.patch(f"/pharmacy/orders/{order_id}/status", json={"status": "dispensed"})
    assert res_jump.status_code == 400
    assert "Cannot transition" in res_jump.get_json()["error"]

    # Valid: waiting -> preparing
    update_pharmacy_order_status(order_id, "preparing")

    # Valid: preparing -> dispensed
    update_pharmacy_order_status(order_id, "dispensed")

    # 3. Cannot transition backwards once dispensed
    res_back = client.patch(f"/pharmacy/orders/{order_id}/status", json={"status": "preparing"})
    assert res_back.status_code == 400
    assert "Cannot transition" in res_back.get_json()["error"]


# ============================================================
# 3. LABORATORY ORDER API & TRANSITION TESTS
# ============================================================

def test_lab_orders_api_lifecycle(client, clean_db):
    """Test full lab order API lifecycle: create -> read -> sample_collected -> processing -> report_ready."""
    # 1. Create lab order via POST /lab/orders
    create_payload = {
        "patient_id": "TEST_PAT_LAB_API_01",
        "patient_name": "Lab Test Patient",
        "doctor_id": "D002",
        "tests": [
            {"test_name": "Thyroid Stimulating Hormone (TSH)", "test_code": "TSH", "category": "Endocrinology"},
            "Blood Glucose Fasting"
        ],
        "clinical_indication": "Thyroid screening"
    }

    res_create = client.post("/lab/orders", json=create_payload)
    assert res_create.status_code == 201
    create_data = res_create.get_json()
    assert create_data["success"] is True
    order = create_data["order"]
    order_id = order["order_id"]
    assert order["status"] == "waiting"
    assert len(order["tests"]) == 2

    # 2. Read single lab order via GET /lab/orders/<order_id>
    res_get = client.get(f"/lab/orders/{order_id}")
    assert res_get.status_code == 200
    assert res_get.get_json()["order"]["order_id"] == order_id

    # 3. Read list via GET /lab/orders?patient_id=TEST_PAT_LAB_API_01
    res_list = client.get(f"/lab/orders?patient_id=TEST_PAT_LAB_API_01")
    assert res_list.status_code == 200
    list_data = res_list.get_json()
    assert list_data["count"] >= 1

    # 4. Transition 1: waiting -> sample_collected
    res_sample = client.patch(f"/lab/orders/{order_id}/status", json={
        "status": "sample_collected",
        "notes": "Venipuncture blood sample collected",
        "updated_by": "Phlebotomist Sunil"
    })
    assert res_sample.status_code == 200
    order_sample = res_sample.get_json()["order"]
    assert order_sample["status"] == "sample_collected"
    assert order_sample["sample_collected_at"] is not None

    # 5. Transition 2: sample_collected -> processing
    res_proc = client.patch(f"/lab/orders/{order_id}/status", json={
        "status": "processing",
        "notes": "Analyzing on Cobas analyzer",
        "updated_by": "Tech Deepa"
    })
    assert res_proc.status_code == 200
    order_proc = res_proc.get_json()["order"]
    assert order_proc["status"] == "processing"
    assert order_proc["processing_at"] is not None

    # 6. Transition 3: processing -> report_ready
    res_report = client.patch(f"/lab/orders/{order_id}/status", json={
        "status": "report_ready",
        "notes": "Verified by pathologist",
        "report_data": {
            "TSH": "2.4 uIU/mL (Normal)",
            "Fasting_Glucose": "95 mg/dL (Normal)"
        },
        "updated_by": "Dr. Pathologist"
    })
    assert res_report.status_code == 200
    order_report = res_report.get_json()["order"]
    assert order_report["status"] == "report_ready"
    assert order_report["report_ready_at"] is not None
    assert order_report["report_data"]["TSH"] == "2.4 uIU/mL (Normal)"


def test_lab_orders_invalid_transitions(client, clean_db):
    """Test that invalid lab order status transitions are rejected with HTTP 400."""
    order_doc, _ = create_lab_order({
        "patient_id": "TEST_PAT_LAB_INV",
        "tests": ["Urine Routine"]
    })
    order_id = order_doc["order_id"]

    # 1. Invalid status
    res_invalid = client.patch(f"/lab/orders/{order_id}/status", json={"status": "invalid_lab_status"})
    assert res_invalid.status_code == 400

    # 2. Invalid jump: waiting -> processing (must collect sample first)
    res_jump = client.patch(f"/lab/orders/{order_id}/status", json={"status": "processing"})
    assert res_jump.status_code == 400
    assert "Cannot transition" in res_jump.get_json()["error"]

    # Step through correctly
    update_lab_order_status(order_id, "sample_collected")
    update_lab_order_status(order_id, "processing")
    update_lab_order_status(order_id, "report_ready")

    # 3. Cannot transition backwards once report is ready
    res_back = client.patch(f"/lab/orders/{order_id}/status", json={"status": "sample_collected"})
    assert res_back.status_code == 400
    assert "Cannot transition" in res_back.get_json()["error"]


def test_patient_pharmacy_and_lab_order_tracking_and_notifications(client, clean_db):
    """
    Test patient-side order tracking:
    - Filtering pharmacy and lab orders strictly by patient_id
    - Automatic in-app notification dispatched when pharmacy reaches 'dispensed'
    - Automatic in-app notification dispatched when lab reaches 'report_ready'
    """
    patient_a = "PATIENT_ALICE"
    patient_b = "PATIENT_BOB"

    # 1. Create pharmacy order for Alice and Bob
    pharm_a, _ = create_pharmacy_order({
        "patient_id": patient_a,
        "doctor_name": "Dr. Ananya Sharma",
        "prescriptions": [{"medicine": "Amoxicillin 500mg", "dosage": "1 cap", "frequency": "TDS", "duration": "5 days"}]
    })
    pharm_b, _ = create_pharmacy_order({
        "patient_id": patient_b,
        "doctor_name": "Dr. Rajesh Kumar",
        "prescriptions": [{"medicine": "Paracetamol 650mg", "dosage": "1 tab", "frequency": "SOS", "duration": "3 days"}]
    })

    # 2. Verify Alice only sees her own pharmacy order
    res_pharm_list = client.get(f"/pharmacy/orders?patient_id={patient_a}")
    assert res_pharm_list.status_code == 200
    alice_pharm_orders = res_pharm_list.get_json()["orders"]
    assert len(alice_pharm_orders) == 1
    assert alice_pharm_orders[0]["order_id"] == pharm_a["order_id"]
    assert alice_pharm_orders[0]["patient_id"] == patient_a

    # 3. Create lab order for Alice and Bob
    lab_a, _ = create_lab_order({
        "patient_id": patient_a,
        "doctor_name": "Dr. Ananya Sharma",
        "tests": [{"test_name": "Complete Blood Count", "test_code": "CBC", "category": "Hematology"}]
    })
    lab_b, _ = create_lab_order({
        "patient_id": patient_b,
        "doctor_name": "Dr. Rajesh Kumar",
        "tests": [{"test_name": "Lipid Profile", "test_code": "LIPID", "category": "Biochemistry"}]
    })

    # 4. Verify Alice only sees her own lab order
    res_lab_list = client.get(f"/lab/orders?patient_id={patient_a}")
    assert res_lab_list.status_code == 200
    alice_lab_orders = res_lab_list.get_json()["orders"]
    assert len(alice_lab_orders) == 1
    assert alice_lab_orders[0]["order_id"] == lab_a["order_id"]
    assert alice_lab_orders[0]["patient_id"] == patient_a

    # 5. Advance Alice's pharmacy order to dispensed: waiting -> preparing -> dispensed
    client.patch(f"/pharmacy/orders/{pharm_a['order_id']}/status", json={"status": "preparing"})
    res_dispensed = client.patch(f"/pharmacy/orders/{pharm_a['order_id']}/status", json={"status": "dispensed"})
    assert res_dispensed.status_code == 200

    # 6. Advance Alice's lab order to report_ready: waiting -> sample_collected -> processing -> report_ready
    client.patch(f"/lab/orders/{lab_a['order_id']}/status", json={"status": "sample_collected"})
    client.patch(f"/lab/orders/{lab_a['order_id']}/status", json={"status": "processing"})
    res_ready = client.patch(f"/lab/orders/{lab_a['order_id']}/status", json={
        "status": "report_ready",
        "report_data": {"summary": "Hemoglobin normal at 14.2 g/dL"}
    })
    assert res_ready.status_code == 200

    # 7. Check Alice's in-app notifications with auth header
    alice_token = generate_jwt_token({"user_id": patient_a, "patient_id": patient_a, "role": "patient"})
    res_notifs = client.get(f"/notifications/{patient_a}", headers={"Authorization": f"Bearer {alice_token}"})
    assert res_notifs.status_code == 200
    notifs = res_notifs.get_json()
    if isinstance(notifs, dict) and "notifications" in notifs:
        notif_items = notifs["notifications"]
    else:
        notif_items = notifs

    pharm_notif = next((n for n in notif_items if n.get("type") == "PHARMACY_DISPENSED"), None)
    assert pharm_notif is not None
    assert "dispensed" in pharm_notif["message"].lower() or "ready" in pharm_notif["message"].lower()

    lab_notif = next((n for n in notif_items if n.get("type") == "LAB_REPORT_READY"), None)
    assert lab_notif is not None
    assert "report is ready" in lab_notif["message"].lower()

