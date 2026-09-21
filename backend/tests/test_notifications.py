import re
import pytest
from unittest.mock import patch, MagicMock
from services.notification_service import (
    create_notification,
    get_patient_notifications,
    mark_notification_read,
    mark_all_notifications_read,
    resolve_patient_phone,
    is_duplicate_sms,
    SENT_SMS_EVENTS,
    IN_MEMORY_NOTIFS
)
from database.mongodb import get_db

@pytest.fixture(autouse=True)
def clean_notifications():
    SENT_SMS_EVENTS.clear()
    IN_MEMORY_NOTIFS.clear()
    try:
        db = get_db()
        db.notifications.delete_many({"patient_id": {"$regex": "^TEST_"}})
        db.users.delete_many({"patient_id": {"$regex": "^TEST_"}})
        db.patients.delete_many({"patient_id": {"$regex": "^TEST_"}})
    except Exception:
        pass
    yield
    SENT_SMS_EVENTS.clear()
    IN_MEMORY_NOTIFS.clear()
    try:
        db = get_db()
        db.notifications.delete_many({"patient_id": {"$regex": "^TEST_"}})
        db.users.delete_many({"patient_id": {"$regex": "^TEST_"}})
        db.patients.delete_many({"patient_id": {"$regex": "^TEST_"}})
    except Exception:
        pass

def test_notification_sms_sent_successfully():
    """Verify eligible patient notification sends SMS when MSG91_SMS_ENABLED=True"""
    patient_id = "TEST_PAT_001"
    phone = "9876543211"

    # Setup patient in MongoDB
    try:
        db = get_db()
        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Test Patient"})
    except Exception:
        pass

    mock_sms_res = (True, {"type": "success", "message": "SMS sent"}, None)

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms", return_value=mock_sms_res) as mock_send_sms:

        notif, err = create_notification(
            patient_id=patient_id,
            notification_type="TURN_APPROACHING",
            title="Your Turn is Approaching!",
            message="Your token Q001 is now #2 in line.",
            booking_id="Q001"
        )

        assert err is None
        assert notif is not None
        assert notif["sms_sent"] is True
        assert notif["type"] == "TURN_APPROACHING"

        # Verify SMS call parameters
        mock_send_sms.assert_called_once()
        call_phone, call_msg = mock_send_sms.call_args[0]
        assert call_phone == phone
        assert "[SIMSRH Hospital] 🏥" in call_msg
        assert "Your turn is approaching" in call_msg
        assert "Token Q001" in call_msg
        assert "Queue position 2" in call_msg
        assert re.search(r"Estimated wait \d+ min", call_msg)
        assert re.search(r"Expected consultation .+", call_msg)
        assert re.search(r"Recommended departure .+", call_msg)
        assert "Please be near Room" in call_msg
        assert re.search(r"Hospital Arrival Code \d+", call_msg)
        assert "Show this code at the reception desk on arrival" in call_msg
        # Strict validation: No '#' symbols anywhere in SMS
        assert "#" not in call_msg
        # No ':' punctuation on label lines
        for line in call_msg.splitlines():
            if line.startswith("Token") or line.startswith("Queue position") or line.startswith("Estimated wait") or line.startswith("Please be near") or line.startswith("Hospital Arrival Code"):
                assert ":" not in line

def test_turn_approaching_sms_exact_style_formatting():
    """Verify format_turn_approaching_sms produces the exact requested hospital style without '#' and label ':'"""
    from services.notification_service import format_turn_approaching_sms

    expected_output = (
        "[SIMSRH Hospital] 🏥\n"
        "Your turn is approaching\n"
        "Token D001-Q020\n"
        "Queue position 2\n"
        "Estimated wait 14 min\n"
        "Expected consultation 9:09 PM\n"
        "Recommended departure 8:58 PM\n"
        "Please be near Room 204\n"
        "Hospital Arrival Code 800066\n"
        "Show this code at the reception desk on arrival"
    )

    formatted = format_turn_approaching_sms(
        token="D001-Q020",
        queue_position=2,
        estimated_wait=14,
        expected_consultation="9:09 PM",
        recommended_departure="8:58 PM",
        room="204",
        arrival_code="800066"
    )

    assert formatted == expected_output
    assert "#" not in formatted

    # Test dynamic cleanup when inputs contain dirty symbols ('#', ':', '~', 'Room Room')
    dirty_formatted = format_turn_approaching_sms(
        token="#D001-Q020:",
        queue_position="#2",
        estimated_wait="~14 mins",
        expected_consultation="Expected: 9:09 PM",
        recommended_departure="Recommended departure: 8:58 PM",
        room="Room 204",
        arrival_code="#800066:"
    )
    assert dirty_formatted == expected_output
    assert "#" not in dirty_formatted

