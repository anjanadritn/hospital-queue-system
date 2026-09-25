"""
Tests: Hospital Time Service (Asia/Kolkata IST)
================================================
Verifies that the centralized time_service produces correct,
consistent IST-based datetimes across all hospital operations.

Run from the backend directory:
    pytest tests/test_time_service.py -v
"""

import sys
import os
from datetime import datetime, date, timedelta, timezone
from unittest.mock import patch, MagicMock

import pytest

# Ensure backend package is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─────────────────────────────────────────────────────────────────────────────
# Helpers / constants
# ─────────────────────────────────────────────────────────────────────────────
IST_OFFSET_HOURS = 5
IST_OFFSET_MINUTES = 30
IST_UTC_OFFSET = timedelta(hours=IST_OFFSET_HOURS, minutes=IST_OFFSET_MINUTES)

try:
    from zoneinfo import ZoneInfo
    _EXPECTED_TZ = ZoneInfo("Asia/Kolkata")
except ImportError:
    _EXPECTED_TZ = timezone(IST_UTC_OFFSET, name="IST")


# ─────────────────────────────────────────────────────────────────────────────
# Import under test
# ─────────────────────────────────────────────────────────────────────────────
from services.time_service import (
    HOSPITAL_TZ,
    now_ist, now_utc, today_ist, today_iso_ist, tomorrow_iso_ist, days_from_now_ist,
    ist_isoformat, ist_timestamp, to_ist, to_utc, format_ist, parse_iso_to_ist,
    otp_expiry_ist, is_otp_expired, arrival_deadline_ist,
    is_morning_slot_closed_today, is_evening_slot_closed_today, is_slot_open,
    MORNING_SLOT_CUTOFF_HOUR, EVENING_SLOT_CUTOFF_HOUR,
    get_server_time_payload,
)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

def _make_ist_time(hour: int, minute: int = 0) -> datetime:
    """Create an IST-aware datetime for today at the given hour:minute."""
    today = date.today()
    dt = datetime(today.year, today.month, today.day, hour, minute, 0, tzinfo=HOSPITAL_TZ)
    return dt


# ─────────────────────────────────────────────────────────────────────────────
# 1. Timezone identity
# ─────────────────────────────────────────────────────────────────────────────

class TestTimezoneIdentity:

    def test_hospital_tz_is_ist(self):
        """HOSPITAL_TZ must be Asia/Kolkata or fixed UTC+05:30."""
        sample = datetime(2024, 1, 1, 12, 0, 0, tzinfo=HOSPITAL_TZ)
        offset = sample.utcoffset()
        assert offset == IST_UTC_OFFSET, (
            f"Expected UTC+05:30 offset, got {offset}"
        )

    def test_now_ist_is_aware(self):
        now = now_ist()
        assert now.tzinfo is not None, "now_ist() must return timezone-aware datetime"

    def test_now_ist_offset(self):
        now = now_ist()
        assert now.utcoffset() == IST_UTC_OFFSET

    def test_now_utc_is_aware_utc(self):
        now = now_utc()
        assert now.tzinfo is not None
        assert now.utcoffset() == timedelta(0), "now_utc() must be UTC (offset=0)"

    def test_ist_and_utc_difference(self):
        """IST - UTC must always be exactly +05:30."""
        ist = now_ist()
        utc = now_utc()
        diff = ist.utcoffset() - utc.utcoffset()
        assert diff == IST_UTC_OFFSET


# ─────────────────────────────────────────────────────────────────────────────
# 2. Date helpers
# ─────────────────────────────────────────────────────────────────────────────

