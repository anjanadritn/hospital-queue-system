import os
import logging
from typing import List, Optional, Tuple
from ml.model import predict_consultation_duration, _rf_predictor

logger = logging.getLogger(__name__)

def get_prediction_provider() -> str:
    return os.getenv("PREDICTION_PROVIDER", "model").lower()

def predict_consultation_duration_service(
    symptoms: List[str],
    department: str,
    priority: str = "normal",
    queue_position: int = 1
) -> int:
    """
    Prediction Service Integration Layer:
    Passes exact features required by Random Forest model:
    symptoms (List[str]), department (str), priority (str), queue_position (int).
    Does NOT use hour_of_day or day_of_week.
    """
    provider = get_prediction_provider()
    
    if provider == "mock":
        # MockPredictionProvider for development-only testing
        symptom_count = len(symptoms) if isinstance(symptoms, list) else 1
        is_emergency = 1 if str(priority).lower() == "emergency" else 0
        mock_duration = 10 + (symptom_count * 2) + (10 if is_emergency else 0)
        return min(45, max(5, mock_duration))

    try:
        # Real Random Forest model execution from ml/model.py
        duration = _rf_predictor.predict_duration(
            symptoms=symptoms if isinstance(symptoms, list) else ["general"],
            department=department,
            doctor_id="D001",
            priority=priority,
            queue_position=queue_position
        )
        return duration
    except Exception as e:
        logger.error(f"ML prediction execution failed: {e}")
        # Safe fallback estimation if model fails
        symptom_count = len(symptoms) if isinstance(symptoms, list) else 1
        base = 10 + (symptom_count * 2)
        if str(priority).lower() == "emergency":
            base += 10
        return min(45, max(5, base))

def get_wait_time_prediction(
    symptoms: List[str] = None,
    department: str = "General Medicine",
    priority: str = "normal",
    queue_position: int = 1
) -> int:
    symptoms_list = symptoms if symptoms is not None else ["general"]
    duration = predict_consultation_duration_service(
        symptoms=symptoms_list,
        department=department,
        priority=priority,
        queue_position=queue_position
    )
    return max(5, queue_position * duration)