def test_notification_sms_disabled():
    """When MSG91_SMS_ENABLED=False, in-app notification is created without sending SMS"""
    patient_id = "TEST_PAT_002"
    phone = "9876543212"

    try:
        db = get_db()
        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Test Patient 2"})
    except Exception:
        pass

    with patch("config.config.FAST2SMS_SMS_ENABLED", False), \
         patch("config.config.MSG91_SMS_ENABLED", False), \
         patch("services.sms_service.sms_service.send_sms") as mock_send_sms:

        notif, err = create_notification(
            patient_id=patient_id,
            notification_type="BOOKING_CONFIRMED",
            title="Booking Confirmed",
            message="Your consultation is scheduled.",
            booking_id="B002"
        )

        assert err is None
        assert notif["sms_sent"] is False
        mock_send_sms.assert_not_called()

def test_notification_sms_gateway_failure():
    """When SMS gateway returns error/times out, notification creation still succeeds with sms_sent=False"""
    patient_id = "TEST_PAT_003"
    phone = "9876543213"

    try:
        db = get_db()
        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Test Patient 3"})
    except Exception:
        pass

    mock_failure = (False, {"status": "timeout"}, "Gateway request timed out")

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms", return_value=mock_failure) as mock_send_sms:

        notif, err = create_notification(
            patient_id=patient_id,
            notification_type="DEPARTURE_REMINDER",
            title="Recommended Departure Time",
            message="Start from Tumkur City around 10:45 AM.",
            booking_id="Q003"
        )

        assert err is None
        assert notif is not None
        assert notif["sms_sent"] is False
        mock_send_sms.assert_called_once()

def test_notification_missing_patient_phone():
    """When patient has no phone record, notification creation succeeds and SMS is skipped"""
    patient_id = "TEST_PAT_NO_PHONE"

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms") as mock_send_sms:

        notif, err = create_notification(
            patient_id=patient_id,
            notification_type="ARRIVAL_OTP_ISSUED",
            title="Hospital Arrival Code",
            message="Your arrival OTP is 123456.",
            booking_id="TEST_BK_NO_PHONE"
        )

        assert err is None
        assert notif["sms_sent"] is False
        mock_send_sms.assert_not_called()

def test_duplicate_notification_does_not_send_duplicate_sms():
    """Duplicate notification events for the same token do not dispatch duplicate SMS"""
    patient_id = "TEST_PAT_DUP"
    phone = "9876543215"
    booking_id = "Q005"

    try:
        db = get_db()
        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Duplicate Test Patient"})
    except Exception:
        pass

    mock_sms_res = (True, {"type": "success", "message": "SMS sent"}, None)

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms", return_value=mock_sms_res) as mock_send_sms:

        # 1st call: SMS sent
        notif1, err1 = create_notification(
            patient_id=patient_id,
            notification_type="MISSED_CONSULTATION",
            title="Consultation Call Missed",
            message="Your token Q005 has been moved to the end of the line.",
            booking_id=booking_id
        )
        assert err1 is None
        assert notif1["sms_sent"] is True
        assert mock_send_sms.call_count == 1

        # 2nd call (duplicate event): In-app notification saved, but SMS is NOT sent again
        notif2, err2 = create_notification(
            patient_id=patient_id,
            notification_type="MISSED_CONSULTATION",
            title="Consultation Call Missed",
            message="Your token Q005 has been moved to the end of the line.",
            booking_id=booking_id
        )
        assert err2 is None
        assert notif2["sms_sent"] is False
        # Call count must remain 1!
        assert mock_send_sms.call_count == 1

def test_no_sms_sent_to_doctors_or_admins():
    """Doctor and admin notification alerts must NEVER trigger patient SMS even for eligible types"""
    doctor_id = "D001"
    admin_id = "U_ADMIN"

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms") as mock_send_sms:

        # Doctor alert with eligible type
        notif_doc, err1 = create_notification(
            patient_id=doctor_id,
            notification_type="BOOKING_CONFIRMED",
            title="New Patient Booking",
            message="A patient booked with you."
        )
        assert err1 is None
        assert notif_doc["sms_sent"] is False

        # Admin alert with eligible type
        notif_admin, err2 = create_notification(
            patient_id=admin_id,
            notification_type="BOOKING_CONFIRMED",
            title="System Alert",
            message="New appointment."
        )
        assert err2 is None
        assert notif_admin["sms_sent"] is False

        mock_send_sms.assert_not_called()

