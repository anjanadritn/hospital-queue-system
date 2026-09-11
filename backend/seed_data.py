"""
Seed Data Script for Smart Hospital Queue System
Creates realistic test data for development and demonstration
"""
import os
from datetime import datetime, timezone, timedelta
import random
from werkzeug.security import generate_password_hash
from database.mongodb import get_db

# Sample Doctors Data across 10 Departments
DOCTORS_DATA = [
    {
        "doctor_id": "D001",
        "name": "Dr. Ananya Sharma",
        "specialization": "Interventional Cardiology",
        "department": "Cardiology",
        "experience": "12 years",
        "consultation_room": "Room 204",
        "available": True,
        "avg_consultation_duration": 15,
        "working_hours": "09:00 AM - 04:00 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "doctor_id": "D002",
        "name": "Dr. Rajesh Kumar",
        "specialization": "General Physician & Diabetology",
        "department": "General Medicine",
        "experience": "15 years",
        "consultation_room": "Room 101",
        "available": True,
        "avg_consultation_duration": 12,
        "working_hours": "08:30 AM - 05:00 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "doctor_id": "D003",
        "name": "Dr. Sunita Patel",
        "specialization": "Joint Replacement & Trauma",
        "department": "Orthopedics",
        "experience": "10 years",
        "consultation_room": "Room 305",
        "available": True,
        "avg_consultation_duration": 15,
        "working_hours": "10:00 AM - 03:00 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "doctor_id": "D004",
        "name": "Dr. Vikram Sethi",
        "specialization": "Pediatric Care & Immunization",
        "department": "Pediatrics",
        "experience": "8 years",
        "consultation_room": "Room 108",
        "available": True,
        "avg_consultation_duration": 10,
        "working_hours": "09:00 AM - 02:00 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "doctor_id": "D005",
        "name": "Dr. Meera Deshmukh",
        "specialization": "Clinical Dermatology & Allergy",
        "department": "Dermatology",
        "experience": "9 years",
        "consultation_room": "Room 212",
        "available": True,
        "avg_consultation_duration": 12,
        "working_hours": "11:00 AM - 05:00 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "doctor_id": "D006",
        "name": "Dr. Arvind Rao",
        "specialization": "Neurology & Epilepsy Specialist",
        "department": "Neurology",
        "experience": "14 years",
        "consultation_room": "Room 402",
        "available": True,
        "avg_consultation_duration": 20,
        "working_hours": "09:00 AM - 01:00 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "doctor_id": "D007",
        "name": "Dr. Kavita Menon",
        "specialization": "ENT & Sinus Surgery",
        "department": "ENT",
        "experience": "11 years",
        "consultation_room": "Room 115",
        "available": True,
        "avg_consultation_duration": 10,
        "working_hours": "10:00 AM - 04:00 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "doctor_id": "D008",
        "name": "Dr. Manoj Joshi",
        "specialization": "Gastroenterology & Hepatology",
        "department": "Gastroenterology",
        "experience": "13 years",
        "consultation_room": "Room 310",
        "available": True,
        "avg_consultation_duration": 15,
        "working_hours": "09:30 AM - 03:30 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "doctor_id": "D009",
        "name": "Dr. Priya Iyer",
        "specialization": "Pulmonology & Sleep Medicine",
        "department": "Pulmonology",
        "experience": "11 years",
        "consultation_room": "Room 201",
        "available": True,
        "avg_consultation_duration": 14,
        "working_hours": "08:00 AM - 04:00 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "doctor_id": "D010",
        "name": "Dr. Abhijit Gupta",
        "specialization": "Ophthalmology & Laser",
        "department": "Ophthalmology",
        "experience": "10 years",
        "consultation_room": "Room 250",
        "available": True,
        "avg_consultation_duration": 12,
        "working_hours": "10:00 AM - 05:00 PM",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

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
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "patient_id": "P002",
        "user_id": "U_PAT_P002",
        "name": "Priya Sharma",
        "phone": "9876543212",
        "email": "priya@hospital.local",
        "age": 28,
        "gender": "Female",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "patient_id": "P003",
        "user_id": "U_PAT_P003",
        "name": "Rohit Verma",
        "phone": "9876543213",
        "email": "rohit@hospital.local",
        "age": 45,
        "gender": "Male",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "patient_id": "P004",
        "user_id": "U_PAT_P004",
        "name": "Sneha Gupta",
        "phone": "9876543214",
        "email": "sneha@hospital.local",
        "age": 35,
        "gender": "Female",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "patient_id": "P005",
        "user_id": "U_PAT_P005",
        "name": "Arjun Singh",
        "phone": "9876543215",
        "email": "arjun@hospital.local",
        "age": 52,
        "gender": "Male",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

# Users (combined for login)
USERS_DATA = [

        {
        "user_id": "U_ADMIN",
        "name": "System Administrator",
        "phone": "9999999999",
        "email": "admin@smarthospital.org",
        "password_hash": generate_password_hash("AdminPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("PatientPass123!"),
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
        "password_hash": generate_password_hash("PatientPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("DoctorPass123!"),
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
        "password_hash": generate_password_hash("PatientPass123!"),
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
        "password_hash": generate_password_hash("PatientPass123!"),
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
        "password_hash": generate_password_hash("PatientPass123!"),
        "role": "patient",
        "phone_verified": True,
        "status": "VERIFIED",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
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
        
        # Seed doctors
        print(f"[INFO] Seeding {len(DOCTORS_DATA)} doctors...")
        db.doctors.insert_many(DOCTORS_DATA)
        
        # Seed patients
        print(f"[INFO] Seeding {len(PATIENTS_DATA)} patients...")
        db.patients.insert_many(PATIENTS_DATA)
        
        # Seed users
        print(f"[INFO] Seeding {len(USERS_DATA)} users...")
        db.users.insert_many(USERS_DATA)

        # Seed queue entries
        print(f"[INFO] Seeding {len(QUEUE_DATA)} active queue entries...")
        db.queue.insert_many(QUEUE_DATA)
        
        # Create indexes
        print("[INFO] Creating indexes...")
        db.doctors.create_index("doctor_id", unique=True)
        db.patients.create_index("patient_id", unique=True)
        db.users.create_index("user_id", unique=True)
        db.users.create_index("phone", unique=True)
        db.queue.create_index("queue_id", unique=True)
        db.appointments.create_index("booking_id", unique=True)
        
        print("\n[SUCCESS] Database seeding complete!")
        print("\nSample Credentials for Testing:")
        print("-" * 50)
        print("ADMIN:")
        print("  Phone: 9999999999")
        print("  Password: AdminPass123!")
        print("\nDOCTOR:")
        print("  Phone: 9876543210")
        print("  Password: DoctorPass123!")
        print("\nPATIENT:")
        print("  Phone: 9876543211")
        print("  Password: PatientPass123!")
        print("-" * 50)
        
    except Exception as e:
        print(f"[ERROR] Error seeding database: {e}")
        raise

if __name__ == "__main__":
    seed_database()
