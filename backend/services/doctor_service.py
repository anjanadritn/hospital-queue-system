from datetime import datetime, timezone
from typing import Optional, List, Tuple
from database.mongodb import get_db, serialize_doc, serialize_docs

# Enriched Practo-grade Doctors metadata across 10 Departments
DEFAULT_DOCTORS = [
    {
        "doctor_id": "D001",
        "name": "Dr. Ananya Sharma",
        "qualifications": "MBBS, MD (Cardiology), DM (Interventional Cardiology)",
        "specialization": "Interventional Cardiology & Preventive Heart Health",
        "department": "Cardiology",
        "experience": "12 years",
        "consultation_room": "Room 204",
        "available": True,
        "avg_consultation_duration": 15,
        "working_hours": "09:00 AM - 04:00 PM",
        "rating": 4.9,
        "reviews_count": 168,
        "languages": ["English", "Kannada", "Hindi"],
        "fee": 400,
        "about": "Senior Interventional Cardiologist at Shridevi Hospital with over a decade of excellence in coronary angioplasty, hypertension management, echocardiography, and preventive cardiac wellness.",
        "services": ["Coronary Angiography", "Echocardiography (ECHO)", "Hypertension Management", "Holter Monitoring", "Pacemaker Follow-up"],
        "education": "AIIMS New Delhi (MD Cardiology), BMCRI Bangalore (MBBS)",
        "awards": "Healthcare Excellence in Cardiology 2024, Karnataka State Medical Association Fellow",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    },
    {
        "doctor_id": "D002",
        "name": "Dr. Rajesh Kumar",
        "qualifications": "MBBS, MD (General Medicine), Dip. in Diabetology",
        "specialization": "General Physician & Diabetology",
        "department": "General Medicine",
        "experience": "15 years",
        "consultation_room": "Room 101",
        "available": True,
        "avg_consultation_duration": 12,
        "working_hours": "08:30 AM - 05:00 PM",
        "rating": 4.8,
        "reviews_count": 210,
        "languages": ["English", "Kannada", "Telugu"],
        "fee": 350,
        "about": "Chief Medical Officer of OPD at Shridevi Hospital with 15+ years diagnosing complex fevers, metabolic syndromes, lifestyle disorders, and diabetic foot care.",
        "services": ["Fever & Infectious Triage", "Comprehensive Diabetes Care", "Hypertension & Lipid Clinic", "Preventive Health Checkups", "Thyroid Disorders"],
        "education": "Bangalore Medical College (MD Internal Medicine), JJM Medical College (MBBS)",
        "awards": "Best Physician Tumkur District 2023",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    },
    {
        "doctor_id": "D003",
        "name": "Dr. Sunita Patel",
        "qualifications": "MBBS, MS (Orthopedics), M.Ch (Joint Reconstruction)",
        "specialization": "Joint Replacement & Trauma",
        "department": "Orthopedics",
        "experience": "10 years",
        "consultation_room": "Room 305",
        "available": True,
        "avg_consultation_duration": 15,
        "working_hours": "10:00 AM - 03:00 PM",
        "rating": 4.9,
        "reviews_count": 142,
        "languages": ["English", "Kannada", "Hindi", "Gujarati"],
        "fee": 450,
        "about": "Pioneering Orthopedic Surgeon specializing in minimally invasive total knee and hip replacements, sports ligament reconstructions, and fracture management.",
        "services": ["Total Knee Replacement", "Hip Arthroplasty", "Arthroscopy & Sports Injury", "Fracture Fixation", "Arthritis Management"],
        "education": "KMC Manipal (MS Orthopedics), MS Ramaiah Medical College (MBBS)",
        "awards": "Indian Orthopedic Association Young Surgeon Award 2022",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    },
    {
        "doctor_id": "D004",
        "name": "Dr. Vikram Sethi",
        "qualifications": "MBBS, MD (Pediatrics), Fellowship in Neonatology",
        "specialization": "Pediatric Care & Immunization",
        "department": "Pediatrics",
        "experience": "8 years",
        "consultation_room": "Room 108",
        "available": True,
        "avg_consultation_duration": 10,
        "working_hours": "09:00 AM - 02:00 PM",
        "rating": 4.9,
        "reviews_count": 185,
        "languages": ["English", "Kannada", "Hindi"],
        "fee": 350,
        "about": "Compassionate pediatrician loved by children and parents alike. Expert in childhood infections, immunization schedules, growth tracking, and pediatric asthma.",
        "services": ["Newborn & Infant Care", "Childhood Immunizations", "Pediatric Asthma Management", "Nutritional Assessment", "Growth & Milestone Evaluation"],
        "education": "JIPMER Puducherry (MD Pediatrics), Mysore Medical College (MBBS)",
        "awards": "Distinguished Pediatrician Recognition 2024",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    },
    {
        "doctor_id": "D005",
        "name": "Dr. Meera Deshmukh",
        "qualifications": "MBBS, MD (Dermatology, Venereology & Leprosy)",
        "specialization": "Clinical Dermatology & Allergy",
        "department": "Dermatology",
        "experience": "9 years",
        "consultation_room": "Room 212",
        "available": True,
        "avg_consultation_duration": 12,
        "working_hours": "11:00 AM - 05:00 PM",
        "rating": 4.8,
        "reviews_count": 134,
        "languages": ["English", "Kannada", "Marathi"],
        "fee": 400,
        "about": "Consultant Dermatologist and Trichologist dedicated to evidence-based skincare, eczema, psoriasis, acne therapy, and dermatological allergy patch tests.",
        "services": ["Acne & Scar Treatment", "Eczema & Psoriasis Care", "Allergy Patch Testing", "Hair Fall & PRP Therapy", "Skin Biopsy & Mole Check"],
        "education": "St. John's Medical College Bangalore (MD DVL), KIMS Hubli (MBBS)",
        "awards": "IADVL Clinical Excellence Fellowship 2021",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    },
    {
        "doctor_id": "D006",
        "name": "Dr. Arvind Rao",
        "qualifications": "MBBS, MD (General Medicine), DM (Neurology)",
        "specialization": "Neurology & Epilepsy Specialist",
        "department": "Neurology",
        "experience": "14 years",
        "consultation_room": "Room 402",
        "available": True,
        "avg_consultation_duration": 20,
        "working_hours": "09:00 AM - 01:00 PM",
        "rating": 4.9,
        "reviews_count": 156,
        "languages": ["English", "Kannada", "Hindi"],
        "fee": 500,
        "about": "Senior Neurologist specializing in seizure disorders, stroke prevention, chronic migraine treatments, peripheral neuropathies, and Parkinson's disease.",
        "services": ["Epilepsy & Seizure Clinic", "Headache & Migraine Therapy", "EEG & Nerve Conduction Studies", "Stroke Care & Rehabilitation", "Neuropathy Management"],
        "education": "NIMHANS Bangalore (DM Neurology), Bangalore Medical College (MD)",
        "awards": "NIMHANS Academic Gold Medalist, Fellow Indian Academy of Neurology",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    },
    {
        "doctor_id": "D007",
        "name": "Dr. Kavita Menon",
        "qualifications": "MBBS, MS (ENT - Otorhinolaryngology), DNB",
        "specialization": "ENT & Sinus Surgery",
        "department": "ENT",
        "experience": "11 years",
        "consultation_room": "Room 115",
        "available": True,
        "avg_consultation_duration": 10,
        "working_hours": "10:00 AM - 04:00 PM",
        "rating": 4.8,
        "reviews_count": 119,
        "languages": ["English", "Kannada", "Malayalam"],
        "fee": 350,
        "about": "Renowned ENT surgeon with extensive experience in endoscopic sinus surgery, tympanoplasty, vertigo clinics, and pediatric tonsillectomy.",
        "services": ["Endoscopic Sinus Surgery", "Tympanoplasty & Ear Micro-surgery", "Vertigo & Balance Clinic", "Audiometry & Hearing Aids", "Throat & Voice Diagnostics"],
        "education": "Madras Medical College (MS ENT), Father Muller Medical College (MBBS)",
        "awards": "Association of Otolaryngologists of India Merit 2023",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    },
    {
        "doctor_id": "D008",
        "name": "Dr. Manoj Joshi",
        "qualifications": "MBBS, MD (Medicine), DM (Medical Gastroenterology)",
        "specialization": "Gastroenterology & Hepatology",
        "department": "Gastroenterology",
        "experience": "13 years",
        "consultation_room": "Room 310",
        "available": True,
        "avg_consultation_duration": 15,
        "working_hours": "09:30 AM - 03:30 PM",
        "rating": 4.9,
        "reviews_count": 128,
        "languages": ["English", "Kannada", "Hindi"],
        "fee": 450,
        "about": "Specialist in liver diseases, gastrointestinal endoscopy, colonoscopy, GERD, inflammatory bowel disease (IBD), and abdominal pains.",
        "services": ["Diagnostic Endoscopy & Colonoscopy", "Fatty Liver & Hepatitis Clinic", "GERD & Acid Reflux Therapy", "Irritable Bowel Syndrome (IBS)", "Pancreatic Disorders"],
        "education": "Christian Medical College Vellore (DM Gastro), Mysore Medical College (MBBS)",
        "awards": "ISG Gastroenterology Research Fellowship 2022",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    },
    {
        "doctor_id": "D009",
        "name": "Dr. Priya Iyer",
        "qualifications": "MBBS, MD (Pulmonary Medicine), FCCP (USA)",
        "specialization": "Pulmonology & Sleep Medicine",
        "department": "Pulmonology",
        "experience": "11 years",
        "consultation_room": "Room 201",
        "available": True,
        "avg_consultation_duration": 14,
        "working_hours": "08:00 AM - 04:00 PM",
        "rating": 4.9,
        "reviews_count": 147,
        "languages": ["English", "Kannada", "Tamil", "Hindi"],
        "fee": 400,
        "about": "Expert Pulmonologist dedicated to asthma, chronic obstructive pulmonary disease (COPD), post-COVID lung recovery, allergy management, and sleep apnea.",
        "services": ["Spirometry & Pulmonary Function Testing", "Bronchial Asthma & Allergy", "COPD & Emphysema Management", "Sleep Apnea & Polysomnography", "Interstitial Lung Disease"],
        "education": "VMMC & Safdarjung Hospital Delhi (MD Pulmonology), JSS Medical College (MBBS)",
        "awards": "American College of Chest Physicians International Fellow",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    },
    {
        "doctor_id": "D010",
        "name": "Dr. Abhijit Gupta",
        "qualifications": "MBBS, MS (Ophthalmology), FICO (UK)",
        "specialization": "Ophthalmology & Laser",
        "department": "Ophthalmology",
        "experience": "10 years",
        "consultation_room": "Room 250",
        "available": True,
        "avg_consultation_duration": 12,
        "working_hours": "10:00 AM - 05:00 PM",
        "rating": 4.8,
        "reviews_count": 160,
        "languages": ["English", "Kannada", "Hindi"],
        "fee": 350,
        "about": "Ophthalmic Surgeon specializing in modern micro-incision cataract surgery (phaco), computerized vision testing, diabetic retinopathy screening, and glaucoma control.",
        "services": ["Cataract Phacoemulsification", "Computerized Vision Examination", "Diabetic Retinopathy Screening", "Glaucoma Clinic", "Pediatric Vision Screening"],
        "education": "PGIMER Chandigarh (MS Ophthalmology), Kasturba Medical College (MBBS)",
        "awards": "All India Ophthalmological Society Young Innovator 2023",
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    }
]

