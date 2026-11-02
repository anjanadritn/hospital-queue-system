#!/usr/bin/env python3
"""
Reset queue state between performance test runs in HQMS.

Requirements:
- Target database must be EXACTLY 'hospital_queue_perf'.
- Deletes ONLY:
    - db.queue
    - db.consultation_otps
    - db.otp_verifications
    - db.notifications
- Preserves users, patients, doctors, departments, and other core configuration.
"""

import os
import sys

# Ensure backend directory is in Python module search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database.mongodb import get_db

REQUIRED_DB_NAME = "hospital_queue_perf"


def verify_database_safety(db):
    if db.name != REQUIRED_DB_NAME:
        print(
            f"\n[SAFETY GUARD REJECTED] Refusing to reset database state!\n"
            f"Configured database name is '{db.name}', but reset is ONLY permitted\n"
            f"against database '{REQUIRED_DB_NAME}'.\n\n"
            f"To allow reset, set your environment variable:\n"
            f"  Linux/macOS:  export MONGO_DATABASE=\"{REQUIRED_DB_NAME}\"\n"
            f"  PowerShell:   $env:MONGO_DATABASE=\"{REQUIRED_DB_NAME}\"\n"
            f"  CMD:          set MONGO_DATABASE={REQUIRED_DB_NAME}\n",
            file=sys.stderr
        )
        sys.exit(1)


def reset_queue_state():
    db = get_db()
    verify_database_safety(db)

    print(f"[INFO] Connecting to target database: '{db.name}'")
    print("[INFO] Resetting test queue state collections...")

    # Delete only test queue, OTP, and notification collections
    queue_del = db.queue.delete_many({})
    consult_otps_del = db.consultation_otps.delete_many({})
    otp_verif_del = db.otp_verifications.delete_many({})
    notif_del = db.notifications.delete_many({})

    print(
        f"\n[SUCCESS] Queue state reset complete for database '{db.name}':\n"
        f" - Deleted {queue_del.deleted_count} queue entries (db.queue)\n"
        f" - Deleted {consult_otps_del.deleted_count} consultation OTPs (db.consultation_otps)\n"
        f" - Deleted {otp_verif_del.deleted_count} OTP verifications (db.otp_verifications)\n"
        f" - Deleted {notif_del.deleted_count} notifications (db.notifications)\n"
        f"Preserved users, patients, doctors, and departments collections."
    )


if __name__ == "__main__":
    reset_queue_state()

