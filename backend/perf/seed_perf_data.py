#!/usr/bin/env python3
"""
Seed patient users for performance testing in HQMS.

Requirements:
- Target database must be EXACTLY 'hospital_queue_perf'.
- Default 200 patient users with phones starting from 9100000001 upward.
- Role: 'patient', phone_verified: True, password: 'PatientPass123!'.
- Idempotent: safe to run multiple times without creating duplicates.
- Non-destructive: does not delete existing data.
"""

import os
import sys
import argparse
from datetime import datetime, timezone
from pymongo import UpdateOne
from werkzeug.security import generate_password_hash

# Ensure backend directory is in Python module search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database.mongodb import get_db

REQUIRED_DB_NAME = "hospital_queue_perf"
PERF_PASSWORD = "PatientPass123!"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Seed patient users for performance testing against hospital_queue_perf database."
    )
    parser.add_argument(
        "count",
        nargs="?",
        type=int,
        default=None,
        help="Number of patient users to create (default: 200)"
    )
    parser.add_argument(
        "-n",
        "--count",
        dest="count_opt",
        type=int,
        default=None,
        help="Number of patient users to create (default: 200)"
    )
    args = parser.parse_args()
    count = args.count_opt if args.count_opt is not None else (args.count if args.count is not None else 200)
    if count <= 0:
        print("[ERROR] Patient count must be a positive integer.", file=sys.stderr)
        sys.exit(1)
    return count


def verify_database_safety(db):
    if db.name != REQUIRED_DB_NAME:
        print(
            f"\n[SAFETY GUARD REJECTED] Refusing to seed database!\n"
            f"Configured database name is '{db.name}', but performance seeding is ONLY permitted\n"
            f"against database '{REQUIRED_DB_NAME}'.\n\n"
            f"To allow seeding, set your environment variable:\n"
            f"  Linux/macOS:  export MONGO_DATABASE=\"{REQUIRED_DB_NAME}\"\n"
            f"  PowerShell:   $env:MONGO_DATABASE=\"{REQUIRED_DB_NAME}\"\n"
            f"  CMD:          set MONGO_DATABASE={REQUIRED_DB_NAME}\n",
            file=sys.stderr
        )
        sys.exit(1)


def seed_patients(count: int):
    db = get_db()
    verify_database_safety(db)

    print(f"[INFO] Connecting to target database: '{db.name}'")
    print(f"[INFO] Preparing to seed {count} performance patient users...")

    # Precompute password hash once for performance (avoids repeated key derivation)
    hashed_password = generate_password_hash(PERF_PASSWORD)
    now_iso = datetime.now(timezone.utc).isoformat()

    user_ops = []
    patient_ops = []

    for i in range(1, count + 1):
        phone = str(9100000000 + i)
        patient_id = f"PERF_P{i:05d}"
        user_id = f"U_PAT_PERF_{i:05d}"
        name = f"Perf Patient {i}"
        email = f"perf_patient_{i}@hospital.local"
        age = 20 + (i % 55)
        gender = "Female" if i % 2 == 0 else "Male"
        height_cm = 150 + (i % 35)
        weight_kg = 50 + (i % 40)
        city = "Tumakuru"
        address = f"Perf Sector {i % 10 + 1}, Tumakuru"

        patient_doc = {
            "patient_id": patient_id,
            "user_id": user_id,
            "name": name,
            "phone": phone,
            "email": email,
            "age": age,
            "gender": gender,
            "height_cm": height_cm,
            "weight_kg": weight_kg,
            "city": city,
            "address": address,
            "created_at": now_iso,
            "updated_at": now_iso
        }

        user_doc = {
            "user_id": user_id,
            "patient_id": patient_id,
            "name": name,
            "phone": phone,
            "email": email,
            "password_hash": hashed_password,
            "role": "patient",
            "phone_verified": True,
            "status": "VERIFIED",
            "age": age,
            "gender": gender,
            "height_cm": height_cm,
            "weight_kg": weight_kg,
            "city": city,
            "address": address,
            "created_at": now_iso
        }

        user_ops.append(UpdateOne({"phone": phone}, {"$set": user_doc}, upsert=True))
        patient_ops.append(UpdateOne({"phone": phone}, {"$set": patient_doc}, upsert=True))

    print("[INFO] Executing upserts for users collection...")
    try:
        user_res = db.users.bulk_write(user_ops, ordered=False)
        u_upserted, u_modified, u_matched = user_res.upserted_count, user_res.modified_count, user_res.matched_count
    except TypeError:
        u_upserted, u_modified, u_matched = 0, 0, 0
        for op in user_ops:
            r = db.users.update_one(op._filter, op._doc, upsert=True)
            if r.upserted_id:
                u_upserted += 1
            else:
                u_modified += r.modified_count
                u_matched += r.matched_count

    print("[INFO] Executing upserts for patients collection...")
    try:
        patient_res = db.patients.bulk_write(patient_ops, ordered=False)
        p_upserted, p_modified, p_matched = patient_res.upserted_count, patient_res.modified_count, patient_res.matched_count
    except TypeError:
        p_upserted, p_modified, p_matched = 0, 0, 0
        for op in patient_ops:
            r = db.patients.update_one(op._filter, op._doc, upsert=True)
            if r.upserted_id:
                p_upserted += 1
            else:
                p_modified += r.modified_count
                p_matched += r.matched_count

    print(
        f"\n[SUCCESS] Seeded {count} performance patient users in '{db.name}':\n"
        f" - Users inserted: {u_upserted}, updated: {u_modified}, matched: {u_matched}\n"
        f" - Patients inserted: {p_upserted}, updated: {p_modified}, matched: {p_matched}\n"
        f" - Phone range: 9100000001 to {9100000000 + count}\n"
        f" - Role: 'patient', phone_verified: True, Password: '{PERF_PASSWORD}'"
    )


if __name__ == "__main__":
    count_to_seed = parse_args()
    seed_patients(count_to_seed)