# Sample reviews for doctors
DEFAULT_REVIEWS = [
    {
        "doctor_id": "D001",
        "author": "Ramesh Gowda",
        "rating": 5,
        "comment": "Dr. Ananya explained my ECG and heart tests with utmost clarity and patience. The live queue saved me 2 hours in waiting.",
        "date": "2026-02-14",
        "verified": True
    },
    {
        "doctor_id": "D001",
        "author": "Shwetha M.",
        "rating": 5,
        "comment": "Top cardiologist in Tumkur! Very warm, methodical, and didn't prescribe unnecessary pills.",
        "date": "2026-02-02",
        "verified": True
    },
    {
        "doctor_id": "D002",
        "author": "Suresh Babu",
        "rating": 5,
        "comment": "Dr. Rajesh adjusted my diabetes medication and within two weeks my fasting sugars are stable. Highly recommended!",
        "date": "2026-02-10",
        "verified": True
    },
    {
        "doctor_id": "D003",
        "author": "Lakshmi Devi",
        "rating": 5,
        "comment": "My mother underwent knee consultation with Dr. Sunita. She is walking comfortably now without pain.",
        "date": "2026-01-25",
        "verified": True
    },
    {
        "doctor_id": "D004",
        "author": "Kavitha R.",
        "rating": 5,
        "comment": "Dr. Vikram handled my toddler's vaccination so gently that he didn't even cry! Great pediatric care at Shridevi Hospital.",
        "date": "2026-02-18",
        "verified": True
    }
]

