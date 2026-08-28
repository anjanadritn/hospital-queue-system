import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

class RandomForestConsultationDurationPredictor:
    """
    Random Forest Regression Engine for Predicting Consultation Duration.
    
    CONCEPTUAL EXPLANATION:
    Random Forest combines multiple Decision Trees:
    - Tree 1 -> 14 minutes
    - Tree 2 -> 16 minutes
    - Tree 3 -> 15 minutes
    - Tree 4 -> 13 minutes
    - Tree N -> 17 minutes
    The ensemble averages the individual tree predictions to compute the final estimated consultation duration.
    
    IMPORTANT SAFETY BOUNDARY:
    This model predicts consultation duration for queue timing.
    It is NOT a medical diagnosis model and does NOT output disease diagnoses.
    """
    def __init__(self):
        self.model = None
        self._init_random_forest()

    def _init_random_forest(self):
        try:
            from sklearn.ensemble import RandomForestRegressor
            import numpy as np

            # Development/Demo Dataset: [symptom_count, department_code, is_emergency, queue_pos] -> duration_mins
            X_train = np.array([
                [1, 1, 0, 1], # Single symptom, General Medicine -> 10 mins
                [3, 1, 0, 3], # 3 symptoms, General Medicine -> 15 mins
                [4, 2, 1, 1], # 4 symptoms, Cardiology Emergency -> 25 mins
                [2, 3, 0, 2], # 2 symptoms, Orthopedics -> 15 mins
                [5, 4, 1, 2]  # 5 symptoms, Neurology Emergency -> 30 mins
            ])
            y_train = np.array([10, 15, 25, 15, 30])

            self.model = RandomForestRegressor(n_estimators=20, random_state=42)
            self.model.fit(X_train, y_train)
            logger.info("Random Forest Consultation Duration model fitted successfully.")
        except Exception as e:
            logger.warning(f"Could not fit sklearn Random Forest: {e}")
            self.model = None

    def predict_duration(
        self,
        symptoms: List[str],
        department: str = "General Medicine",
        doctor_id: str = "D001",
        priority: str = "normal",
        queue_position: int = 1
    ) -> int:
        symptom_count = max(1, len(symptoms))
        is_emergency = 1 if priority.lower() == "emergency" else 0
        dept_code = hash(department) % 5

        if self.model is not None:
            try:
                import numpy as np
                features = np.array([[symptom_count, dept_code, is_emergency, queue_position]])
                pred = self.model.predict(features)
                return max(5, int(round(float(pred[0]))))
            except Exception as e:
                logger.error(f"Error executing Random Forest prediction: {e}")

        # Fallback estimation based on symptom severity and priority
        base = 10 + (symptom_count * 2)
        if is_emergency:
            base += 10
        return min(45, max(5, base))

_rf_predictor = RandomForestConsultationDurationPredictor()

def predict_consultation_duration(symptoms: List[str], department: str, doctor_id: str, priority: str) -> int:
    return _rf_predictor.predict_duration(symptoms, department, doctor_id, priority)
