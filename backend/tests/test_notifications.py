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
        assert "Your Turn is Approaching!" in call_msg
        assert "Q001" in call_msg

def test_notification_sms_disabled():
    """When MSG91_SMS_ENABLED=False, in-app notification is created without sending SMS"""
    patient_id = "TEST_PAT_002"
    phone = "9876543212"

    try:
        db = get_db()
        db.patients.insert_one({"patient_id": patient_id, "phone": phone, "name": "Test Patient 2"})
    except Exception:
        pass

    with patch("config.config.MSG91_SMS_ENABLED", False), \
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