def get_all_doctors(department_filter: Optional[str] = None) -> List[dict]:
    try:
        db = get_db()
        query = {"available": True}
        if department_filter:
            query["department"] = {"$regex": f"^{department_filter}$", "$options": "i"}
        docs = list(db.doctors.find(query))
        if docs:
            return serialize_docs(docs)
    except Exception:
        pass

    if department_filter:
        filtered = [d for d in DEFAULT_DOCTORS if d["department"].lower() == department_filter.lower()]
        return filtered
    return DEFAULT_DOCTORS

def get_doctor_by_id(doctor_id: str) -> Optional[dict]:
    try:
        db = get_db()
        doc = db.doctors.find_one({"doctor_id": doctor_id})
        if doc:
            return serialize_doc(doc)
    except Exception:
        pass

    for d in DEFAULT_DOCTORS:
        if d["doctor_id"] == doctor_id:
            return d
    return None

def get_doctor_reviews(doctor_id: str) -> List[dict]:
    try:
        db = get_db()
        revs = list(db.doctor_reviews.find({"doctor_id": doctor_id}).sort([("created_at", -1)]))
        if revs:
            return serialize_docs(revs)
    except Exception:
        pass

    matched = [r for r in DEFAULT_REVIEWS if r["doctor_id"] == doctor_id]
    if not matched:
        matched = [
            {
                "doctor_id": doctor_id,
                "author": "Patient from Tumkur",
                "rating": 5,
                "comment": "Excellent consultation experience at Shridevi Hospital OPD. Very knowledgeable and thorough specialist.",
                "date": "2026-02-10",
                "verified": True
            }
        ]
    return matched

