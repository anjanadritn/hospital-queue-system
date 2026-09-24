import os
import re
import time
import hashlib
import logging
from typing import Optional, Dict, Any, Tuple
import requests

from config import config

logger = logging.getLogger(__name__)

# Fast2SMS Quick SMS API endpoint
FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"

# Default Network Timeout in seconds
DEFAULT_TIMEOUT_SEC = 4.0

def normalize_indian_phone(phone_input: Any) -> Optional[str]:
    """
    Safely normalizes Indian mobile phone numbers for Fast2SMS Quick SMS API.
    Fast2SMS expects a 10-digit Indian mobile number without country code.
    
    Accepts:
      - 10 digits: '9876543210' -> '9876543210'
      - 11 digits with leading 0: '09876543210' -> '9876543210'
      - 12 digits with 91: '919876543210' -> '9876543210'
      - Formatted string: '+91 98765-43210' -> '9876543210'
    Returns:
      10-digit string starting with 6, 7, 8, or 9, or None if invalid.
    """
    if not phone_input:
        return None

    # Strip whitespace and common separators
    cleaned = re.sub(r"[\s\-\(\)\+]", "", str(phone_input).strip())

    # Handle 12 digits starting with country code 91
    if len(cleaned) == 12 and cleaned.startswith("91"):
        cleaned = cleaned[2:]
    # Handle 11 digits starting with trunk prefix 0
    elif len(cleaned) == 11 and cleaned.startswith("0"):
        cleaned = cleaned[1:]

    # Must be exactly 10 digits starting with 6, 7, 8, or 9
    if len(cleaned) == 10 and cleaned.isdigit() and cleaned[0] in ("6", "7", "8", "9"):
        return cleaned

    return None

def mask_phone(phone: Optional[str]) -> str:
    """Masks phone number for secure logging (e.g., '******3210')"""
    if not phone:
        return "******"
    cleaned = str(phone).strip()
    if len(cleaned) <= 4:
        return "******"
    return f"******{cleaned[-4:]}"

