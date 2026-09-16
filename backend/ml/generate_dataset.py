r"""
ml-model/generate_dataset.py
-------------
Generates a SYNTHETIC (fake but realistic) dataset of 4,000 hospital
visit records, since real patient data isn't available to us due to
privacy regulations (as explained in our paper, Section 4.6).

The logic here matches our paper exactly, so our results stay
consistent with what we already published:
  - 6 doctors across 5 departments, each with a different average
    consultation time
  - queue length ahead of a patient follows a Poisson distribution
    (a standard way to model "random arrivals over time," e.g. how
    many people show up in a queue)
  - day-of-week and hour-of-day multipliers simulate realistic peak
    hours (Monday mornings busier than Wednesday afternoons)
  - ~7% of records are emergency patients, who wait much less
    regardless of queue length (they're inserted ahead of the line)
  - Gaussian (bell-curve) noise is added so the data isn't perfectly
    predictable — real life never is

CRITICAL DESIGN CHOICE: wait time depends MULTIPLICATIVELY (not just
added together) on queue length, day, and time effects. This is why
Random Forest beats Linear Regression in our results — linear models
can't capture multiplicative interactions well, tree-based models can.

Owner: Abhilash (Phase 3)

HOW TO RUN:
    (venv) PS ...\ml-model> python generate_dataset.py
    → creates dataset.csv in this same folder
"""

import numpy as np
import pandas as pd

# Reproducibility: using a fixed random seed means anyone on the team
# who runs this script gets the EXACT same "random" dataset. Without
# this, everyone's numbers would differ slightly every run.
np.random.seed(42)

N_RECORDS = 4000

# ---- Doctors and their departments ----
doctors = [
    {"doctor_id": "DOC1", "department": "Cardiology", "avg_consult_minutes": 15},
    {"doctor_id": "DOC2", "department": "General Medicine", "avg_consult_minutes": 10},
    {"doctor_id": "DOC3", "department": "Orthopedics", "avg_consult_minutes": 20},
    {"doctor_id": "DOC4", "department": "Pediatrics", "avg_consult_minutes": 12},
    {"doctor_id": "DOC5", "department": "Dermatology", "avg_consult_minutes": 8},
    {"doctor_id": "DOC6", "department": "General Medicine", "avg_consult_minutes": 10},
]

days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Peak-hour multiplier: mornings and evenings are busier than midday lull
def hour_multiplier(hour):
    if 9 <= hour <= 11:      # morning rush
        return 1.4
    elif 12 <= hour <= 14:   # lunch lull
        return 0.8
    elif 15 <= hour <= 18:   # afternoon/evening rush
        return 1.3
    else:
        return 0.9

# Day multiplier: Mondays are notoriously busier (weekend backlog),
# weekends are generally quieter for outpatient departments
def day_multiplier(day):
    if day == "Monday":
        return 1.3
    elif day in ["Saturday", "Sunday"]:
        return 0.7
    else:
        return 1.0


def generate_record():
    doctor = doctors[np.random.randint(0, len(doctors))]
    day = days_of_week[np.random.randint(0, 7)]
    hour = np.random.randint(9, 20)  # hospital hours: 9 AM to 8 PM

    # Queue length ahead of this patient — Poisson distribution models
    # "how many random events (patients) happen in a given window"
    queue_length_ahead = np.random.poisson(lam=4)

    # ~7% chance this is an emergency patient
    is_emergency = np.random.random() < 0.07
    patient_type = "emergency" if is_emergency else "normal"

    if is_emergency:
        # Emergency patients are inserted ahead of the queue, so their
        # wait is short and barely affected by how many people are waiting
        wait_time = np.random.normal(loc=5, scale=2)
    else:
        # MULTIPLICATIVE relationship — this is the key design choice
        # that makes Random Forest outperform Linear Regression later
        base_wait = doctor["avg_consult_minutes"] * (queue_length_ahead + 1)
        wait_time = (
            base_wait
            * hour_multiplier(hour)
            * day_multiplier(day)
        )
        # Add realistic random noise (Gaussian/bell-curve distributed)
        wait_time += np.random.normal(loc=0, scale=3)

    # Wait time can never be negative in real life
    wait_time = max(wait_time, 1)

    return {
        "doctor_id": doctor["doctor_id"],
        "department": doctor["department"],
        "doctor_avg_consult_minutes": doctor["avg_consult_minutes"],
        "day_of_week": day,
        "hour_of_day": hour,
        "queue_length_ahead": queue_length_ahead,
        "patient_type": patient_type,
        "wait_time_minutes": round(wait_time, 2),
    }


def main():
    print(f"Generating {N_RECORDS} synthetic records...")
    records = [generate_record() for _ in range(N_RECORDS)]
    df = pd.DataFrame(records)
    df.to_csv("dataset.csv", index=False)
    print(f"Done. Saved to dataset.csv")
    print(df.head())
    print(f"\nShape: {df.shape}")
    print(f"\nWait time stats:\n{df['wait_time_minutes'].describe()}")


if __name__ == "__main__":
    main()