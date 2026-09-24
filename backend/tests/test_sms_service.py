import pytest
from unittest.mock import patch, MagicMock
import requests
from services.sms_service import (
    normalize_indian_phone,
    mask_phone,
    Fast2SmsService,
    Msg91SmsService,
    sms_service
)

def test_normalize_indian_phone():
    # 10 digit standard -> normalized 10-digit
    assert normalize_indian_phone("9876543210") == "9876543210"
    assert normalize_indian_phone("8123456789") == "8123456789"
    assert normalize_indian_phone("7012345678") == "7012345678"
    assert normalize_indian_phone("6361234567") == "6361234567"

    # Leading zero
    assert normalize_indian_phone("09876543210") == "9876543210"

    # Prefixed with 91
    assert normalize_indian_phone("919876543210") == "9876543210"

    # Formatted with +, spaces, dashes
    assert normalize_indian_phone("+91 98765-43210") == "9876543210"

    # Invalid cases
    assert normalize_indian_phone("") is None
    assert normalize_indian_phone("12345") is None
    assert normalize_indian_phone("1234567890") is None  # Does not start with 6, 7, 8, 9
    assert normalize_indian_phone("abcdefghij") is None
    assert normalize_indian_phone(None) is None

def test_mask_phone():
    assert mask_phone("9876543210") == "******3210"
    assert mask_phone("919876543210") == "******3210"
    assert mask_phone("12") == "******"
    assert mask_phone(None) == "******"

def test_sms_disabled_by_default():
    svc = Fast2SmsService()
    with patch("config.config.FAST2SMS_SMS_ENABLED", False):
        with patch("requests.post") as mock_post:
            success, res, err = svc.send_sms("9876543210", "Test message")
            assert success is True
            assert res.get("status") == "skipped"
            assert res.get("mock") is True
            assert err is None
            mock_post.assert_not_called()

            # OTP when disabled
            success_otp, res_otp, err_otp = svc.send_otp("9876543210", "123456")
            assert success_otp is True
            assert res_otp.get("status") == "skipped"
            mock_post.assert_not_called()

def test_send_sms_success_mocked():
    svc = Fast2SmsService()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "return": True,
        "request_id": "fast2sms_req_12345",
        "message": ["SMS sent successfully."]
    }

    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("config.config.FAST2SMS_API_KEY", "mock_fast2sms_key_xyz"), \
         patch("requests.post", return_value=mock_response) as mock_post:

        success, res, err = svc.send_sms("9876543210", "Your token Q001 is next in line.")
        
        assert success is True
        assert err is None
        assert res.get("return") is True
        
        # Verify request parameters
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "https://www.fast2sms.com/dev/bulkV2"
        assert kwargs["headers"]["authorization"] == "mock_fast2sms_key_xyz"
        payload = kwargs["json"]
        assert payload["route"] == "q"
        assert payload["numbers"] == "9876543210"
        assert payload["message"] == "Your token Q001 is next in line."

def test_send_otp_success_mocked():
    svc = Fast2SmsService()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "return": True,
        "request_id": "fast2sms_otp_999",
        "message": ["SMS sent successfully."]
    }

    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("config.config.FAST2SMS_API_KEY", "mock_fast2sms_key_xyz"), \
         patch("requests.post", return_value=mock_response) as mock_post:

        success, res, err = svc.send_otp("9876543210", "654321")
        
        assert success is True
        assert err is None
        assert res.get("return") is True
        
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "https://www.fast2sms.com/dev/bulkV2"
        assert kwargs["headers"]["authorization"] == "mock_fast2sms_key_xyz"
        payload = kwargs["json"]
        assert payload["route"] == "q"
        assert payload["numbers"] == "9876543210"
        assert "654321" in payload["message"]

def test_send_sms_timeout_handled_gracefully():
    svc = Fast2SmsService()
    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("config.config.FAST2SMS_API_KEY", "mock_fast2sms_key_xyz"), \
         patch("requests.post", side_effect=requests.exceptions.Timeout("Connection timed out")):

        # Must not raise an exception; must return failure status gracefully
        success, res, err = svc.send_sms("9876543210", "Test timeout")
        assert success is False
        assert res.get("status") == "timeout"
        assert "timed out" in err.lower()

def test_send_sms_gateway_error_handled_gracefully():
    svc = Fast2SmsService()
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.json.return_value = {"return": False, "message": "Invalid API Key or Route"}

    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("config.config.FAST2SMS_API_KEY", "mock_fast2sms_key_xyz"), \
         patch("requests.post", return_value=mock_response):

        success, res, err = svc.send_sms("9876543210", "Test gateway error")
        assert success is False
        assert "Invalid API Key or Route" in err
        assert res.get("return") is False

def test_invalid_phone_number_rejected():
    svc = Fast2SmsService()
    success, res, err = svc.send_sms("invalid-phone", "Hello")
    assert success is False
    assert res.get("status") == "invalid_phone"
    assert "Invalid Indian phone number" in err

def test_missing_api_key_handled_gracefully():
    svc = Fast2SmsService()
    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("config.config.FAST2SMS_API_KEY", ""):
        
        success, res, err = svc.send_sms("9876543210", "Test message")
        assert success is False
        assert res.get("status") == "missing_credentials"
        assert "not configured" in err.lower()

def test_singleton_and_alias():
    assert isinstance(sms_service, Fast2SmsService)
    assert Msg91SmsService is Fast2SmsService

def test_duplicate_message_hash_guard():
    """Requirement 6: Suppress identical SMS dispatched to the same phone within safety window"""
    svc = Fast2SmsService()
    svc._reset_safety_guards()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"return": True, "message": ["SMS sent successfully."]}

    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("config.config.FAST2SMS_API_KEY", "mock_key_123"), \
         patch("requests.post", return_value=mock_response) as mock_post:

        # 1. First send dispatches to gateway
        s1, res1, err1 = svc.send_sms("9876543210", "Your turn is approaching.")
        assert s1 is True
        assert err1 is None
        assert mock_post.call_count == 1

        # 2. Second send with identical recipient and content is suppressed by hash guard
        s2, res2, err2 = svc.send_sms("9876543210", "Your turn is approaching.")
        assert s2 is True
        assert res2.get("status") == "suppressed_duplicate"
        # Gateway was NOT called a second time
        assert mock_post.call_count == 1

def test_rate_limit_safety_guard():
    """Requirement 6: Throttle rapid requests exceeding max 3 dispatches per 60s per phone number"""
    svc = Fast2SmsService()
    svc._reset_safety_guards()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"return": True, "message": ["SMS sent successfully."]}

    with patch("config.config.FAST2SMS_SMS_ENABLED", True), \
         patch("config.config.FAST2SMS_API_KEY", "mock_key_123"), \
         patch("requests.post", return_value=mock_response) as mock_post:

        # Send 3 distinct messages to same number
        s1, _, _ = svc.send_sms("9876543210", "Msg 1")
        s2, _, _ = svc.send_sms("9876543210", "Msg 2")
        s3, _, _ = svc.send_sms("9876543210", "Msg 3")
        assert s1 and s2 and s3
        assert mock_post.call_count == 3

        # 4th distinct message within 60s must be throttled
        s4, res4, err4 = svc.send_sms("9876543210", "Msg 4")
        assert s4 is False
        assert res4.get("status") == "rate_limited"
        assert "rate limit exceeded" in err4.lower()
        # Gateway request not made for 4th
        assert mock_post.call_count == 3
