import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.mongodb import get_db

db = get_db()
db.queue.update_one(
    {"queue_id": "D001-Q010"},
    {"$set": {
        "leaving_now": False,
        "leaving_now_at": None,
        "leave_reminder_status": "NOT_REQUIRED",
        "late_arrival_reordered": False
    }}
)
db.appointments.update_one(
    {"booking_id": "B016"},
    {"$set": {
        "leaving_now": False,
        "leaving_now_at": None,
        "leave_reminder_status": "NOT_REQUIRED"
    }}
)
print("D001-Q010 reset successful")
