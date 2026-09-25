"""
SIMSRH Hospital Time Service
==============================
Centralized timezone authority for the entire hospital system.

All time-sensitive operations MUST import from this module:
  - Appointment slot cutoffs        (slot_service.py)
  - Booking date/time               (appointment_service.py)
  - Queue timing & wait-time calc   (queue_service.py)
  - Doctor consultation start/end   (consultation_service.py)
  - Arrival OTP / OTP expiry        (otp_service.py)
  - Leave/arrival/departure calc    (leave_service.py)
  - Notifications & reminders       (notification_service.py)
  - Cancellation timestamps         (queue_service.py)
  - Appointment & history stamps    (appointment_service.py, patient_service.py)

Timezone: Asia/Kolkata (IST, UTC+05:30) — the hospital's physical location.

Usage
-----
    from services.time_service import (
        HOSPITAL_TZ, now_ist, today_ist, now_utc,
        ist_isoformat, to_ist, ist_timestamp,
        format_ist, parse_iso_to_ist
    )

    ts  = now_ist()           # aware datetime in IST
    day = today_ist()         # date object in IST
    iso = ist_isoformat()     # ISO-8601 string with +05:30 offset
"""

from __future__ import annotations

import logging
from datetime import datetime, date, timedelta, timezone
from typing import Optional, Union

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Timezone constant — Asia/Kolkata (IST, UTC+05:30)
# ---------------------------------------------------------------------------
try:
    from zoneinfo import ZoneInfo                          # Python 3.9+
    HOSPITAL_TZ = ZoneInfo("Asia/Kolkata")
    _tz_source = "zoneinfo"
except ImportError:                                        # Python < 3.9 fallback
    try:
        from backports.zoneinfo import ZoneInfo            # pip install backports.zoneinfo
        HOSPITAL_TZ = ZoneInfo("Asia/Kolkata")
        _tz_source = "backports.zoneinfo"
    except ImportError:
        # Last-resort: fixed UTC+05:30 offset (no DST awareness, but IST has none)
        HOSPITAL_TZ = timezone(timedelta(hours=5, minutes=30), name="IST")
        _tz_source = "fixed-offset"

logger.debug("HospitalTimeService: HOSPITAL_TZ loaded via %s → %r", _tz_source, HOSPITAL_TZ)

# Convenience alias for UTC
UTC = timezone.utc

# Slot cutoff times (hour in 24h, IST local time)
MORNING_SLOT_CUTOFF_HOUR: int = 13   # 1:00 PM IST  — morning OPD closed
EVENING_SLOT_CUTOFF_HOUR: int = 14   # 2:00 PM IST  — afternoon OPD closed


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def now_ist() -> datetime:
    """Return the current aware datetime in Asia/Kolkata (IST)."""
    return datetime.now(HOSPITAL_TZ)


def now_utc() -> datetime:
    """Return the current aware datetime in UTC."""
    return datetime.now(UTC)


def today_ist() -> date:
    """Return today's *date* in IST (the hospital's calendar day)."""
    return now_ist().date()


def ist_isoformat(dt: Optional[datetime] = None) -> str:
    """
    Return an ISO-8601 string with IST offset (+05:30).
    If *dt* is None, uses the current IST time.
    """
    target = dt if dt is not None else now_ist()
    if target.tzinfo is None:
        target = target.replace(tzinfo=HOSPITAL_TZ)
    return target.astimezone(HOSPITAL_TZ).isoformat()


def ist_timestamp(dt: Optional[datetime] = None) -> float:
    """
    Return the POSIX timestamp (seconds since epoch) for *dt* expressed in IST.
    """
    target = dt if dt is not None else now_ist()
    if target.tzinfo is None:
        target = target.replace(tzinfo=HOSPITAL_TZ)
    return target.timestamp()


def to_ist(dt: Union[datetime, str]) -> datetime:
    """
    Convert an aware or naive datetime (or ISO string) to IST-aware datetime.
    - Naive datetimes are assumed to already be in IST.
    - UTC-aware datetimes are converted to IST.
    - ISO strings with 'Z' suffix are treated as UTC.
    """
    if isinstance(dt, str):
        dt = dt.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(dt)
    if dt.tzinfo is None:
        # Assume the naive datetime is already in IST (hospital local time)
        return dt.replace(tzinfo=HOSPITAL_TZ)
    return dt.astimezone(HOSPITAL_TZ)


def to_utc(dt: Union[datetime, str]) -> datetime:
    """Convert an aware or naive IST datetime (or ISO string) to UTC-aware datetime."""
    ist_dt = to_ist(dt)
    return ist_dt.astimezone(UTC)


def format_ist(dt: Optional[datetime] = None, fmt: str = "%Y-%m-%d %H:%M:%S IST") -> str:
    """Human-readable IST time string. Defaults to current time."""
    target = dt if dt is not None else now_ist()
    if target.tzinfo is None:
        target = target.replace(tzinfo=HOSPITAL_TZ)
    return target.astimezone(HOSPITAL_TZ).strftime(fmt)


