import os
import logging
from datetime import datetime
from services.time_service import now_ist
from typing import List, Optional, Tuple, Union, Any
from ml.model import (
    predict_wait_time,
    predict_consultation_duration,
    _rf_predictor,
    RandomForestWaitTimePredictor,
    DAYS_OF_WEEK,
)

logger = logging.getLogger(__name__)

# Mapping from system doctor IDs (e.g. D001..D006) to ML dataset doctor IDs (DOC1..DOC6)
DOCTOR_ID_MAP = {
    "D001": "DOC1",
    "D002": "DOC2",
    "D003": "DOC3",
    "D004": "DOC4",
    "D005": "DOC5",
    "D006": "DOC6",
}

# Default doctor assignment and baseline consult minutes per department from dataset simulation
DEFAULT_DEPARTMENT_DOCTORS = {
    "cardiology": ("DOC1", 15.0),
    "general medicine": ("DOC2", 10.0),
    "orthopedics": ("DOC3", 20.0),
    "pediatrics": ("DOC4", 12.0),
    "dermatology": ("DOC5", 8.0),
}

# Baseline consult duration defaults
DOCTOR_DEFAULT_AVG_MINUTES = {
    "DOC1": 15.0,
    "DOC2": 10.0,
    "DOC3": 20.0,
    "DOC4": 12.0,
    "DOC5": 8.0,
    "DOC6": 10.0,
    "D001": 15.0,
    "D002": 12.0,
    "D003": 15.0,
    "D004": 10.0,
    "D005": 12.0,
    "D006": 15.0,
}


def get_prediction_provider() -> str:
    """Return the active prediction provider (e.g. 'model' or 'mock')."""
    return os.getenv("PREDICTION_PROVIDER", "model").lower()


def _resolve_model_features(
    doctor_id: Optional[str] = None,
    department: Optional[str] = "General Medicine",
    doctor_avg_consult_minutes: Optional[Union[int, float]] = None,
    day_of_week: Optional[str] = None,
    hour_of_day: Optional[int] = None,
    queue_length_ahead: Optional[int] = None,
    queue_position: Optional[int] = 1,
    patient_type: Optional[str] = None,
    priority: Optional[str] = "normal",
) -> Tuple[str, str, float, str, int, int, str]:
    """
    Extracts, normalizes, and validates the 7 features required by the Random Forest model:
      1. doctor_id (str)
      2. department (str)
      3. doctor_avg_consult_minutes (float)
      4. day_of_week (str)
      5. hour_of_day (int)
      6. queue_length_ahead (int)
      7. patient_type (str: 'normal' or 'emergency')
    """
    now = now_ist()

    # 1. Department
    dept = str(department).strip() if department else "General Medicine"
    dept_key = dept.lower()

    # 2. Doctor ID (normalize legacy D00X to DOCX, resolve by department if unspecified)
    if doctor_id:
        doc_raw = str(doctor_id).strip()
        doc_id = DOCTOR_ID_MAP.get(doc_raw.upper(), doc_raw)
    else:
        dept_info = DEFAULT_DEPARTMENT_DOCTORS.get(dept_key)
        doc_id = dept_info[0] if dept_info else "DOC2"

    # 3. Doctor Avg Consult Minutes
    if doctor_avg_consult_minutes is not None:
        try:
            avg_consult = float(doctor_avg_consult_minutes)
        except (ValueError, TypeError):
            avg_consult = 12.0
    elif doc_id in DOCTOR_DEFAULT_AVG_MINUTES:
        avg_consult = float(DOCTOR_DEFAULT_AVG_MINUTES[doc_id])
    elif dept_key in DEFAULT_DEPARTMENT_DOCTORS:
        avg_consult = float(DEFAULT_DEPARTMENT_DOCTORS[dept_key][1])
    else:
        avg_consult = 12.0

    # 4. Day of Week
    if day_of_week and str(day_of_week).strip().capitalize() in DAYS_OF_WEEK:
        clean_day = str(day_of_week).strip().capitalize()
    else:
        clean_day = now.strftime("%A")

    # 5. Hour of Day
    if hour_of_day is not None:
        try:
            clean_hour = max(0, min(23, int(hour_of_day)))
        except (ValueError, TypeError):
            clean_hour = now.hour
    else:
        clean_hour = now.hour

    # 6. Queue Length Ahead
    if queue_length_ahead is not None:
        try:
            clean_q_ahead = max(0, int(queue_length_ahead))
        except (ValueError, TypeError):
            clean_q_ahead = 0
    elif queue_position is not None:
        try:
            clean_q_ahead = max(0, int(queue_position) - 1)
        except (ValueError, TypeError):
            clean_q_ahead = 0
    else:
        clean_q_ahead = 0

    # 7. Patient Type ('normal' or 'emergency')
    p_type = patient_type if patient_type is not None else priority
    norm_patient_type = "emergency" if str(p_type).strip().lower() == "emergency" else "normal"

    return doc_id, dept, avg_consult, clean_day, clean_hour, clean_q_ahead, norm_patient_type


