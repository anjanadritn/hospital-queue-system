from typing import List
from ml.model import predict_consultation_duration

def get_predicted_consultation_duration(symptoms: List[str], department: str, doctor_id: str = "D001", priority: str = "normal") -> int:
    return predict_consultation_duration(symptoms, department, doctor_id, priority)
