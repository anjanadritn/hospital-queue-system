import logging
from pymongo import ASCENDING, DESCENDING

logger = logging.getLogger(__name__)

def create_indexes(db):
    """
    Creates indexes across MongoDB collections for query efficiency.
    Collections:
    - users (email, user_id)
    - patients (patient_id, user_id)
    - doctors (doctor_id, department_id)
    - departments (department_id, name)
    - doctor_schedules (schedule_id, doctor_id, date)
    - appointments (appointment_id, patient_id, doctor_id, appointment_date)
    - queue_entries (queue_id, patient_id, doctor_id, department_id, status, priority, joined_at)
    - notifications (patient_id, queue_id, status)
    """
    try:
        # 1. users
        db.users.create_index("email", unique=True, sparse=True)
        db.users.create_index("user_id", unique=True, sparse=True)

        # 2. patients
        db.patients.create_index("patient_id", unique=True, sparse=True)
        db.patients.create_index("user_id", unique=True, sparse=True)

        # 3. doctors
        db.doctors.create_index("doctor_id", unique=True, sparse=True)
        db.doctors.create_index("department_id")

        # 4. departments
        db.departments.create_index("department_id", unique=True, sparse=True)
        db.departments.create_index("name", unique=True, sparse=True)

        # 5. doctor_schedules
        db.doctor_schedules.create_index("schedule_id", unique=True, sparse=True)
        db.doctor_schedules.create_index([("doctor_id", ASCENDING), ("date", ASCENDING)])

        # 6. appointments
        db.appointments.create_index("appointment_id", unique=True, sparse=True)
        db.appointments.create_index("patient_id")
        db.appointments.create_index([("doctor_id", ASCENDING), ("appointment_date", ASCENDING)])

        # 7. queue_entries
        db.queue_entries.create_index("queue_id", unique=True, sparse=True)
        db.queue_entries.create_index("patient_id")
        db.queue_entries.create_index("doctor_id")
        db.queue_entries.create_index("department_id")
        db.queue_entries.create_index([("status", ASCENDING), ("priority", DESCENDING), ("joined_at", ASCENDING)])

        # 8. notifications
        db.notifications.create_index("patient_id")
        db.notifications.create_index("queue_id")
        db.notifications.create_index("status")

        logger.info("Successfully ensured all MongoDB collection indexes.")
    except Exception as e:
        logger.warning(f"Note on creating indexes: {e}")