def test_booking_confirmed_fast2sms_flow():
    """Verify BOOKING_CONFIRMED event resolves registered phone, dispatches via Fast2SMS, and avoids duplicates"""
    patient_id = "TEST_PAT_BK_01"
    phone = "9876543219"
    booking_id = "B_FAST2SMS_001"

    try:
        db = get_db()
        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Fast2SMS Booking Patient"})
    except Exception:
        pass

    mock_fast2sms_res = (True, {"return": True, "request_id": "REQ_BK_99", "message": ["SMS sent successfully."]}, None)

    # 1. Enabled: Successfully dispatches to registered phone
    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms", return_value=mock_fast2sms_res) as mock_send_sms:

        notif1, err1 = create_notification(
            patient_id=patient_id,
            notification_type="BOOKING_CONFIRMED",
            title="Consultation Booked Successfully",
            message="Confirmed for 2026-09-21 with Dr. Rao. Queue Token: D001-Q001.",
            booking_id=booking_id
        )

        assert err1 is None
        assert notif1 is not None
        assert notif1["sms_sent"] is True
        mock_send_sms.assert_called_once()
        call_phone, call_msg = mock_send_sms.call_args[0]
        assert call_phone == phone
        assert "Consultation Booked Successfully" in call_msg
        assert "D001-Q001" in call_msg

        # 2. Duplicate event: Must NOT dispatch second SMS
        notif2, err2 = create_notification(
            patient_id=patient_id,
            notification_type="BOOKING_CONFIRMED",
            title="Consultation Booked Successfully",
            message="Confirmed for 2026-09-21 with Dr. Rao. Queue Token: D001-Q001.",
            booking_id=booking_id
        )

        assert err2 is None
        assert notif2["sms_sent"] is False
        assert mock_send_sms.call_count == 1

def test_turn_approaching_queue_service_recalculation_flow():
    """Verify recalculate_queue_positions triggers TURN_APPROACHING SMS in the required style with dynamic values"""
    from services.queue_service import recalculate_queue_positions

    patient_id = "TEST_PAT_RECALC"
    phone = "9876543299"
    queue_id = "D999-Q020"
    doctor_id = "D999"

    db = get_db()
    try:
        db.patients.delete_many({"patient_id": patient_id})
        db.queue.delete_many({"doctor_id": doctor_id})
        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Recalc Test Patient"})
        db.queue.insert_one({
            "queue_id": queue_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "department": "General Medicine",
            "priority": "normal",
            "position": 2,
            "status": "waiting",
            "room_number": "Room 204",
            "arrival_otp": "800066",
            "approaching_notified": False,
            "joined_at": "2026-09-20T10:00:00Z"
        })
    except Exception:
        pass

    mock_sms_res = (True, {"return": True, "message": "SMS sent"}, None)

    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms", return_value=mock_sms_res) as mock_send_sms:

        recalculate_queue_positions(doctor_id=doctor_id)

        assert mock_send_sms.call_count >= 1
        call_phone, call_msg = mock_send_sms.call_args[0]
        assert call_phone == phone
        assert "[SIMSRH Hospital] 🏥" in call_msg
        assert "Your turn is approaching" in call_msg
        assert f"Token {queue_id}" in call_msg
        assert "Queue position" in call_msg
        assert "Estimated wait" in call_msg
        assert "Expected consultation" in call_msg
        assert "Recommended departure" in call_msg
        assert "Please be near Room 204" in call_msg
        assert "Hospital Arrival Code 800066" in call_msg
        assert "Show this code at the reception desk on arrival" in call_msg
        assert "#" not in call_msg
        for line in call_msg.splitlines():
            if line.startswith("Token") or line.startswith("Queue position") or line.startswith("Estimated wait") or line.startswith("Please be near") or line.startswith("Hospital Arrival Code"):
                assert ":" not in line

