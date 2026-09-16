import os
import re
import logging
from typing import Optional, Dict, Any, Tuple
import requests

from config import config

logger = logging.getLogger(__name__)

# Current MSG91 API v5 Endpoints
MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow/"
MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp"

# Default Network Timeout in seconds
DEFAULT_TIMEOUT_SEC = 4.0

def normalize_indian_phone(phone_input: Any) -> Optional[str]:
    """
    Safely normalizes Indian mobile phone numbers for MSG91.
    MSG91 expects the country code without '+' (e.g., '919876543210').
    
    Accepts:
      - 10 digits: '9876543210' -> '919876543210'
      - 11 digits with leading 0: '09876543210' -> '919876543210'
      - 12 digits with 91: '919876543210' -> '919876543210'
      - Formatted string: '+91 98765-43210' -> '919876543210'
    Returns:
      12-digit string starting with '91', or None if invalid.
    """
    if not phone_input:
        return None
    
    digits = re.sub(r"\D", "", str(phone_input).strip())
    
    if len(digits) == 10 and digits[0] in "6789":
        return f"91{digits}"
    elif len(digits) == 11 and digits.startswith("0") and digits[1] in "6789":
        return f"91{digits[1:]}"
    elif len(digits) == 12 and digits.startswith("91") and digits[2] in "6789":
        return digits
    
    return None

def mask_phone(phone_str: Optional[str]) -> str:
    """Masks phone number for safe, privacy-preserving logging (e.g., '******3210')."""
    if not phone_str or len(phone_str) < 4:
        return "******"
    return f"******{phone_str[-4:]}"

