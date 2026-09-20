import os
import sys
from datetime import datetime

# Ensure backend root on sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from database.mongodb import get_db

def execute_cleanup():
    db = get_db()
    print("=" * 80)
    print("EXECUTING TARGETED PATIENT DATA CLEANUP")
    print("=" * 80)

    # 1. Users collection (Delete only role='patient')
    res_users = db.users.delete_many({"role": "patient"})
    print(f"[DELETED] users (role='patient'): Deleted {res_users.deleted_count} records")

    # 2. Patients collection
    res_patients = db.patients.delete_many({})
    print(f"[DELETED] patients: Deleted {res_patients.deleted_count} records")

    # 3. Appointments collection
    res_apt = db.appointments.delete_many({})
    print(f"[DELETED] appointments: Deleted {res_apt.deleted_count} records")

    # 4. Queue collection
    res_queue = db.queue.delete_many({})
    print(f"[DELETED] queue: Deleted {res_queue.deleted_count} records")

    # 5. Consultations collection
    res_cons = db.consultations.delete_many({})
    print(f"[DELETED] consultations: Deleted {res_cons.deleted_count} records")

    # 6. Consultation OTPs collection
    res_cotps = db.consultation_otps.delete_many({})
    print(f"[DELETED] consultation_otps: Deleted {res_cotps.deleted_count} records")

    # 7. Auth OTPs collection
    res_aotps = db.auth_otps.delete_many({})
    print(f"[DELETED] auth_otps: Deleted {res_aotps.deleted_count} records")

    # 8. Notifications collection
    res_notif = db.notifications.delete_many({})
    print(f"[DELETED] notifications: Deleted {res_notif.deleted_count} records")

    print("\n" + "=" * 80)
    print("POST-CLEANUP DATABASE AUDIT")
    print("=" * 80)
    print(f"Doctors count (expected 10): {db.doctors.count_documents({})}")
    print(f"Doctor reviews count (expected 5): {db.doctor_reviews.count_documents({})}")
    print(f"Admin / Doctor users count (expected 11): {db.users.count_documents({})}")
    print(f"Patient users count (expected 0): {db.users.count_documents({'role': 'patient'})}")
    print(f"Patients collection count (expected 0): {db.patients.count_documents({})}")
    print(f"Appointments collection count (expected 0): {db.appointments.count_documents({})}")
    print(f"Queue collection count (expected 0): {db.queue.count_documents({})}")
    print(f"Consultations collection count (expected 0): {db.consultations.count_documents({})}")
    print(f"Consultation OTPs count (expected 0): {db.consultation_otps.count_documents({})}")
    print(f"Auth OTPs count (expected 0): {db.auth_otps.count_documents({})}")
    print(f"Notifications count (expected 0): {db.notifications.count_documents({})}")

    # Verify indexes preserved
    print("\nIndex verification:")
    for col in db.list_collection_names():
        idx_count = len(list(db[col].list_indexes()))
        print(f"  {col}: {idx_count} indexes intact")

    print("\n" + "=" * 80)
    print("CLEANUP COMPLETED SUCCESSFULLY. SYSTEM IS READY FOR FRESH PATIENT REGISTRATION.")
    print("=" * 80)

if __name__ == "__main__":
    execute_cleanup()
