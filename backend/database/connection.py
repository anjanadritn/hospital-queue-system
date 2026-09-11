import logging
from typing import Tuple, Optional
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from config import config

logger = logging.getLogger(__name__)

_mongo_client: Optional[MongoClient] = None

def get_client() -> MongoClient:
    """
    Returns a singleton MongoClient instance based on configured MONGO_URI.
    Avoids creating new MongoClient connection pools on every HTTP request.
    """
    global _mongo_client
    if _mongo_client is None:
        try:
            logger.info(f"Initializing MongoClient with URI: {config.MONGO_URI}")
            _mongo_client = MongoClient(
                config.MONGO_URI,
                serverSelectionTimeoutMS=2000,
                connectTimeoutMS=2000
            )
        except Exception as e:
            logger.error(f"Failed to instantiate MongoClient: {e}")
            raise e
    return _mongo_client

def set_client(client: MongoClient):
    """Allows injection of a mock client (e.g. mongomock) during testing."""
    global _mongo_client
    _mongo_client = client

def get_db():
    """
    Returns the configured MongoDB database handle.
    """
    client = get_client()
    db_name = config.MONGO_DATABASE or "hospital_queue"
    return client[db_name]

def check_db_connection() -> Tuple[bool, str]:
    """
    Pings the MongoDB server to verify connection health.
    Returns (True, "connected") if healthy, or (False, error_details) if unavailable.
    """
    try:
        client = get_client()
        # Force a network call to verify connectivity
        client.admin.command('ping')
        return True, "connected"
    except (ServerSelectionTimeoutError, ConnectionFailure) as e:
        msg = f"MongoDB connection failure: Unable to connect to {config.MONGODB_URI}"
        logger.warning(msg)
        return False, str(e)
    except Exception as e:
        logger.error(f"Unexpected MongoDB check error: {e}")
        return False, str(e)

def close_db_connection():
    """Closes the client connection cleanly."""
    global _mongo_client
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None