def add_doctor_review(doctor_id: str, data: dict) -> Tuple[Optional[dict], Optional[str]]:
    author = data.get("author") or "Anonymous Patient"
    rating = int(data.get("rating", 5))
    comment = data.get("comment", "").strip()

    if not comment:
        return None, "Review comment is required"

    review_doc = {
        "doctor_id": doctor_id,
        "author": author,
        "rating": max(1, min(5, rating)),
        "comment": comment,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "verified": True
    }

    try:
        db = get_db()
        db.doctor_reviews.insert_one(review_doc)
        return serialize_doc(review_doc), None
    except Exception:
        DEFAULT_REVIEWS.insert(0, review_doc)
        return review_doc, None

def add_doctor(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    doctor_id = data.get("doctor_id") or f"D{len(DEFAULT_DOCTORS) + 1:03d}"
    name = data.get("name")
    department = data.get("department")

    if not name or not department:
        return None, "name and department are required"

    doc = {
        "doctor_id": doctor_id,
        "name": name,
        "qualifications": data.get("qualifications", "MBBS, MD"),
        "specialization": data.get("specialization", "Specialist"),
        "department": department,
        "experience": data.get("experience", "5 years"),
        "consultation_room": data.get("consultation_room", "Room 101"),
        "available": data.get("available", True),
        "avg_consultation_duration": data.get("avg_consultation_duration", 12),
        "working_hours": data.get("working_hours", "09:00 AM - 05:00 PM"),
        "rating": float(data.get("rating", 4.8)),
        "reviews_count": int(data.get("reviews_count", 25)),
        "languages": data.get("languages", ["English", "Kannada"]),
        "fee": int(data.get("fee", 400)),
        "about": data.get("about", f"Specialist physician in {department} at Shridevi Hospital Campus."),
        "services": data.get("services", ["Clinical Consultation", "Diagnosis & Treatment"]),
        "education": data.get("education", "Medical College"),
        "awards": data.get("awards", "Clinical Recognition"),
        "hospital_affiliation": "Shridevi Hospital & Research Hospital, Sira Road, Tumkur"
    }

    try:
        db = get_db()
        db.doctors.insert_one(doc)
        return serialize_doc(doc), None
    except Exception:
        DEFAULT_DOCTORS.append(doc)
        return doc, None