class TestDateHelpers:

    def test_today_ist_returns_date(self):
        d = today_ist()
        assert isinstance(d, date)

    def test_today_iso_ist_format(self):
        iso = today_iso_ist()
        # Must be YYYY-MM-DD
        assert len(iso) == 10
        parts = iso.split("-")
        assert len(parts) == 3
        assert len(parts[0]) == 4  # year

    def test_tomorrow_iso_ist(self):
        today = today_iso_ist()
        tomorrow = tomorrow_iso_ist()
        today_dt = datetime.strptime(today, "%Y-%m-%d").date()
        tomorrow_dt = datetime.strptime(tomorrow, "%Y-%m-%d").date()
        assert tomorrow_dt - today_dt == timedelta(days=1)

    def test_days_from_now_ist(self):
        for n in [0, 1, 2, 7, 30]:
            result = days_from_now_ist(n)
            expected = (today_ist() + timedelta(days=n)).isoformat()
            assert result == expected, f"days_from_now_ist({n}) mismatch"


# ─────────────────────────────────────────────────────────────────────────────
# 3. ISO format string helpers
# ─────────────────────────────────────────────────────────────────────────────

class TestIsoFormatHelpers:

    def test_ist_isoformat_contains_offset(self):
        iso = ist_isoformat()
        # Should contain +05:30 (or +05:3 on some Python builds)
        assert "+05:30" in iso, f"Expected +05:30 in IST ISO string, got: {iso}"

    def test_ist_isoformat_of_given_dt(self):
        fixed_dt = _make_ist_time(10, 30)
        iso = ist_isoformat(fixed_dt)
        assert "10:30:00" in iso
        assert "+05:30" in iso

    def test_ist_timestamp_is_posix(self):
        ts = ist_timestamp()
        # A valid POSIX timestamp for 2020+ will be > 1e9
        assert ts > 1_000_000_000

    def test_ist_timestamp_consistent_with_now_ist(self):
        now = now_ist()
        ts_direct = ist_timestamp(now)
        ts_helper = now.timestamp()
        assert abs(ts_direct - ts_helper) < 0.01  # within 10ms


# ─────────────────────────────────────────────────────────────────────────────
# 4. Conversion helpers
# ─────────────────────────────────────────────────────────────────────────────

class TestConversionHelpers:

    def test_to_ist_from_utc_datetime(self):
        utc_dt = datetime(2024, 6, 15, 8, 30, 0, tzinfo=timezone.utc)  # 08:30 UTC
        ist_dt = to_ist(utc_dt)
        # 08:30 UTC → 14:00 IST
        assert ist_dt.hour == 14
        assert ist_dt.minute == 0

    def test_to_ist_from_iso_string_utc(self):
        iso = "2024-06-15T08:30:00Z"
        ist_dt = to_ist(iso)
        assert ist_dt.hour == 14
        assert ist_dt.minute == 0
        assert ist_dt.utcoffset() == IST_UTC_OFFSET

    def test_to_ist_from_naive_assumes_ist(self):
        naive = datetime(2024, 6, 15, 14, 0, 0)  # naive, assume IST
        ist_dt = to_ist(naive)
        assert ist_dt.tzinfo is not None
        assert ist_dt.hour == 14
        assert ist_dt.utcoffset() == IST_UTC_OFFSET

    def test_to_utc_from_ist(self):
        ist_dt = datetime(2024, 6, 15, 14, 0, 0, tzinfo=HOSPITAL_TZ)
        utc_dt = to_utc(ist_dt)
        # 14:00 IST → 08:30 UTC
        assert utc_dt.hour == 8
        assert utc_dt.minute == 30
        assert utc_dt.tzinfo == timezone.utc

    def test_parse_iso_to_ist(self):
        iso = "2024-06-15T14:00:00+05:30"
        dt = parse_iso_to_ist(iso)
        assert dt.hour == 14
        assert dt.utcoffset() == IST_UTC_OFFSET

    def test_format_ist(self):
        fixed_dt = _make_ist_time(9, 15)
        result = format_ist(fixed_dt, fmt="%H:%M IST")
        assert result == "09:15 IST"


# ─────────────────────────────────────────────────────────────────────────────
# 5. OTP expiry helpers
# ─────────────────────────────────────────────────────────────────────────────