def parse_iso_to_ist(iso_str: str) -> datetime:
    """Parse an ISO-8601 string and return an IST-aware datetime."""
    return to_ist(iso_str)


def today_iso_ist() -> str:
    """Return today's date string (YYYY-MM-DD) in IST."""
    return today_ist().isoformat()


def tomorrow_iso_ist() -> str:
    """Return tomorrow's date string (YYYY-MM-DD) in IST."""
    return (today_ist() + timedelta(days=1)).isoformat()


def days_from_now_ist(n: int) -> str:
    """Return the date *n* days from today (YYYY-MM-DD) in IST."""
    return (today_ist() + timedelta(days=n)).isoformat()


# ---------------------------------------------------------------------------
# Slot time-gate helpers (used by slot_service & appointment_service)
# ---------------------------------------------------------------------------

def is_morning_slot_closed_today() -> bool:
    """True when the IST local time is at or past 1:00 PM (morning OPD cutoff)."""
    t = now_ist()
    return (t.hour * 60 + t.minute) >= (MORNING_SLOT_CUTOFF_HOUR * 60)


def is_evening_slot_closed_today() -> bool:
    """True when the IST local time is at or past 2:00 PM (afternoon OPD cutoff)."""
    t = now_ist()
    return (t.hour * 60 + t.minute) >= (EVENING_SLOT_CUTOFF_HOUR * 60)


def is_slot_open(slot_id: str, target_date_iso: str) -> tuple[bool, str]:
    """
    Returns (is_open, reason).
    - Always open (True, '') for future dates.
    - Checks IST clock against slot cutoff for today.
    """
    today_str = today_iso_ist()
    if target_date_iso != today_str:
        return True, ""

    if slot_id == "morning":
        if is_morning_slot_closed_today():
            t_h = MORNING_SLOT_CUTOFF_HOUR
            label = f"{t_h % 12 or 12}:00 {'AM' if t_h < 12 else 'PM'} IST"
            return False, (
                f"Slot closed for today — Morning OPD cutoff is {label}. "
                "Please select a future date or the Afternoon/Evening slot."
            )
    elif slot_id == "evening":
        if is_evening_slot_closed_today():
            t_h = EVENING_SLOT_CUTOFF_HOUR
            label = f"{t_h % 12 or 12}:00 {'AM' if t_h < 12 else 'PM'} IST"
            return False, (
                f"Slot closed for today — Afternoon/Evening OPD cutoff is {label}. "
                "Please select a future date."
            )

    return True, ""


# ---------------------------------------------------------------------------
# OTP expiry helpers
# ---------------------------------------------------------------------------

def otp_expiry_ist(minutes: int = 1440) -> tuple[datetime, str, float]:
    """
    Compute OTP expiry:
      - *minutes* from now in IST (default 24 h = 1440 min)
    Returns (expires_dt_ist, expires_iso_str, expires_timestamp).
    """
    expires_dt = now_ist() + timedelta(minutes=minutes)
    return expires_dt, ist_isoformat(expires_dt), expires_dt.timestamp()


def is_otp_expired(expires_at_timestamp: float) -> bool:
    """True if the current IST time is past the given POSIX expiry timestamp."""
    return ist_timestamp() > expires_at_timestamp


# ---------------------------------------------------------------------------
# Arrival deadline helper
# ---------------------------------------------------------------------------

def arrival_deadline_ist(
    wait_minutes: int,
    safety_buffer_minutes: int = 10
) -> tuple[datetime, str]:
    """
    Compute the patient arrival deadline:
      now_ist + wait_minutes - safety_buffer_minutes
    Returns (deadline_dt, deadline_iso_str).
    """
    deadline = now_ist() + timedelta(minutes=max(0, wait_minutes - safety_buffer_minutes))
    return deadline, ist_isoformat(deadline)


# ---------------------------------------------------------------------------
# Flask route helper — exposes server IST time to the frontend
# ---------------------------------------------------------------------------

def get_server_time_payload() -> dict:
    """
    Build the JSON payload returned by GET /api/time.
    The frontend uses this to display server time and perform
    slot-availability checks consistently.
    """
    now = now_ist()
    return {
        "timezone": "Asia/Kolkata",
        "utc_offset": "+05:30",
        "server_time_ist": ist_isoformat(now),
        "server_time_utc": now_utc().isoformat(),
        "today_date_ist": today_iso_ist(),
        "tomorrow_date_ist": tomorrow_iso_ist(),
        "current_hour_ist": now.hour,
        "current_minute_ist": now.minute,
        "morning_slot_open": not is_morning_slot_closed_today(),
        "evening_slot_open": not is_evening_slot_closed_today(),
        "morning_slot_cutoff_hour": MORNING_SLOT_CUTOFF_HOUR,
        "evening_slot_cutoff_hour": EVENING_SLOT_CUTOFF_HOUR,
    }
