import pytest
from unittest.mock import patch, MagicMock
import requests
from services.sms_service import (
    normalize_indian_phone,
    mask_phone,
    Msg91SmsService,
    sms_service
)

def test_normalize_indian_phone():
    # 10 digit standard
    assert normalize_indian_phone("9876543210") == "919876543210"
    assert normalize_indian_phone("8123456789") == "918123456789"
    assert normalize_indian_phone("7012345678") == "917012345678"
    assert normalize_indian_phone("6361234567") == "916361234567"

    # Leading zero
    assert normalize_indian_phone("09876543210") == "919876543210"

    # Already prefixed with 91
    assert normalize_indian_phone("919876543210") == "919876543210"

    # Formatted with +, spaces, dashes
    assert normalize_indian_phone("+91 98765-43210") == "919876543210"

    # Invalid cases
    assert normalize_indian_phone("") is None
    assert normalize_indian_phone("12345") is None
    assert normalize_indian_phone("1234567890") is None  # Does not start with 6, 7, 8, 9
    assert normalize_indian_phone("abcdefghij") is None
    assert normalize_indian_phone(None) is None

def test_mask_phone():
    assert mask_phone("919876543210") == "******3210"
    assert mask_phone("9876543210") == "******3210"
    assert mask_phone("12") == "******"
    assert mask_phone(None) == "******"

def test_sms_disabled_by_default():
    svc = Msg91SmsService()
    with patch("config.config.MSG91_SMS_ENABLED", False):
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
    svc = Msg91SmsService()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"type": "success", "message": "SMS submitted successfully"}

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("config.config.MSG91_AUTH_KEY", "mock_msg91_auth_key_12345"), \
         patch("requests.post", return_value=mock_response) as mock_post:

        success, res, err = svc.send_sms("9876543210", "Your token Q001 is next in line.")
        
        assert success is True
        assert err is None
        assert res.get("type") == "success"
        
        # Verify request parameters
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "https://control.msg91.com/api/v5/flow/"
        assert kwargs["headers"]["authkey"] == "mock_msg91_auth_key_12345"
        payload = kwargs["json"]
        assert payload["sender"] == "SIMSRH"
        assert payload["recipients"][0]["mobiles"] == "919876543210"
        assert payload["recipients"][0]["message"] == "Your token Q001 is next in line."

def test_send_otp_success_mocked():
    svc = Msg91SmsService()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"type": "success", "message": "OTP sent successfully"}

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("config.config.MSG91_AUTH_KEY", "mock_msg91_auth_key_12345"), \
         patch("requests.post", return_value=mock_response) as mock_post:

        success, res, err = svc.send_otp("9876543210", "654321")
        
        assert success is True
        assert err is None
        assert res.get("type") == "success"
        
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "https://control.msg91.com/api/v5/otp"
        assert kwargs["headers"]["authkey"] == "mock_msg91_auth_key_12345"
        payload = kwargs["json"]
        assert payload["mobile"] == "919876543210"
        assert payload["otp"] == "654321"

def test_send_sms_timeout_handled_gracefully():
    svc = Msg91SmsService()
    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("config.config.MSG91_AUTH_KEY", "mock_msg91_auth_key_12345"), \
         patch("requests.post", side_effect=requests.exceptions.Timeout("Connection timed out")):

        # Must not raise an exception; must return failure status gracefully
        success, res, err = svc.send_sms("9876543210", "Test timeout")
        assert success is False
        assert res.get("status") == "timeout"
        assert "timed out" in err.lower()

def test_send_otp_gateway_error_handled_gracefully():
    svc = Msg91SmsService()
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.json.return_value = {"type": "error", "message": "Invalid Template ID"}

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("config.config.MSG91_AUTH_KEY", "mock_msg91_auth_key_12345"), \
         patch("requests.post", return_value=mock_response):

        success, res, err = svc.send_otp("9876543210", "123456")
        assert success is False
        assert "400" in err
        assert res.get("type") == "error"

def test_invalid_phone_number_rejected():
    svc = Msg91SmsService()
    success, res, err = svc.send_sms("invalid-phone", "Hello")
    assert success is False
    assert res.get("status") == "invalid_phone"
    assert "Invalid Indian phone number" in err