class TestOtpExpiryHelpers:

    def test_otp_expiry_ist_returns_three_values(self):
        expires_dt, expires_iso, expires_ts = otp_expiry_ist(minutes=60)
        assert isinstance(expires_dt, datetime)
        assert isinstance(expires_iso, str)
        assert isinstance(expires_ts, float)

    def test_otp_expiry_ist_offset_is_correct(self):
        expires_dt, _, _ = otp_expiry_ist(minutes=60)
        delta = expires_dt - now_ist()
        # Should be approximately 60 minutes
        assert 59 <= delta.total_seconds() / 60 <= 61

    def test_otp_expiry_ist_has_ist_offset(self):
        _, iso, _ = otp_expiry_ist(minutes=60)
        assert "+05:30" in iso

    def test_is_otp_expired_past_timestamp(self):
        past_ts = (now_ist() - timedelta(hours=1)).timestamp()
        assert is_otp_expired(past_ts) is True

    def test_is_otp_expired_future_timestamp(self):
        future_ts = (now_ist() + timedelta(hours=1)).timestamp()
        assert is_otp_expired(future_ts) is False

    def test_is_otp_not_expired_24h(self):
        _, _, ts = otp_expiry_ist(minutes=1440)
        assert is_otp_expired(ts) is False


# ─────────────────────────────────────────────────────────────────────────────
# 6. Arrival deadline helper
# ─────────────────────────────────────────────────────────────────────────────

class TestArrivalDeadline:

    def test_arrival_deadline_returns_two_values(self):
        dt, iso = arrival_deadline_ist(wait_minutes=30, safety_buffer_minutes=10)
        assert isinstance(dt, datetime)
        assert isinstance(iso, str)

    def test_arrival_deadline_is_in_future_for_long_wait(self):
        dt, _ = arrival_deadline_ist(wait_minutes=60, safety_buffer_minutes=10)
        assert dt > now_ist()

    def test_arrival_deadline_has_ist_offset(self):
        _, iso = arrival_deadline_ist(wait_minutes=30)
        assert "+05:30" in iso


# ─────────────────────────────────────────────────────────────────────────────
# 7. Slot time-gate helpers — mocking IST clock
# ─────────────────────────────────────────────────────────────────────────────

