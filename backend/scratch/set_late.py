import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.mongodb import get_db

db = get_db()
db.queue.update_one(
    {"queue_id": "D001-Q010"},
    {"$set": {"late_arrival_reordered": True}}
)
print("Updated D001-Q010 late_arrival_reordered to True")
