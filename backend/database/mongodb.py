import os
import logging
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
from bson import ObjectId
from datetime import datetime
import mongomock
from config import config

logger = logging.getLogger(__name__)
_client = None

def get_db_client():
    global _client
    if _client is None:
        # 1. Try configured MONGO_URI (MongoDB Atlas Cluster0)
        try:
            client = MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            _client = client
            logger.info("✅ Connected to MongoDB Atlas Cloud Cluster0 successfully!")
        except Exception as e1:
            logger.warning(f"Could not connect to configured MONGO_URI: {e1}")
            # 2. Try local MongoDB
            try:
                client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=2000)
                client.admin.command("ping")
                _client = client
                logger.info("Connected to local MongoDB at mongodb://localhost:27017")
            except Exception as e2:
                logger.warning(f"Could not connect to local MongoDB: {e2}")
                # 3. Fallback to resilient in-memory mongomock for seamless development
                _client = mongomock.MongoClient()
                logger.info("Initialized resilient in-memory mongomock client")
    return _client

def set_db_client(client_instance):
    global _client
    _client = client_instance

def get_db():
    client = get_db_client()
    db_name = getattr(config, "MONGO_DATABASE", "hospital_queue_db")

    # Defensive validation: ensure database name never contains '.' or other invalid characters
    invalid_chars = {".", "/", "\\", " ", '"', "$", "\0"}
    if not db_name or any(c in invalid_chars for c in str(db_name)):
        try:
            default_db = client.get_default_database()
            if default_db is not None and not any(c in invalid_chars for c in default_db.name):
                return default_db
        except Exception:
            pass
        db_name = "hospital_queue_db"

    return client[db_name]

def is_db_connected():
    try:
        db = get_db()
        if isinstance(_client, mongomock.MongoClient):
            return True
        db.command("ping")
        return True
    except Exception:
        return False

def close_db_connection():
    global _client
    if _client:
        try:
            _client.close()
        except Exception:
            pass
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
            from seed_data import DOCTORS_DATA, PATIENTS_DATA, USERS_DATA, QUEUE_DATA, CONSULTATIONS_DATA
            db.doctors.insert_many(DOCTORS_DATA)
            db.patients.insert_many(PATIENTS_DATA)
            db.users.insert_many(USERS_DATA)
            db.queue.insert_many(QUEUE_DATA)
            if CONSULTATIONS_DATA:
                db.consultations.insert_many(CONSULTATIONS_DATA)
    except Exception as e:
        logger.warning(f"init_db info: {e}")