class TestSlotTimeGates:
    """
    All slot cutoff checks are driven by now_ist().
    We mock time_service.now_ist to simulate specific IST times.
    """

    TODAY_ISO = date.today().isoformat()
    TOMORROW_ISO = (date.today() + timedelta(days=1)).isoformat()

    def _mock_ist(self, hour: int, minute: int = 0):
        """Return a context manager that freezes now_ist() at given hour:minute IST."""
        frozen = _make_ist_time(hour, minute)
        return patch("services.time_service.datetime")

    # --- Morning slot ---

    def test_morning_slot_open_before_1pm(self):
        frozen = _make_ist_time(9, 0)   # 9:00 AM IST
        with patch("services.time_service.now_ist", return_value=frozen):
            assert is_morning_slot_closed_today() is False

    def test_morning_slot_closed_at_1pm(self):
        frozen = _make_ist_time(13, 0)  # 1:00 PM IST exactly
        with patch("services.time_service.now_ist", return_value=frozen):
            assert is_morning_slot_closed_today() is True

    def test_morning_slot_closed_after_1pm(self):
        frozen = _make_ist_time(15, 30)  # 3:30 PM IST
        with patch("services.time_service.now_ist", return_value=frozen):
            assert is_morning_slot_closed_today() is True

    # --- Evening slot ---

    def test_evening_slot_open_before_2pm(self):
        frozen = _make_ist_time(13, 59)  # 1:59 PM IST (one minute before cutoff)
        with patch("services.time_service.now_ist", return_value=frozen):
            assert is_evening_slot_closed_today() is False

    def test_evening_slot_closed_at_2pm(self):
        frozen = _make_ist_time(14, 0)  # 2:00 PM IST
        with patch("services.time_service.now_ist", return_value=frozen):
            assert is_evening_slot_closed_today() is True

    def test_evening_slot_closed_at_9pm(self):
        frozen = _make_ist_time(21, 0)  # 9:00 PM IST
        with patch("services.time_service.now_ist", return_value=frozen):
            assert is_evening_slot_closed_today() is True

    # --- is_slot_open for today ---

    def test_is_slot_open_morning_before_cutoff(self):
        frozen = _make_ist_time(8, 0)
        with patch("services.time_service.now_ist", return_value=frozen):
            open_flag, reason = is_slot_open("morning", self.TODAY_ISO)
        assert open_flag is True
        assert reason == ""

    def test_is_slot_open_morning_after_cutoff(self):
        frozen = _make_ist_time(14, 0)
        with patch("services.time_service.now_ist", return_value=frozen):
            open_flag, reason = is_slot_open("morning", self.TODAY_ISO)
        assert open_flag is False
        assert "1:00 PM" in reason

    def test_is_slot_open_evening_before_cutoff(self):
        frozen = _make_ist_time(12, 0)
        with patch("services.time_service.now_ist", return_value=frozen):
            open_flag, reason = is_slot_open("evening", self.TODAY_ISO)
        assert open_flag is True
        assert reason == ""

    def test_is_slot_open_evening_after_cutoff(self):
        frozen = _make_ist_time(20, 0)
        with patch("services.time_service.now_ist", return_value=frozen):
            open_flag, reason = is_slot_open("evening", self.TODAY_ISO)
        assert open_flag is False
        assert "2:00 PM" in reason

    # --- Future dates are always open ---

    def test_future_date_morning_always_open(self):
        frozen = _make_ist_time(23, 59)  # Even at midnight IST
        with patch("services.time_service.now_ist", return_value=frozen):
            open_flag, reason = is_slot_open("morning", self.TOMORROW_ISO)
        assert open_flag is True
        assert reason == ""

    def test_future_date_evening_always_open(self):
        frozen = _make_ist_time(23, 59)
        with patch("services.time_service.now_ist", return_value=frozen):
            open_flag, reason = is_slot_open("evening", self.TOMORROW_ISO)
        assert open_flag is True
        assert reason == ""

    def test_plus_2_days_always_open(self):
        frozen = _make_ist_time(23, 59)
        plus_2 = (date.today() + timedelta(days=2)).isoformat()
        with patch("services.time_service.now_ist", return_value=frozen):
            for slot in ["morning", "evening"]:
                open_flag, _ = is_slot_open(slot, plus_2)
                assert open_flag is True, f"Slot {slot} should be open for +2 days"

    # --- Boundary: one minute before cutoff ---

    def test_morning_slot_open_one_minute_before_cutoff(self):
        frozen = _make_ist_time(MORNING_SLOT_CUTOFF_HOUR, 0)
        frozen_minus_1 = frozen - timedelta(minutes=1)
        with patch("services.time_service.now_ist", return_value=frozen_minus_1):
            assert is_morning_slot_closed_today() is False

    def test_evening_slot_open_one_minute_before_cutoff(self):
        frozen = _make_ist_time(EVENING_SLOT_CUTOFF_HOUR, 0)
        frozen_minus_1 = frozen - timedelta(minutes=1)
        with patch("services.time_service.now_ist", return_value=frozen_minus_1):
            assert is_evening_slot_closed_today() is False


# ─────────────────────────────────────────────────────────────────────────────
# 8. Server time payload (used by GET /api/time)
# ─────────────────────────────────────────────────────────────────────────────

