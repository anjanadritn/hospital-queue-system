from typing import List, Dict

SYMPTOM_CATALOG = [
    {"id": "s1", "name": "Fever", "category": "GENERAL"},
    {"id": "s2", "name": "Fatigue & Weakness", "category": "GENERAL"},
    {"id": "s3", "name": "Body Pain", "category": "GENERAL"},
    {"id": "s4", "name": "Dizziness", "category": "GENERAL"},
    
    {"id": "s5", "name": "Cough", "category": "RESPIRATORY"},
    {"id": "s6", "name": "Cold & Runny Nose", "category": "RESPIRATORY"},
    {"id": "s7", "name": "Sore Throat", "category": "RESPIRATORY"},
    {"id": "s8", "name": "Breathing Difficulty", "category": "RESPIRATORY"},
    {"id": "s9", "name": "Chest Congestion", "category": "RESPIRATORY"},
    
    {"id": "s10", "name": "Stomach Pain", "category": "DIGESTIVE"},
    {"id": "s11", "name": "Nausea & Vomiting", "category": "DIGESTIVE"},
    {"id": "s12", "name": "Diarrhea", "category": "DIGESTIVE"},
    {"id": "s13", "name": "Indigestion & Heartburn", "category": "DIGESTIVE"},
    
    {"id": "s14", "name": "Headache", "category": "NEUROLOGICAL"},
    {"id": "s15", "name": "Migraine", "category": "NEUROLOGICAL"},
    {"id": "s16", "name": "Numbness or Tingling", "category": "NEUROLOGICAL"},
    
    {"id": "s17", "name": "Skin Rash", "category": "SKIN"},
    {"id": "s18", "name": "Itching & Allergy", "category": "SKIN"},
    {"id": "s19", "name": "Swelling", "category": "SKIN"},
    
    {"id": "s20", "name": "Ear Pain", "category": "ENT"},
    {"id": "s21", "name": "Sinus Congestion", "category": "ENT"},
    
    {"id": "s22", "name": "Frequent Urination", "category": "URINARY"},
    {"id": "s23", "name": "Burning Urination", "category": "URINARY"},
    
    {"id": "s24", "name": "Joint Pain", "category": "MUSCULOSKELETAL"},
    {"id": "s25", "name": "Back Pain", "category": "MUSCULOSKELETAL"},
    {"id": "s26", "name": "Muscle Cramps", "category": "MUSCULOSKELETAL"}
]

def get_all_symptoms() -> List[Dict]:
    return SYMPTOM_CATALOG

def search_symptoms(query: str) -> List[Dict]:
    if not query:
        return SYMPTOM_CATALOG
    q = query.strip().lower()
    return [s for s in SYMPTOM_CATALOG if q in s["name"].lower() or q in s["category"].lower()]
