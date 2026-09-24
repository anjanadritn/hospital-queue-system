import os
import sys
import json
from datetime import datetime, timezone
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

def create_patient_backup():
    db = get_db()
    backup_dir = os.path.join(os.path.abspath(os.path.dirname(__file__)), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_filepath = os.path.join(backup_dir, f"patient_data_backup_{timestamp_str}.json")

    print(f"Creating full backup of patient data to {backup_filepath}...")

    # Fetch records slated for removal
    patient_users = list(db.users.find({"role": "patient"}))
    patients = list(db.patients.find())
    appointments = list(db.appointments.find())
    queue = list(db.queue.find())
    consultations = list(db.consultations.find())
    consultation_otps = list(db.consultation_otps.find())
    auth_otps = list(db.auth_otps.find())
    notifications = list(db.notifications.find())

    backup_payload = {
        "metadata": {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "description": "Pre-cleanup backup of all fake/demo patient accounts and transactional records",
            "counts": {
                "users_patient": len(patient_users),
                "patients": len(patients),
                "appointments": len(appointments),
                "queue": len(queue),
                "consultations": len(consultations),
                "consultation_otps": len(consultation_otps),
                "auth_otps": len(auth_otps),
                "notifications": len(notifications),
                "total_records": (
                    len(patient_users) + len(patients) + len(appointments) +
                    len(queue) + len(consultations) + len(consultation_otps) +
                    len(auth_otps) + len(notifications)
                )
            }
        },
        "data": {
            "users_patient": patient_users,
            "patients": patients,
            "appointments": appointments,
            "queue": queue,
            "consultations": consultations,
            "consultation_otps": consultation_otps,
            "auth_otps": auth_otps,
            "notifications": notifications
        }
    }

    with open(backup_filepath, "w", encoding="utf-8") as f:
        json.dump(backup_payload, f, cls=MongoJSONEncoder, indent=2)

    file_size_bytes = os.path.getsize(backup_filepath)
    print(f"SUCCESS: Backup written to {backup_filepath} ({file_size_bytes / 1024:.1f} KB)")
    print(f"Backup manifest: {backup_payload['metadata']['counts']}")
    return backup_filepath

if __name__ == "__main__":
    create_patient_backup()
