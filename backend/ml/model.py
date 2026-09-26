import logging
import os
import pickle
from typing import List, Optional, Any, Union
from datetime import datetime

try:
    import pandas as pd
except ImportError:
    pd = None

logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL_PATH = os.path.join(CURRENT_DIR, "models", "wait_time_model.pkl")

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

class RandomForestWaitTimePredictor:
    """
    Random Forest Regression Engine for Predicting Hospital Wait Times.
    Loads a pre-trained scikit-learn Pipeline from backend/ml/models/wait_time_model.pkl.
    Accepts the 7 features from dataset.csv:
      - doctor_id (str)
      - department (str)
      - doctor_avg_consult_minutes (float/int)
      - day_of_week (str)
      - hour_of_day (int)
      - queue_length_ahead (int)
      - patient_type (str: 'normal' or 'emergency')
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.model_path = model_path or DEFAULT_MODEL_PATH
        self._load_trained_model()

    def _load_trained_model(self):
        """Load pre-trained Random Forest Pipeline from pickle file"""
        try:
            if os.path.exists(self.model_path):
                with open(self.model_path, "rb") as f:
                    self.model = pickle.load(f)
                logger.info(f"✅ Loaded trained Random Forest pipeline from {self.model_path}")
            else:
                logger.warning(f"⚠️  Trained model not found at {self.model_path}")
                logger.info("   Please run: python backend/ml/train_model.py")
                self.model = None
        except Exception as e:
            logger.error(f"❌ Error loading trained model pipeline: {e}")
            self.model = None

    def predict_wait_time(
        self,
        doctor_id: str,
        department: str,
        doctor_avg_consult_minutes: Union[int, float],
        day_of_week: str,
        hour_of_day: int,
        queue_length_ahead: int,
        patient_type: str = "normal",
    ) -> float:
        """
        Predict total wait time in minutes using the 7 dataset features.

        Args:
            doctor_id: Doctor identifier (e.g. 'DOC1'..'DOC6')
            department: Hospital department name (e.g. 'Cardiology')
            doctor_avg_consult_minutes: Doctor's average consultation duration in minutes
            day_of_week: Day of week ('Monday'..'Sunday')
            hour_of_day: Hour of the day (e.g. 9..19)
            queue_length_ahead: Number of patients waiting ahead (0..N)
            patient_type: 'normal' or 'emergency'

        Returns:
            Predicted wait time in minutes (float >= 1.0)
        """
        norm_patient_type = "emergency" if str(patient_type).strip().lower() == "emergency" else "normal"
        clean_day = str(day_of_week).strip().capitalize()
        if clean_day not in DAYS_OF_WEEK:
            clean_day = datetime.now().strftime("%A")

        if self.model is not None and pd is not None:
            try:
                features_df = pd.DataFrame([
                    {
                        "doctor_id": str(doctor_id).strip(),
                        "department": str(department).strip(),
                        "doctor_avg_consult_minutes": float(doctor_avg_consult_minutes),
                        "day_of_week": clean_day,
                        "hour_of_day": int(hour_of_day),
                        "queue_length_ahead": max(0, int(queue_length_ahead)),
                        "patient_type": norm_patient_type,
                    }
                ])
                pred = self.model.predict(features_df)
                return max(1.0, round(float(pred[0]), 2))
            except Exception as e:
                logger.error(f"Error in model prediction: {e}")

        # Safe fallback based on dataset simulation formulas
        return self._fallback_wait_time(
            doctor_avg_consult_minutes=doctor_avg_consult_minutes,
            queue_length_ahead=queue_length_ahead,
            hour_of_day=hour_of_day,
            day_of_week=clean_day,
            patient_type=norm_patient_type,
        )

    def predict(
        self,
        doctor_id: str,
        department: str,
        doctor_avg_consult_minutes: Union[int, float],
        day_of_week: str,
        hour_of_day: int,
        queue_length_ahead: int,
        patient_type: str = "normal",
    ) -> float:
        """Alias for predict_wait_time accepting the 7 dataset features."""
        return self.predict_wait_time(
            doctor_id=doctor_id,
            department=department,
            doctor_avg_consult_minutes=doctor_avg_consult_minutes,
            day_of_week=day_of_week,
            hour_of_day=hour_of_day,
            queue_length_ahead=queue_length_ahead,
            patient_type=patient_type,
        )

    def _fallback_wait_time(
        self,
        doctor_avg_consult_minutes: float,
        queue_length_ahead: int,
        hour_of_day: int,
        day_of_week: str,
        patient_type: str,
    ) -> float:
        """Deterministic rule-based fallback if ML pipeline is unavailable"""
        if patient_type == "emergency":
            return 5.0

        if 9 <= hour_of_day <= 11:
            h_mult = 1.4
        elif 12 <= hour_of_day <= 14:
            h_mult = 0.8
        elif 15 <= hour_of_day <= 18:
            h_mult = 1.3
        else:
            h_mult = 0.9

        if day_of_week == "Monday":
            d_mult = 1.3
        elif day_of_week in ["Saturday", "Sunday"]:
            d_mult = 0.7
        else:
            d_mult = 1.0

        base = float(doctor_avg_consult_minutes) * (int(queue_length_ahead) + 1) * h_mult * d_mult
        return max(1.0, round(base, 2))

    def predict_duration(
        self,
        symptoms: Optional[List[str]] = None,
        department: str = "General Medicine",
        doctor_id: str = "DOC2",
        priority: str = "normal",
        queue_position: int = 1,
        doctor_avg_duration: int = 12,
        time_of_day: Optional[int] = None,
        day_of_week: Optional[Any] = None,
        num_active_patients: int = 5,
    ) -> int:
        """
        Backward-compatible consultation duration prediction for existing services.
        Maps inputs into the 7-feature model and bounds output to [5, 45] minutes.
        """
        hour = time_of_day if time_of_day is not None else datetime.now().hour
        if day_of_week is None:
            day_str = datetime.now().strftime("%A")
        elif isinstance(day_of_week, int) and 0 <= day_of_week < len(DAYS_OF_WEEK):
            day_str = DAYS_OF_WEEK[day_of_week]
        else:
            day_str = str(day_of_week)

        # Map doctor ID if legacy format like D001
        doc_id = "DOC2" if doctor_id in ["D001", "DOC2"] else doctor_id

        # Estimate single-patient consultation duration (queue_length_ahead=0)
        est_wait = self.predict_wait_time(
            doctor_id=doc_id,
            department=department,
            doctor_avg_consult_minutes=doctor_avg_duration,
            day_of_week=day_str,
            hour_of_day=hour,
            queue_length_ahead=0,
            patient_type=priority,
        )

        # Add symptom complexity adjustment if symptoms provided
        symptom_adj = max(0, len(symptoms) - 1) * 0.5 if symptoms else 0
        final_duration = int(round(est_wait + symptom_adj))
        return min(45, max(5, final_duration))


# Global singleton instance
_rf_predictor = RandomForestWaitTimePredictor()
RandomForestConsultationDurationPredictor = RandomForestWaitTimePredictor


def predict_wait_time(
    doctor_id: str,
    department: str,
    doctor_avg_consult_minutes: Union[int, float],
    day_of_week: str,
    hour_of_day: int,
    queue_length_ahead: int,
    patient_type: str = "normal",
) -> float:
    """Predict total wait time in minutes using the 7 dataset features."""
    return _rf_predictor.predict_wait_time(
        doctor_id=doctor_id,
        department=department,
        doctor_avg_consult_minutes=doctor_avg_consult_minutes,
        day_of_week=day_of_week,
        hour_of_day=hour_of_day,
        queue_length_ahead=queue_length_ahead,
        patient_type=patient_type,
    )


def predict_consultation_duration(
    symptoms: List[str],
    department: str,
    doctor_id: str,
    priority: str,
    queue_position: int = 1,
) -> int:
    """Wrapper for legacy model duration prediction"""
    return _rf_predictor.predict_duration(
        symptoms=symptoms,
        department=department,
        doctor_id=doctor_id,
        priority=priority,
        queue_position=queue_position,
    )