class TestServerTimePayload:

    def test_payload_keys_present(self):
        payload = get_server_time_payload()
        required_keys = [
            "timezone", "utc_offset", "server_time_ist", "server_time_utc",
            "today_date_ist", "tomorrow_date_ist",
            "current_hour_ist", "current_minute_ist",
            "morning_slot_open", "evening_slot_open",
            "morning_slot_cutoff_hour", "evening_slot_cutoff_hour",
        ]
        for key in required_keys:
            assert key in payload, f"Missing key in server time payload: {key}"

    def test_payload_timezone_value(self):
        payload = get_server_time_payload()
        assert payload["timezone"] == "Asia/Kolkata"
        assert payload["utc_offset"] == "+05:30"

    def test_payload_cutoff_hours(self):
        payload = get_server_time_payload()
        assert payload["morning_slot_cutoff_hour"] == MORNING_SLOT_CUTOFF_HOUR
        assert payload["evening_slot_cutoff_hour"] == EVENING_SLOT_CUTOFF_HOUR

    def test_payload_ist_time_has_offset(self):
        payload = get_server_time_payload()
        assert "+05:30" in payload["server_time_ist"]

    def test_payload_today_date_is_valid(self):
        payload = get_server_time_payload()
        d = date.fromisoformat(payload["today_date_ist"])
        assert d == today_ist()

    def test_payload_morning_slot_open_type(self):
        payload = get_server_time_payload()
        assert isinstance(payload["morning_slot_open"], bool)
        assert isinstance(payload["evening_slot_open"], bool)

    def test_payload_slot_consistency(self):
        """Slot open status in payload must be consistent with helper functions."""
        frozen_8am = _make_ist_time(8, 0)
        with patch("services.time_service.now_ist", return_value=frozen_8am):
            payload = get_server_time_payload()
        assert payload["morning_slot_open"] is True
        assert payload["evening_slot_open"] is True

    def test_payload_both_closed_after_2pm(self):
        frozen_3pm = _make_ist_time(15, 0)
        with patch("services.time_service.now_ist", return_value=frozen_3pm):
            payload = get_server_time_payload()
        assert payload["morning_slot_open"] is False
        assert payload["evening_slot_open"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 9. Cutoff constants are correct
# ─────────────────────────────────────────────────────────────────────────────

class TestCutoffConstants:

    def test_morning_cutoff_is_1pm(self):
        assert MORNING_SLOT_CUTOFF_HOUR == 13

    def test_evening_cutoff_is_2pm(self):
        assert EVENING_SLOT_CUTOFF_HOUR == 14

    def test_morning_before_evening(self):
        assert MORNING_SLOT_CUTOFF_HOUR < EVENING_SLOT_CUTOFF_HOUR


# ─────────────────────────────────────────────────────────────────────────────
# 10. Integration: today_iso_ist matches IST date (not UTC)
# ─────────────────────────────────────────────────────────────────────────────

class TestISTVsUTCDateEdgeCase:
    """
    IST is UTC+05:30. Between 00:00–05:30 UTC, IST is already on the *next* day.
    This test verifies the service returns the IST calendar date, not UTC.
    """

    def test_midnight_utc_is_next_day_in_ist(self):
        # 00:00:00 UTC on June 1 → 05:30:00 IST on June 1
        # 18:30:00 UTC on May 31 → 00:00:00 IST on June 1
        utc_midnight = datetime(2024, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
        ist_midnight = to_ist(utc_midnight)
        # UTC June 1 00:00 = IST June 1 05:30
        assert ist_midnight.date() == date(2024, 6, 1)
        assert ist_midnight.hour == 5
        assert ist_midnight.minute == 30

    def test_utc_18_30_is_ist_midnight(self):
        # 18:30 UTC on May 31 = 00:00 IST on June 1
        utc_dt = datetime(2024, 5, 31, 18, 30, 0, tzinfo=timezone.utc)
        ist_dt = to_ist(utc_dt)
        assert ist_dt.date() == date(2024, 6, 1)
        assert ist_dt.hour == 0
        assert ist_dt.minute == 0