def test_advance_booking_sends_only_one_comprehensive_sms():
    """Requirement 1, 2 & 4: Advance booking dispatches exactly ONE comprehensive SMS and keeps in-app notifications"""
    from services.appointment_service import book_appointment
    from datetime import date, timedelta

    patient_id = "TEST_PAT_ADV_01"
    phone = "9876543222"
    adv_date = (date.today() + timedelta(days=1)).isoformat()

    db = get_db()
    try:
        db.patients.delete_many({"patient_id": patient_id})
        db.appointments.delete_many({"patient_id": patient_id})
        db.queue.delete_many({"patient_id": patient_id})
        db.notifications.delete_many({"patient_id": patient_id})
        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Advance Patient"})
    except Exception:
        pass

    mock_sms_res = (True, {"return": True, "message": "SMS sent"}, None)

    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms", return_value=mock_sms_res) as mock_send:

        res, err = book_appointment({
            "patient_id": patient_id,
            "patient_name": "Advance Patient",
            "patient_phone": phone,
            "doctor_id": "D001",
            "department": "Cardiology",
            "consultation_date": adv_date,
            "consultation_slot": {"slot_id": "morning", "label": "09:00 AM - 01:00 PM", "date": adv_date},
            "city": "Tumakuru"
        })

        assert err is None
        assert res is not None

        # Exactly 1 SMS dispatched for the advance booking
        assert mock_send.call_count == 1
        c_phone, c_msg = mock_send.call_args[0]
        assert c_phone == phone
        assert "[SIMSRH Hospital] 🏥" in c_msg
        assert "Consultation Booked Successfully" in c_msg
        assert "Token" in c_msg
        assert "Queue position" in c_msg
        assert f"Date {adv_date}" in c_msg
        assert "Hospital Arrival Code" in c_msg
        assert "Show this code at the reception desk on arrival" in c_msg

        # Verify in-app notifications are intact in DB (Requirement 4)
        notifs = list(db.notifications.find({"patient_id": patient_id}))
        notif_types = [n["type"] for n in notifs]
        assert "BOOKING_CONFIRMED" in notif_types
        assert "QUEUE_UPDATED" in notif_types
        assert "DEPARTURE_REMINDER" in notif_types
        assert "ARRIVAL_OTP_ISSUED" in notif_types

        # Verify NO duplicate DEPARTURE_REMINDER exists (Requirement 2)
        assert notif_types.count("DEPARTURE_REMINDER") == 1

def test_future_booking_does_not_trigger_turn_approaching():
    """Requirement 3: Future/advance bookings do NOT trigger TURN_APPROACHING merely because position is 1 or 2"""
    from services.queue_service import recalculate_queue_positions
    from datetime import date, timedelta

    patient_id = "TEST_PAT_FUT_01"
    phone = "9876543223"
    future_date = (date.today() + timedelta(days=2)).isoformat()
    doc_id = "D888"

    db = get_db()
    try:
        db.patients.delete_many({"patient_id": patient_id})
        db.queue.delete_many({"doctor_id": doc_id})
        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Future Patient"})
        db.queue.insert_one({
            "queue_id": "D888-Q001",
            "patient_id": patient_id,
            "doctor_id": doc_id,
            "department": "Cardiology",
            "priority": "normal",
            "position": 1,
            "status": "waiting",
            "consultation_date": future_date,
            "slot_id": "morning",
            "arrival_otp": "777888",
            "approaching_notified": False,
            "joined_at": f"{future_date}T09:00:00Z"
        })
    except Exception:
        pass

    mock_sms_res = (True, {"return": True, "message": "SMS sent"}, None)

    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms", return_value=mock_sms_res) as mock_send:

        recalculate_queue_positions(doctor_id=doc_id, consultation_date=future_date, slot_id="morning")

        # Must NOT trigger any SMS because it's a future date
        assert mock_send.call_count == 0

def test_stable_canonical_event_identity_deduplication():
    """Requirement 5: B029 and D001-Q020 share one canonical event identity preventing duplicate SMS"""
    from services.notification_service import resolve_canonical_event_ids

    patient_id = "TEST_PAT_CANON_01"
    phone = "9876543224"
    booking_id = "B029"
    queue_id = "D001-Q020"

    db = get_db()
    try:
        db.patients.delete_many({"patient_id": patient_id})
        db.appointments.delete_many({"booking_id": booking_id})
        db.queue.delete_many({"queue_id": queue_id})
        db.notifications.delete_many({"patient_id": patient_id})

        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Canonical Patient"})
        db.appointments.insert_one({
            "booking_id": booking_id,
            "queue_id": queue_id,
            "patient_id": patient_id
        })
        db.queue.insert_one({
            "queue_id": queue_id,
            "booking_id": booking_id,
            "patient_id": patient_id
        })
    except Exception:
        pass

    # Verify canonical resolver links both tokens
    linked_ids = resolve_canonical_event_ids(booking_id)
    assert booking_id in linked_ids
    assert queue_id in linked_ids

    mock_sms_res = (True, {"return": True, "message": "SMS sent"}, None)

    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_sms", return_value=mock_sms_res) as mock_send:

        # First notification using booking_id
        n1, err1 = create_notification(
            patient_id=patient_id,
            notification_type="BOOKING_CONFIRMED",
            title="Consultation Booked",
            message="Confirmed.",
            booking_id=booking_id
        )
        assert err1 is None
        assert n1["sms_sent"] is True
        assert mock_send.call_count == 1

        # Second notification for the SAME booking event, but using queue_id token
        n2, err2 = create_notification(
            patient_id=patient_id,
            notification_type="BOOKING_CONFIRMED",
            title="Consultation Booked",
            message="Confirmed.",
            booking_id=queue_id
        )
        assert err2 is None
        assert n2["sms_sent"] is False
        # Deduplication must suppress second SMS!
        assert mock_send.call_count == 1