class Fast2SmsService:
    """
    Fast2SMS Quick SMS Service.
    Dispatches SMS notifications and verification OTPs using Fast2SMS Quick SMS API (POST https://www.fast2sms.com/dev/bulkV2).
    Strictly isolates credentials, keeps SMS failures non-fatal, and never logs the API key.
    Includes duplicate content suppression (300s) and rate safety limits (max 3/60s).
    """

    def __init__(self):
        self.url = FAST2SMS_URL
        self.timeout = DEFAULT_TIMEOUT_SEC
        self._sent_message_hashes: Dict[str, float] = {}
        self._phone_dispatch_timestamps: Dict[str, list] = {}

    def _reset_safety_guards(self):
        """Clears in-memory duplicate cache and rate limit history (primarily for tests)"""
        self._sent_message_hashes.clear()
        self._phone_dispatch_timestamps.clear()

    @property
    def api_key(self) -> str:
        val = getattr(config, "FAST2SMS_API_KEY", None)
        if val is not None:
            return str(val)
        return os.getenv("FAST2SMS_API_KEY", "")

    @property
    def is_enabled(self) -> bool:
        val = getattr(config, "FAST2SMS_SMS_ENABLED", None)
        if val is not None:
            return bool(val)
        return os.getenv("FAST2SMS_SMS_ENABLED", "false").lower() in ("true", "1", "t")

    def send_sms(
        self,
        phone: str,
        message: str,
        **kwargs
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Sends an SMS notification using Fast2SMS Quick SMS API (route=q).
        
        Args:
            phone: Target phone number (Indian mobile)
            message: Message text to send
        
        Returns:
            Tuple of (success: bool, response_dict: dict, error_message: Optional[str])
        """
        normalized_phone = normalize_indian_phone(phone)
        masked_number = mask_phone(normalized_phone or phone)

        # 1. Validation check
        if not normalized_phone:
            logger.warning("Fast2SMS delivery skipped: Invalid phone number format (%s)", masked_number)
            return False, {"status": "invalid_phone"}, "Invalid Indian phone number format"

        clean_message = str(message).strip() if message else ""
        if not clean_message:
            logger.warning("Fast2SMS delivery skipped: Empty message text for %s", masked_number)
            return False, {"status": "empty_message"}, "Empty message text"

        # 2. Enabled flag check (respect FAST2SMS_SMS_ENABLED, False by default)
        if not self.is_enabled:
            logger.info("Fast2SMS disabled (FAST2SMS_SMS_ENABLED=False). Skipped dispatch to %s", masked_number)
            return True, {"status": "skipped", "reason": "FAST2SMS_SMS_ENABLED is False", "mock": True}, None

        # 3. Server-side duplicate content guard (suppress identical SMS to same recipient within 300s)
        now_ts = time.time()
        msg_hash = hashlib.sha256(f"{normalized_phone}:{clean_message}".encode("utf-8")).hexdigest()
        last_sent_ts = self._sent_message_hashes.get(msg_hash)
        if last_sent_ts and (now_ts - last_sent_ts < 300):
            logger.warning(
                "Fast2SMS duplicate suppression: identical message already dispatched to %s in last 300s",
                masked_number
            )
            return True, {"status": "suppressed_duplicate", "reason": "Identical SMS dispatched recently"}, None

        # 4. Server-side rate limit safety guard (max 3 dispatches per 60s per phone number)
        past_timestamps = [t for t in self._phone_dispatch_timestamps.get(normalized_phone, []) if now_ts - t < 60]
        if len(past_timestamps) >= 3:
            logger.warning(
                "Fast2SMS rate limit guard: throttled SMS to %s (%d sent in last 60s)",
                masked_number,
                len(past_timestamps)
            )
            return False, {"status": "rate_limited", "reason": "SMS rate limit exceeded (max 3 per 60s)"}, "SMS rate limit exceeded for this phone number"

        # 5. API key check
        if not self.api_key:
            logger.warning("Fast2SMS API Key is missing in configuration. Skipped dispatch to %s", masked_number)
            return False, {"status": "missing_credentials"}, "Fast2SMS API Key not configured"

        headers = {
            "authorization": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        payload = {
            "route": "q",
            "message": clean_message,
            "numbers": normalized_phone
        }

        try:
            response = requests.post(
                self.url,
                json=payload,
                headers=headers,
                timeout=self.timeout
            )

            try:
                res_data = response.json()
            except Exception:
                res_data = {"raw_response": response.text[:200]}

            # Fast2SMS returns {"return": true, ...} on success
            if response.status_code in (200, 201, 202) and res_data.get("return", True) is not False:
                logger.info("Fast2SMS dispatched successfully to %s", masked_number)
                # Register success in safety guards
                self._sent_message_hashes[msg_hash] = now_ts
                past_timestamps.append(now_ts)
                self._phone_dispatch_timestamps[normalized_phone] = past_timestamps
                return True, res_data, None
            else:
                msg = res_data.get("message")
                err_msg = (", ".join(msg) if isinstance(msg, list) else str(msg)) if msg else f"Gateway returned status {response.status_code}"
                logger.warning("Fast2SMS gateway returned error for %s: %s", masked_number, err_msg)
                return False, res_data, err_msg

        except requests.exceptions.Timeout:
            logger.warning("Fast2SMS gateway timed out (>%ss) for %s", self.timeout, masked_number)
            return False, {"status": "timeout"}, "Gateway request timed out"
        except Exception as ex:
            logger.warning("Fast2SMS dispatch encountered exception: %s", type(ex).__name__)
            return False, {"status": "error", "error_type": type(ex).__name__}, str(ex)

    def send_otp(
        self,
        phone: str,
        otp_code: str,
        template_id: Optional[str] = None,
        **kwargs
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Dispatches a verification OTP via Fast2SMS Quick SMS route.
        """
        if not otp_code or not str(otp_code).strip():
            logger.warning("Fast2SMS OTP dispatch skipped: Empty OTP code for %s", mask_phone(phone))
            return False, {"status": "invalid_otp"}, "Empty OTP code"

        message = f"Your verification OTP for SIMSRH Smart Hospital is {str(otp_code).strip()}. Valid for 10 minutes. Please do not share this OTP with anyone."
        return self.send_sms(phone=phone, message=message)

# Backward compatibility alias
Msg91SmsService = Fast2SmsService

# Authoritative singleton service instance
sms_service = Fast2SmsService()
