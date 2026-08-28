import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    MONGO_URI = os.getenv("MONGO_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    MONGO_DATABASE = os.getenv("MONGO_DATABASE", os.getenv("MONGODB_DATABASE", "hospital_queue"))
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")

config = Config()
