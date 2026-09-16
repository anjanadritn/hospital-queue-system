"""
Random Forest ML Training Pipeline for Wait Time Prediction
Loads synthetic hospital visit records from dataset.csv, builds a complete
preprocessing and regression pipeline using OneHotEncoder and RandomForestRegressor,
and trains to predict wait_time_minutes.
"""

import os
import pickle
import logging
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.ensemble import RandomForestRegressor
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(CURRENT_DIR, "dataset.csv")
MODEL_DIR = os.path.join(CURRENT_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "wait_time_model.pkl")
METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.pkl")

CATEGORICAL_FEATURES = ["doctor_id", "department", "day_of_week", "patient_type"]
NUMERICAL_FEATURES = ["doctor_avg_consult_minutes", "hour_of_day", "queue_length_ahead"]
TARGET_COLUMN = "wait_time_minutes"

def load_data(dataset_path: str = DATASET_PATH):
    """Load dataset.csv and return feature matrix X and target y"""
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset file not found at: {dataset_path}")
    
    logger.info(f"📊 Loading dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)
    logger.info(f"   Loaded {len(df)} rows and {len(df.columns)} columns")
    
    feature_cols = CATEGORICAL_FEATURES + NUMERICAL_FEATURES
    X = df[feature_cols]
    y = df[TARGET_COLUMN]
    
    return X, y, df

def build_pipeline():
    """Build scikit-learn Pipeline with OneHotEncoder and RandomForestRegressor"""
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
            ("num", "passthrough", NUMERICAL_FEATURES),
        ]
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "regressor",
                RandomForestRegressor(
                    n_estimators=100,
                    max_depth=15,
                    min_samples_split=5,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    return pipeline

def train_model():
    """Train, evaluate, and save the complete Random Forest pipeline"""
    logger.info("=" * 70)
    logger.info("SMART HOSPITAL - RANDOM FOREST WAIT TIME PREDICTION MODEL TRAINING")
    logger.info("=" * 70)

    # 1. Load data
    X, y, df = load_data()

    # 2. Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    logger.info(f"\n✂️ Split: {len(X_train)} training, {len(X_test)} test samples")

    # 3. Build & fit pipeline
    logger.info("\n🤖 Building Pipeline and Training Random Forest model (100 trees)...")
    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    logger.info("   ✅ Model pipeline training complete!")

    # 4. Evaluate on test set
    logger.info("\n📈 Evaluating model performance on test set...")
    y_pred = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    logger.info(f"   Mean Absolute Error (MAE):      {mae:.2f} minutes")
    logger.info(f"   Root Mean Squared Error (RMSE):  {rmse:.2f} minutes")
    logger.info(f"   R² Score:                        {r2:.4f}")

    # 5. Extract feature importances from pipeline
    try:
        logger.info("\n🎯 Feature Importance (Top 5):")
        ohe = pipeline.named_steps["preprocessor"].named_transformers_["cat"]
        encoded_cat_names = list(ohe.get_feature_names_out(CATEGORICAL_FEATURES))
        all_feature_names = encoded_cat_names + NUMERICAL_FEATURES

        importances = pipeline.named_steps["regressor"].feature_importances_
        indices = np.argsort(importances)[::-1]

        for i in range(min(5, len(indices))):
            idx = indices[i]
            logger.info(f"   {i+1}. {all_feature_names[idx]}: {importances[idx]:.4f}")
    except Exception as e:
        logger.warning(f"Could not compute detailed feature importances: {e}")

    # 6. Save complete pipeline
    os.makedirs(MODEL_DIR, exist_ok=True)
    logger.info(f"\n💾 Saving complete pipeline to {MODEL_PATH}...")
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)
    logger.info("   ✅ Model pipeline saved successfully!")

    # 7. Save metadata
    metadata = {
        "trained_at": datetime.now().isoformat(),
        "samples": len(df),
        "categorical_features": CATEGORICAL_FEATURES,
        "numerical_features": NUMERICAL_FEATURES,
        "features": CATEGORICAL_FEATURES + NUMERICAL_FEATURES,
        "target": TARGET_COLUMN,
        "performance": {
            "mae": float(mae),
            "rmse": float(rmse),
            "r2": float(r2),
        },
        "test_accuracy": f"{r2*100:.1f}%",
    }

    with open(METADATA_PATH, "wb") as f:
        pickle.dump(metadata, f)
    logger.info(f"   ✅ Model metadata saved to {METADATA_PATH}")

    logger.info("\n" + "=" * 70)
    logger.info("✅ MODEL TRAINING PIPELINE COMPLETE!")
    logger.info("=" * 70)
    logger.info(f"Model Path: {MODEL_PATH}")
    logger.info(f"Performance: {r2*100:.1f}% R² Score")

    return pipeline, metadata

if __name__ == "__main__":
    train_model()
