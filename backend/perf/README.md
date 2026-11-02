# HQMS Performance Testing Suite

This directory contains production-grade tooling and scripts to prepare, seed, run, and reset the Smart Hospital Queue Management System (HQMS) backend for high-concurrency performance and load testing.

---

## 1. Safety Guard

To prevent accidental modification or deletion of production or development data:
- `seed_perf_data.py` and `reset_queue_state.py` **REFUSE to execute** unless the active MongoDB database name is **EXACTLY** `hospital_queue_perf`.
- Real user data, doctors, departments, and consultation histories are never touched during queue state resets.

---

## 2. Environment Setup

Configure the performance testing database name before running seed or reset scripts:

### Linux / macOS / Bash:
```bash
export MONGO_DATABASE="hospital_queue_perf"
```

### Windows PowerShell:
```powershell
$env:MONGO_DATABASE="hospital_queue_perf"
```

### Windows Command Prompt (CMD):
```cmd
set MONGO_DATABASE=hospital_queue_perf
```

*(Optional)* You can also configure MongoDB connection URI if running a dedicated instance:
```bash
export MONGO_URI="mongodb://localhost:27017"
```

---

## 3. Seeding Test Patients (`seed_perf_data.py`)

Generates $N$ pre-verified patient user records with phone numbers starting from `9100000001` upward.

- **Role**: `patient`
- **Phone Verified**: `True`
- **Default Password**: `PatientPass123!`
- **Idempotent**: Safe to run repeatedly without creating duplicates.
- **Non-destructive**: Does not delete existing patient records.

### Commands:

**Seed default 200 patients:**
```bash
python backend/perf/seed_perf_data.py
```

**Seed a custom number of patients (e.g. 500 patients):**
```bash
python backend/perf/seed_perf_data.py 500
# Or using the -n flag:
python backend/perf/seed_perf_data.py -n 500
```

---

## 4. Running the Production Server (`run_gunicorn.sh`)

Launches the Flask backend with Gunicorn WSGI server in production mode (`DEBUG=false`).

### Default Execution (2 workers, port 5000, rate limiter enabled):
```bash
bash backend/perf/run_gunicorn.sh
```

### High-Concurrency / Disabled Rate Limiter:
When benchmarking raw backend throughput without throttling:
```bash
WEB_CONCURRENCY=4 RATELIMIT_ENABLED=false bash backend/perf/run_gunicorn.sh
```

### Custom Port:
```bash
PORT=8000 bash backend/perf/run_gunicorn.sh
```

---

## 5. Liveness Health Check (`GET /health/live`)

A lightweight liveness probe that verifies the Flask process is running and responding without performing any database queries.

```bash
curl http://localhost:5000/health/live
```
**Expected Response:**
```json
{"status": "ok"}
```

*(The full database health probe remains available at `GET /health`)*.

---

## 6. Resetting Queue State (`reset_queue_state.py`)

Between performance benchmark runs, reset the dynamic queue state back to a clean baseline.

Deletes **ONLY**:
- `db.queue` (active queue tokens)
- `db.consultation_otps` (arrival verification OTPs)
- `db.otp_verifications` (OTP validation state)
- `db.notifications` (generated queue notifications)

**Preserves**: `db.users`, `db.patients`, `db.doctors`, `db.departments`, and appointment master data.

### Command:
```bash
python backend/perf/reset_queue_state.py
```

---

## 7. Typical Test Run Workflow

```bash
# 1. Set environment to target perf database
export MONGO_DATABASE="hospital_queue_perf"

# 2. Seed 200 patient users
python backend/perf/seed_perf_data.py 200

# 3. Clean any existing queue tokens
python backend/perf/reset_queue_state.py

# 4. Start Gunicorn with 4 workers and rate limiter disabled
WEB_CONCURRENCY=4 RATELIMIT_ENABLED=false bash backend/perf/run_gunicorn.sh

# 5. Execute your load testing tool (e.g., Locust, k6, or JMeter)

# 6. Reset queue state before next scenario
python backend/perf/reset_queue_state.py
```

