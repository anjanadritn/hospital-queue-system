"""
Seed Data Script for Smart Hospital Queue System
Creates realistic test data for development and demonstration
"""
import os
from datetime import datetime, timezone, timedelta
import random
from werkzeug.security import generate_password_hash
from database.mongodb import get_db

from services.doctor_service import DEFAULT_DOCTORS, DEFAULT_REVIEWS

# Sample Doctors Data across 10 Departments (Enriched Practo-grade profiles)
DOCTORS_DATA = DEFAULT_DOCTORS
REVIEWS_DATA = DEFAULT_REVIEWS


# Sample Patients Data
PATIENTS_DATA = [
    {
        "patient_id": "P001",
        "user_id": "U_PAT_P001",
        "name": "Anjan",
        "phone": "9876543211",
        "email": "anjan@hospital.local",
        "age": 32,
        "gender": "Male",
        "height_cm": 174,
        "weight_kg": 72,
        "city": "Tumakuru",
        "address": "Sira Road, Tumakuru",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "patient_id": "P002",
        "user_id": "U_PAT_P002",
        "name": "Priya Sharma",
        "phone": "9876543212",
        "email": "priya@hospital.local",
        "age": 28,
        "gender": "Female",
        "height_cm": 162,
        "weight_kg": 56,
        "city": "Sira",
        "address": "B.H. Road, Sira",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "patient_id": "P003",
        "user_id": "U_PAT_P003",
        "name": "Rohit Verma",
        "phone": "9876543213",
        "email": "rohit@hospital.local",
        "age": 45,
        "gender": "Male",
        "height_cm": 178,
        "weight_kg": 82,
        "city": "Gubbi",
        "address": "Main Bazaar, Gubbi",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "patient_id": "P004",
        "user_id": "U_PAT_P004",
        "name": "Sneha Gupta",
        "phone": "9876543214",
        "email": "sneha@hospital.local",
        "age": 35,
        "gender": "Female",
        "height_cm": 158,
        "weight_kg": 54,
        "city": "Tiptur",
        "address": "Station Road, Tiptur",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "patient_id": "P005",
        "user_id": "U_PAT_P005",
        "name": "Arjun Singh",
        "phone": "9876543215",
        "email": "arjun@hospital.local",
        "age": 52,
        "gender": "Male",
        "height_cm": 170,
        "weight_kg": 76,
        "city": "Madhugiri",
        "address": "Fort View, Madhugiri",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
]

# Common demo credentials for testing and evaluation across all portal roles
COMMON_DEMO_PASSWORD = "PatientPass123!"

# Users (combined for login)
USERS_DATA = [

        {
        "user_id": "U_ADMIN",
        "name": "System Administrator",
        "phone": "9999999999",
        "email": "admin@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "admin",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D001",
        "doctor_id": "D001",
        "name": "Dr. Ananya Sharma",
        "phone": "9876543210",
        "email": "ananya.sharma@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_PAT_P001",
        "patient_id": "P001",
        "name": "Anjan",
        "phone": "9876543211",
        "email": "anjan@hospital.local",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "patient",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_PAT_P002",
        "patient_id": "P002",
        "name": "Priya Sharma",
        "phone": "9876543212",
        "email": "priya@hospital.local",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "patient",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
        {
        "user_id": "U_DOC_D002",
        "doctor_id": "D002",
        "name": "Dr. Rajesh Kumar",
        "phone": "9876543220",
        "email": "rajesh.kumar@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D003",
        "doctor_id": "D003",
        "name": "Dr. Sunita Patel",
        "phone": "9876543221",
        "email": "sunita.patel@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D004",
        "doctor_id": "D004",
        "name": "Dr. Vikram Sethi",
        "phone": "9876543222",
        "email": "vikram.sethi@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D005",
        "doctor_id": "D005",
        "name": "Dr. Meera Deshmukh",
        "phone": "9876543223",
        "email": "meera.deshmukh@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D006",
        "doctor_id": "D006",
        "name": "Dr. Arvind Rao",
        "phone": "9876543224",
        "email": "arvind.rao@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D007",
        "doctor_id": "D007",
        "name": "Dr. Kavita Menon",
        "phone": "9876543225",
        "email": "kavita.menon@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D008",
        "doctor_id": "D008",
        "name": "Dr. Manoj Joshi",
        "phone": "9876543226",
        "email": "manoj.joshi@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D009",
        "doctor_id": "D009",
        "name": "Dr. Priya Iyer",
        "phone": "9876543227",
        "email": "priya.iyer@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_DOC_D010",
        "doctor_id": "D010",
        "name": "Dr. Abhijit Gupta",
        "phone": "9876543228",
        "email": "abhijit.gupta@smarthospital.org",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "doctor",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_PAT_P003",
        "patient_id": "P003",
        "name": "Rohit Verma",
        "phone": "9876543213",
        "email": "rohit@hospital.local",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "patient",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_PAT_P004",
        "patient_id": "P004",
        "name": "Sneha Gupta",
        "phone": "9876543214",
        "email": "sneha@hospital.local",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "patient",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_PAT_P005",
        "patient_id": "P005",
        "name": "Arjun Singh",
        "phone": "9876543215",
        "email": "arjun@hospital.local",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "patient",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_PHARM_01",
        "name": "Suresh Pharmacy Officer",
        "phone": "9876543230",
        "email": "pharmacy@hospital.local",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "pharmacist",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "user_id": "U_LAB_01",
        "name": "Deepa Lab Technologist",
        "phone": "9876543240",
        "email": "lab@hospital.local",
        "password_hash": generate_password_hash(COMMON_DEMO_PASSWORD),
        "role": "lab_technician",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

# Sample Queue Entries
QUEUE_DATA = [
    {
        "queue_id": "Q001",
        "patient_id": "P001",
        "patient_name": "Anjan",
        "patient_phone": "9876543211",
        "doctor_id": "D001",
        "doctor_name": "Dr. Ananya Sharma",
        "department": "Cardiology",
        "room_number": "Room 204",
        "priority": "normal",
        "symptoms": ["Chest discomfort", "Shortness of breath"],
        "custom_symptoms": "Mild palpitations",
        "position": 1,
        "status": "waiting",
        "arrived_at_hospital": True,
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "predicted_wait_time": 15
    },
    {
        "queue_id": "Q002",
        "patient_id": "P002",
        "patient_name": "Priya Sharma",
        "patient_phone": "9876543212",
        "doctor_id": "D001",
        "doctor_name": "Dr. Ananya Sharma",
        "department": "Cardiology",
        "room_number": "Room 204",
        "priority": "emergency",
        "symptoms": ["Acute Chest Pain", "Sweating"],
        "custom_symptoms": "Severe pain radiating to left arm",
        "position": 2,
        "status": "waiting",
        "arrived_at_hospital": True,
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "predicted_wait_time": 10
    },
    {
        "queue_id": "Q003",
        "patient_id": "P003",
        "patient_name": "Rohit Verma",
        "patient_phone": "9876543213",
        "doctor_id": "D002",
        "doctor_name": "Dr. Rajesh Kumar",
        "department": "General Medicine",
        "room_number": "Room 101",
        "priority": "normal",
        "symptoms": ["Fever", "Headache"],
        "custom_symptoms": "High fever since 2 days",
        "position": 1,
        "status": "in_consultation",
        "arrived_at_hospital": True,
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "predicted_wait_time": 5
    }
]

# Sample Completed Clinical Consultations History (Archived Clinical EMR Records)
CONSULTATIONS_DATA = [
    {
        "consultation_id": "CON_B001",
        "queue_id": "Q_HIST_01",
        "booking_id": "B_HIST_01",
        "patient_id": "P001",
        "patient_name": "Anjan",
        "doctor_id": "D001",
        "doctor_name": "Dr. Ananya Sharma",
        "department": "Cardiology",
        "room_number": "Room 204",
        "consultation_date": (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d"),
        "consultation_time": "10:30",
        "completed_at": (datetime.now(timezone.utc) - timedelta(days=14)).isoformat(),
        "actual_duration_mins": 16,
        "status": "completed",
        "vitals_at_consultation": {
            "age": 32,
            "gender": "Male",
            "height_cm": 174,
            "weight_kg": 72,
            "bmi": 23.8,
            "city": "Tumakuru"
        },
        "patient_reported": {
            "symptoms": ["Mild Chest Discomfort", "Fatigue"],
            "custom_symptoms": "Experienced brief chest tightness after climbing stairs.",
            "duration_days": 4,
            "priority": "normal"
        },
        "doctor_assessment": {
            "diagnosis": "Atypical Musculoskeletal Chest Strain",
            "notes": "12-lead ECG normal rhythm. Blood pressure 122/78 mmHg. Normal heart sounds S1 S2. No signs of acute ischemic changes.",
            "advice": "Rest from heavy lifting for 5 days. Paracetamol 500mg SOS for strain pain. Regular brisk walking recommended."
        },
        "created_at": (datetime.now(timezone.utc) - timedelta(days=14)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    },
    {
        "consultation_id": "CON_B002",
        "queue_id": "Q_HIST_02",
        "booking_id": "B_HIST_02",
        "patient_id": "P001",
        "patient_name": "Anjan",
        "doctor_id": "D002",
        "doctor_name": "Dr. Rajesh Kumar",
        "department": "General Medicine",
        "room_number": "Room 101",
        "consultation_date": (datetime.now(timezone.utc) - timedelta(days=45)).strftime("%Y-%m-%d"),
        "consultation_time": "11:15",
        "completed_at": (datetime.now(timezone.utc) - timedelta(days=45)).isoformat(),
        "actual_duration_mins": 12,
        "status": "completed",
        "vitals_at_consultation": {
            "age": 32,
            "gender": "Male",
            "height_cm": 174,
            "weight_kg": 73,
            "bmi": 24.1,
            "city": "Tumakuru"
        },
        "patient_reported": {
            "symptoms": ["Fever", "Headache", "Body Ache"],
            "custom_symptoms": "Moderate fever with chills in the evening.",
            "duration_days": 2,
            "priority": "normal"
        },
        "doctor_assessment": {
            "diagnosis": "Acute Viral Upper Respiratory Infection",
            "notes": "Throat shows mild erythema. Lungs clear to auscultation. Temperature 100.2 F.",
            "advice": "Steam inhalation twice daily. Adequate oral hydration. Tab Paracetamol 650mg TDS for 3 days. Vitamin C supplementation."
        },
        "created_at": (datetime.now(timezone.utc) - timedelta(days=45)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()
    },
    {
        "consultation_id": "CON_B003",
        "queue_id": "Q_HIST_03",
        "booking_id": "B_HIST_03",
        "patient_id": "P002",
        "patient_name": "Priya Sharma",
        "doctor_id": "D003",
        "doctor_name": "Dr. Sunita Patel",
        "department": "Pediatrics",
        "room_number": "Room 105",
        "consultation_date": (datetime.now(timezone.utc) - timedelta(days=20)).strftime("%Y-%m-%d"),
        "consultation_time": "14:00",
        "completed_at": (datetime.now(timezone.utc) - timedelta(days=20)).isoformat(),
        "actual_duration_mins": 14,
        "status": "completed",
        "vitals_at_consultation": {
            "age": 28,
            "gender": "Female",
            "height_cm": 162,
            "weight_kg": 56,
            "bmi": 21.3,
            "city": "Sira"
        },
        "patient_reported": {
            "symptoms": ["Persistent Dry Cough", "Sore Throat"],
            "custom_symptoms": "Irritation in throat and coughing mainly at night.",
            "duration_days": 5,
            "priority": "normal"
        },
        "doctor_assessment": {
            "diagnosis": "Allergic Pharyngitis",
            "notes": "Pharyngeal mucosa mildly hyperemic. No tonsillar exudates. Chest bilaterally clear.",
            "advice": "Warm saline gargles thrice daily. Tab Levocetirizine 5mg at bedtime for 5 days. Avoid cold beverages and dusty environments."
        },
        "created_at": (datetime.now(timezone.utc) - timedelta(days=20)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()
    }
]

def seed_database():
    """Seed the database with initial data"""
    try:
        db = get_db()
        
        # Clear existing data
        print("[INFO] Clearing existing collections...")
        db.doctors.delete_many({})
        db.patients.delete_many({})
        db.users.delete_many({})
        db.queue.delete_many({})
        db.appointments.delete_many({})
        db.doctor_reviews.delete_many({})
        db.consultations.delete_many({})
        
        # Seed doctors
        print(f"[INFO] Seeding {len(DOCTORS_DATA)} doctors...")
        db.doctors.insert_many(DOCTORS_DATA)

        # Seed doctor reviews
        print(f"[INFO] Seeding {len(REVIEWS_DATA)} doctor reviews...")
        db.doctor_reviews.insert_many(REVIEWS_DATA)
        
        # Seed patients
        print(f"[INFO] Seeding {len(PATIENTS_DATA)} patients...")
        db.patients.insert_many(PATIENTS_DATA)
        
        # Seed users
        print(f"[INFO] Seeding {len(USERS_DATA)} users...")
        db.users.insert_many(USERS_DATA)

        # Seed queue entries
        print(f"[INFO] Seeding {len(QUEUE_DATA)} active queue entries...")
        db.queue.insert_many(QUEUE_DATA)

        # Seed clinical consultations history
        print(f"[INFO] Seeding {len(CONSULTATIONS_DATA)} historical consultation records...")
        db.consultations.insert_many(CONSULTATIONS_DATA)
        
        # Create indexes
        print("[INFO] Creating indexes...")
        db.doctors.create_index("doctor_id", unique=True)
        db.patients.create_index("patient_id", unique=True)
        db.patients.create_index("phone", sparse=True)
        db.users.create_index("user_id", unique=True)
        db.users.create_index("phone", unique=True)
        db.queue.create_index("queue_id", unique=True)
        db.appointments.create_index("booking_id", unique=True)
        db.consultations.create_index("consultation_id", unique=True)
        db.consultations.create_index("patient_id")
        db.consultations.create_index([("patient_id", 1), ("consultation_date", -1)])
        
        print("\n[SUCCESS] Database seeding complete!")
        print("\nSample Credentials for Testing (Common Password for All Roles):")
        print("-" * 50)
        print("COMMON DEMO PASSWORD: PatientPass123!")
        print("-" * 50)
        print("ADMIN:")
        print("  Phone: 9999999999")
        print("  Password: PatientPass123!")
        print("\nDOCTOR:")
        print("  Phone: 9876543210")
        print("  Password: PatientPass123!")
        print("\nPATIENT:")
        print("  Phone: 9876543211")
        print("  Password: PatientPass123!")
        print("\nPHARMACY:")
        print("  Phone: 9876543230")
        print("  Password: PatientPass123!")
        print("\nLABORATORY:")
        print("  Phone: 9876543240")
        print("  Password: PatientPass123!")
        print("-" * 50)
        
    except Exception as e:
        print(f"[ERROR] Error seeding database: {e}")
        raise

if __name__ == "__main__":
    seed_database()