class Msg91SmsService:
    """
    MSG91 SMS & OTP Service (API v5).
    Safely dispatches SMS notifications and verification OTPs.
    Strictly isolates credentials and prevents network/gateway errors from
    interrupting core clinical, queue, or auth operations.
    """

    def __init__(self):
        self.flow_url = MSG91_FLOW_URL
        self.otp_url = MSG91_OTP_URL
        self.timeout = DEFAULT_TIMEOUT_SEC

    @property
    def auth_key(self) -> str:
        return getattr(config, "MSG91_AUTH_KEY", "") or os.getenv("MSG91_AUTH_KEY", "")

    @property
    def sender_id(self) -> str:
        return getattr(config, "MSG91_SENDER_ID", "SIMSRH") or os.getenv("MSG91_SENDER_ID", "SIMSRH")

    @property
    def is_enabled(self) -> bool:
        return bool(getattr(config, "MSG91_SMS_ENABLED", False)) or (os.getenv("MSG91_SMS_ENABLED", "false").lower() in ("true", "1", "t"))

    @property
    def default_otp_template_id(self) -> str:
        return getattr(config, "MSG91_OTP_TEMPLATE_ID", "") or os.getenv("MSG91_OTP_TEMPLATE_ID", "")

    @property
    def default_flow_id(self) -> str:
        return getattr(config, "MSG91_FLOW_ID", "") or os.getenv("MSG91_FLOW_ID", "")

    def send_sms(
        self,
        phone: str,
        message: str,
        template_id: Optional[str] = None,
        extra_variables: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Sends an SMS notification using MSG91 Flow API v5.
        
        Args:
            phone: Target phone number
            message: Fallback message text or primary message
            template_id: MSG91 Flow / Template ID
            extra_variables: Key-value dictionary for dynamic template variables
        
        Returns:
            Tuple of (success: bool, response_dict: dict, error_message: Optional[str])
        """
        normalized_phone = normalize_indian_phone(phone)
        masked_number = mask_phone(normalized_phone or phone)

        # 1. Validation check
        if not normalized_phone:
            logger.warning("SMS delivery skipped: Invalid phone number format (%s)", masked_number)
            return False, {"status": "invalid_phone"}, "Invalid Indian phone number format"

        # 2. Enabled flag check
        if not self.is_enabled:
            logger.info("MSG91 SMS disabled (MSG91_SMS_ENABLED=False). Skipped dispatch to %s", masked_number)
            return True, {"status": "skipped", "reason": "MSG91_SMS_ENABLED is False", "mock": True}, None

        # 3. Auth key check
        if not self.auth_key:
            logger.warning("MSG91 Auth Key is missing in configuration. Skipped dispatch to %s", masked_number)
            return False, {"status": "missing_credentials"}, "MSG91 Auth Key not configured"

        flow_template = template_id or self.default_flow_id
        payload_vars = {"message": message}
        if extra_variables and isinstance(extra_variables, dict):
            payload_vars.update(extra_variables)

        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        # MSG91 Flow v5 request schema
        payload = {
            "template_id": flow_template,
            "sender": self.sender_id,
            "short_url": "0",
            "recipients": [
                {
                    "mobiles": normalized_phone,
                    **payload_vars
                }
            ]
        }

        try:
            response = requests.post(
                self.flow_url,
                json=payload,
                headers=headers,
                timeout=self.timeout
            )
            
            # Safe JSON parsing
            try:
                res_data = response.json()
            except Exception:
                res_data = {"raw_response": response.text[:200]}

            if response.status_code in (200, 201, 202):
                logger.info("MSG91 SMS dispatched successfully to %s", masked_number)
                return True, res_data, None
            else:
                logger.warning("MSG91 SMS gateway returned status %s for %s", response.status_code, masked_number)
                return False, res_data, f"Gateway returned status {response.status_code}"

        except requests.exceptions.Timeout:
            logger.warning("MSG91 SMS gateway timed out (>%ss) for %s", self.timeout, masked_number)
            return False, {"status": "timeout"}, "Gateway request timed out"
        except Exception as ex:
            logger.warning("MSG91 SMS dispatch encountered exception: %s", type(ex).__name__)
            return False, {"status": "error", "error_type": type(ex).__name__}, str(ex)

    def send_otp(
        self,
        phone: str,
        otp_code: str,
        template_id: Optional[str] = None
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Dispatches a 6-digit verification OTP using MSG91 Send OTP API v5.
        
        Args:
            phone: Target phone number
            otp_code: The 6-digit OTP string
            template_id: Optional DLT/MSG91 OTP template ID
        
        Returns:
            Tuple of (success: bool, response_dict: dict, error_message: Optional[str])
        """
        normalized_phone = normalize_indian_phone(phone)
        masked_number = mask_phone(normalized_phone or phone)

        # 1. Validation check
        if not normalized_phone:
            logger.warning("OTP dispatch skipped: Invalid phone number format (%s)", masked_number)
            return False, {"status": "invalid_phone"}, "Invalid Indian phone number format"

        if not otp_code or not str(otp_code).strip():
            logger.warning("OTP dispatch skipped: Empty OTP code for %s", masked_number)
            return False, {"status": "invalid_otp"}, "Empty OTP code"

        # 2. Enabled flag check
        if not self.is_enabled:
            logger.info("MSG91 SMS disabled (MSG91_SMS_ENABLED=False). Skipped OTP dispatch to %s", masked_number)
            return True, {"status": "skipped", "reason": "MSG91_SMS_ENABLED is False", "mock": True}, None

        # 3. Auth key check
        if not self.auth_key:
            logger.warning("MSG91 Auth Key is missing in configuration. Skipped OTP dispatch to %s", masked_number)
            return False, {"status": "missing_credentials"}, "MSG91 Auth Key not configured"

        otp_template = template_id or self.default_otp_template_id

        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        # MSG91 OTP v5 request schema
        payload = {
            "template_id": otp_template,
            "mobile": normalized_phone,
            "otp": str(otp_code).strip()
        }

        try:
            response = requests.post(
                self.otp_url,
                json=payload,
                headers=headers,
                timeout=self.timeout
            )

            try:
                res_data = response.json()
            except Exception:
                res_data = {"raw_response": response.text[:200]}

            if response.status_code in (200, 201, 202):
                logger.info("MSG91 OTP dispatched successfully to %s", masked_number)
                return True, res_data, None
            else:
                logger.warning("MSG91 OTP gateway returned status %s for %s", response.status_code, masked_number)
                return False, res_data, f"Gateway returned status {response.status_code}"

        except requests.exceptions.Timeout:
            logger.warning("MSG91 OTP gateway timed out (>%ss) for %s", self.timeout, masked_number)
            return False, {"status": "timeout"}, "Gateway request timed out"
        except Exception as ex:
            logger.warning("MSG91 OTP dispatch encountered exception: %s", type(ex).__name__)
            return False, {"status": "error", "error_type": type(ex).__name__}, str(ex)

# Singleton service instance
sms_service = Msg91SmsService()