def get_wait_time_prediction(
    symptoms: Optional[List[str]] = None,
    department: str = "General Medicine",
    priority: str = "normal",
    queue_position: int = 1,
    doctor_id: Optional[str] = None,
    doctor_avg_consult_minutes: Optional[Union[int, float]] = None,
    day_of_week: Optional[str] = None,
    hour_of_day: Optional[int] = None,
    queue_length_ahead: Optional[int] = None,
    patient_type: Optional[str] = None,
    **kwargs: Any,
) -> float:
    """
    Predict total wait time in minutes directly from the Random Forest Pipeline
    using the 7 required features:
      - doctor_id
      - department
      - doctor_avg_consult_minutes
      - day_of_week
      - hour_of_day
      - queue_length_ahead
      - patient_type

    Removes the legacy formula (queue_position × duration) and invokes the ML model.
    """
    provider = get_prediction_provider()
    doc_id, dept, avg_consult, day, hour, q_ahead, norm_patient_type = _resolve_model_features(
        doctor_id=doctor_id,
        department=department,
        doctor_avg_consult_minutes=doctor_avg_consult_minutes,
        day_of_week=day_of_week,
        hour_of_day=hour_of_day,
        queue_length_ahead=queue_length_ahead,
        queue_position=queue_position,
        patient_type=patient_type,
        priority=priority,
    )

    if provider == "mock":
        symptom_count = len(symptoms) if isinstance(symptoms, list) else 1
        is_emergency = 1 if norm_patient_type == "emergency" else 0
        if is_emergency:
            return 5.0
        mock_wait = max(5.0, float(avg_consult) * (q_ahead + 1) + (symptom_count * 1.5))
        return round(mock_wait, 2)

    try:
        wait_time = _rf_predictor.predict_wait_time(
            doctor_id=doc_id,
            department=dept,
            doctor_avg_consult_minutes=avg_consult,
            day_of_week=day,
            hour_of_day=hour,
            queue_length_ahead=q_ahead,
            patient_type=norm_patient_type,
        )
        return max(1.0, round(float(wait_time), 2))
    except Exception as e:
        logger.error(f"ML wait time prediction failed: {e}")
        return _rf_predictor._fallback_wait_time(
            doctor_avg_consult_minutes=avg_consult,
            queue_length_ahead=q_ahead,
            hour_of_day=hour,
            day_of_week=day,
            patient_type=norm_patient_type,
        )


# Alias for explicit wait time service calls
predict_wait_time_service = get_wait_time_prediction


def predict_consultation_duration_service(
    symptoms: Optional[List[str]] = None,
    department: str = "General Medicine",
    priority: str = "normal",
    queue_position: int = 1,
    doctor_id: Optional[str] = None,
    doctor_avg_consult_minutes: Optional[Union[int, float]] = None,
    day_of_week: Optional[str] = None,
    hour_of_day: Optional[int] = None,
    queue_length_ahead: Optional[int] = None,
    patient_type: Optional[str] = None,
    **kwargs: Any,
) -> int:
    """
    Predict single consultation duration in minutes.
    Passes features to the Random Forest model without hardcoding 'D001'.
    Estimates consultation duration with queue_length_ahead=0, symptom adjustments,
    and returns an integer bounded to [5, 45] minutes for API backward compatibility.
    """
    provider = get_prediction_provider()
    symptoms_list = symptoms if isinstance(symptoms, list) else (["general"] if symptoms is None else [str(symptoms)])
    doc_id, dept, avg_consult, day, hour, _, norm_patient_type = _resolve_model_features(
        doctor_id=doctor_id,
        department=department,
        doctor_avg_consult_minutes=doctor_avg_consult_minutes,
        day_of_week=day_of_week,
        hour_of_day=hour_of_day,
        queue_length_ahead=0,  # 0 patients ahead to isolate single consultation duration
        queue_position=queue_position,
        patient_type=patient_type,
        priority=priority,
    )

    if provider == "mock":
        symptom_count = len(symptoms_list)
        is_emergency = 1 if norm_patient_type == "emergency" else 0
        mock_duration = 10 + (symptom_count * 2) + (10 if is_emergency else 0)
        return min(45, max(5, mock_duration))

    try:
        est_duration = _rf_predictor.predict_wait_time(
            doctor_id=doc_id,
            department=dept,
            doctor_avg_consult_minutes=avg_consult,
            day_of_week=day,
            hour_of_day=hour,
            queue_length_ahead=0,
            patient_type=norm_patient_type,
        )
        symptom_adj = max(0, len(symptoms_list) - 1) * 0.5 if symptoms_list else 0
        duration = int(round(est_duration + symptom_adj))
        return min(45, max(5, duration))
    except Exception as e:
        logger.error(f"ML consultation duration prediction execution failed: {e}")
        symptom_count = len(symptoms_list)
        base = int(round(avg_consult)) + (symptom_count * 2)
        if norm_patient_type == "emergency":
            base += 10
        return min(45, max(5, base))
