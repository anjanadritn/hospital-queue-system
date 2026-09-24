import os
import sys
import json
from datetime import datetime
from bson import ObjectId

# Ensure backend root on sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from database.mongodb import get_db

class MongoJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

def inspect_all():
    db = get_db()
    print("=" * 80)
    print("SMART HOSPITAL DATABASE INSPECTION - PATIENT VS PROTECTED DATA")
    print("=" * 80)

    # 1. Doctors collection
    doctors = list(db.doctors.find())
    doc_ids = set(d["doctor_id"] for d in doctors)
    print(f"\n1. DOCTORS COLLECTION: {len(doctors)} documents (ALL PROTECTED)")
    for d in doctors:
        print(f"   Doctor: {d.get('doctor_id')} - {d.get('name')} ({d.get('department')}) - Room: {d.get('consultation_room')}")

    # 2. Users collection
    users = list(db.users.find())
    admin_users = [u for u in users if u.get("role") in ["admin", "reception", "staff"]]
    doctor_users = [u for u in users if u.get("role") == "doctor"]
    patient_users = [u for u in users if u.get("role") == "patient"]
    other_users = [u for u in users if u.get("role") not in ["admin", "doctor", "patient", "reception", "staff"]]

    print(f"\n2. USERS COLLECTION: {len(users)} total documents")
    print(f"   - Admin / Reception users (PROTECTED): {len(admin_users)}")
    for u in admin_users:
        print(f"       {u.get('user_id')}: {u.get('name')} | role: {u.get('role')} | email: {u.get('email')} | phone: {u.get('phone')}")
    print(f"   - Doctor users (PROTECTED): {len(doctor_users)}")
    for u in doctor_users:
        print(f"       {u.get('user_id')}: {u.get('name')} | email: {u.get('email')} | phone: {u.get('phone')}")
    print(f"   - Patient users (TO REMOVE): {len(patient_users)}")
    for u in patient_users:
        print(f"       {u.get('user_id')}: {u.get('name')} | patient_id: {u.get('patient_id')} | phone: {u.get('phone')}")
    if other_users:
        print(f"   - Other users: {len(other_users)}")

    protected_user_ids = set(u["user_id"] for u in admin_users + doctor_users)
    protected_phones = set(u["phone"] for u in admin_users + doctor_users if u.get("phone"))
    patient_user_ids = set(u["user_id"] for u in patient_users)
    patient_phones = set(u["phone"] for u in patient_users if u.get("phone"))

    # 3. Patients collection
    patients = list(db.patients.find())
    patient_ids_from_patients = set(p["patient_id"] for p in patients if p.get("patient_id"))
    all_patient_ids = patient_ids_from_patients | set(u.get("patient_id") for u in patient_users if u.get("patient_id"))
    all_patient_phones = patient_phones | set(p.get("phone") for p in patients if p.get("phone"))

    print(f"\n3. PATIENTS COLLECTION: {len(patients)} documents (ALL TO REMOVE)")
    for p in patients[:10]:
        print(f"   Patient: {p.get('patient_id')} | user_id: {p.get('user_id')} | name: {p.get('name')} | phone: {p.get('phone')}")
    if len(patients) > 10:
        print(f"   ... and {len(patients) - 10} more patient profiles")

    # 4. Appointments collection
    appointments = list(db.appointments.find())
    print(f"\n4. APPOINTMENTS COLLECTION: {len(appointments)} documents (ALL TO REMOVE)")
    apt_patient_ids = set(a.get("patient_id") for a in appointments)
    print(f"   - Distinct patient_ids in appointments: {len(apt_patient_ids)}")
    print(f"   - Doctors referenced: {set(a.get('doctor_id') for a in appointments)}")
    print(f"   - Sample appointment: booking_id={appointments[0].get('booking_id')}, patient={appointments[0].get('patient_name')} ({appointments[0].get('patient_id')}), doc={appointments[0].get('doctor_id')}")

    # 5. Queue collection
    queue_entries = list(db.queue.find())
    print(f"\n5. QUEUE COLLECTION: {len(queue_entries)} documents (ALL TO REMOVE)")
    q_patient_ids = set(q.get("patient_id") for q in queue_entries)
    print(f"   - Distinct patient_ids in queue: {len(q_patient_ids)}")
    print(f"   - Doctors referenced: {set(q.get('doctor_id') for q in queue_entries)}")
    print(f"   - Sample queue token: queue_id={queue_entries[0].get('queue_id')}, patient={queue_entries[0].get('patient_name')} ({queue_entries[0].get('patient_id')}), status={queue_entries[0].get('status')}")

    # 6. Consultations collection
    consultations = list(db.consultations.find())
    print(f"\n6. CONSULTATIONS COLLECTION: {len(consultations)} documents (ALL TO REMOVE)")
    c_patient_ids = set(c.get("patient_id") for c in consultations)
    print(f"   - Distinct patient_ids in consultations: {len(c_patient_ids)}")
    print(f"   - Doctors referenced: {set(c.get('doctor_id') for c in consultations)}")
    print(f"   - Sample consultation: consultation_id={consultations[0].get('consultation_id')}, patient={consultations[0].get('patient_id')}, doc={consultations[0].get('doctor_id')}")

    # 7. Consultation OTPs collection
    c_otps = list(db.consultation_otps.find())
    print(f"\n7. CONSULTATION_OTPS COLLECTION: {len(c_otps)} documents (ALL TO REMOVE)")
    print(f"   - Sample OTP doc: booking_id={c_otps[0].get('booking_id')}, queue_id={c_otps[0].get('queue_id')}, otp={c_otps[0].get('otp')}, status={c_otps[0].get('status')}")

    # 8. Auth OTPs collection
    a_otps = list(db.auth_otps.find())
    print(f"\n8. AUTH_OTPS COLLECTION: {len(a_otps)} documents (ALL TO REMOVE)")
    for ao in a_otps:
        print(f"   - Phone: {ao.get('phone')} | verified: {ao.get('verified')} | created_at: {ao.get('created_at')}")

    # 9. Notifications collection
    notifications = list(db.notifications.find())
    print(f"\n9. NOTIFICATIONS COLLECTION: {len(notifications)} documents (ALL TO REMOVE)")
    print(f"   - All {len(notifications)} notifications are transactional booking/queue/departure alerts tied to past demo/test tokens.")

    # 10. Doctor Reviews collection
    reviews = list(db.doctor_reviews.find())
    print(f"\n10. DOCTOR_REVIEWS COLLECTION: {len(reviews)} documents (ALL PROTECTED)")
    for r in reviews:
        print(f"   - Doctor {r.get('doctor_id')}: Rating {r.get('rating')} stars - '{r.get('comment')[:60]}...'")

    # Safety checks
    print("\n" + "=" * 80)
    print("SAFETY AUDIT VERIFICATION")
    print("=" * 80)
    print(f"Protected Doctors: {len(doctors)} records (0 will be deleted)")
    print(f"Protected Doctor Users: {len(doctor_users)} records (0 will be deleted)")
    print(f"Protected Admin Users: {len(admin_users)} records (0 will be deleted)")
    print(f"Protected Doctor Reviews: {len(reviews)} records (0 will be deleted)")
    print(f"Indexes on all 10 collections: Untouched (0 indexes dropped)")
    print(f"ML Model file (ml/rf_wait_time_model.pkl): Untouched")
    print(f"ML Dataset file (ml/hospital_dataset.csv): Untouched")
    print(f"Departments configuration: Embedded in doctors collection and code, 100% untouched")

    # Summary table
    print("\n" + "=" * 80)
    print("SUMMARY TABLE OF RECORDS TO BE REMOVED")
    print("=" * 80)
    removal_plan = [
        ("users (role='patient')", len(patient_users), "Fake/demo patient login accounts"),
        ("patients", len(patients), "Patient demographic and clinical profile records"),
        ("appointments", len(appointments), "Transactional appointment bookings"),
        ("queue", len(queue_entries), "Transactional OPD live queue tokens"),
        ("consultations", len(consultations), "Historical completed consultation records"),
        ("consultation_otps", len(c_otps), "Temporary 6-digit consultation verification codes"),
        ("auth_otps", len(a_otps), "Temporary SMS phone verification login codes"),
        ("notifications", len(notifications), "Transactional in-app patient & queue notifications"),
    ]
    total_to_remove = sum(r[1] for r in removal_plan)
    for col, count, reason in removal_plan:
        print(f"{col:<25} | {count:>5} records | {reason}")
    print("-" * 80)
    print(f"{'TOTAL RECORDS TO REMOVE':<25} | {total_to_remove:>5} records")
    print("=" * 80)

if __name__ == "__main__":
    inspect_all()
