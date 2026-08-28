from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
from bson import ObjectId
from datetime import datetime
from config import config

_client = None

def get_db_client():
    global _client
    if _client is None:
        _client = MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=200)
    return _client

def set_db_client(client_instance):
    global _client
    _client = client_instance

def get_db():
    client = get_db_client()
    return client[config.MONGO_DATABASE]

def is_db_connected():
    try:
        get_db().command("ping")
        return True
    except Exception:
        return False

def close_db_connection():
    global _client
    if _client:
        _client.close()
        _client = None

def serialize_doc(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    
    serialized = {}
    for key, value in doc.items():
        if key == "_id":
            continue
        elif isinstance(value, ObjectId):
            serialized[key] = str(value)
        elif isinstance(value, datetime):
            serialized[key] = value.isoformat()
        else:
            serialized[key] = value
    return serialized

def serialize_docs(docs):
    return [serialize_doc(d) for d in docs]

def init_db():
    try:
        db = get_db()
        if db.doctors.count_documents({}) == 0:
            db.doctors.insert_many([
                {
                    "doctor_id": "D001",
                    "name": "Dr. Ananya Sharma",
                    "department": "Cardiology",
                    "available": True,
                    "avg_consultation_duration": 15
                }
            ])
    except Exception as e:
        pass
