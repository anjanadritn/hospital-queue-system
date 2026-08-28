# Smart Hospital Queue System — Official Flask + MongoDB Backend

Production-quality, standalone **Python Flask + PyMongo + MongoDB** REST API backend for the Smart Hospital Queue Management System.

---

## 🏗️ Architecture & Technology Stack
- **Backend Framework**: Python 3.x + Flask 3.1
- **API Style**: RESTful JSON APIs
- **Database**: MongoDB (`hospital_queue` database)
- **Database Driver**: PyMongo 4.6 (Singleton Client Connection Pool)
- **ML Integration**: Scikit-Learn Random Forest Regressor (`ml/model.py`)
- **Deployment Target**: AWS EC2 ready
- **CORS**: `flask-cors` enabled for Patient App and Staff Dashboard integration

> ❌ **NO FastAPI, NO PostgreSQL, NO SQLAlchemy, NO SQLite, NO JWT Authentication, NO React Frontend.**

---

## 🗄️ MongoDB Collections & Schema Definitions

### 1. `patients` Collection
```json
{
  "patient_id": "P001",
  "name": "Anjan",
  "age": 21,
  "gender": "Male",
  "phone": "9876543210"
}
```

### 2. `doctors` Collection
```json
{
  "doctor_id": "D001",
  "name": "Dr. Smith",
  "department": "Cardiology",
  "available": true,
  "avg_consultation_time": 10
}
```

### 3. `queue` Collection
```json
{
  "queue_id": "Q001",
  "patient_id": "P001",
  "doctor_id": "D001",
  "department": "Cardiology",
  "priority": "normal",
  "position": 1,
  "status": "waiting",
  "joined_at": "2026-08-13T17:14:00+00:00",
  "predicted_wait_time": 15
}
```

---

## 📡 REST API Specifications

| Endpoint | Method | Description | Request Body Example |
| :--- | :--- | :--- | :--- |
| `GET /health` | `GET` | Health check & MongoDB ping | None |
| `GET /doctors` | `GET` | Retrieve available doctors list | None |
| `POST /queue/join` | `POST` | Patient joins queue & calculates ML wait time | `{"patient_id": "P001", "doctor_id": "D001", "department": "Cardiology", "priority": "normal"}` |
| `GET /queue/status/<queue_id>` | `GET` | Get live queue status & position | None |
| `GET /queue/all` | `GET` | Staff dashboard queue list (sorted by priority & position) | None |
| `POST /queue/emergency` | `POST` | **Emergency Escalation**: Escalates priority to emergency & reorders queue positions | `{"queue_id": "Q001"}` |
| `POST /predict` | `POST` | Random Forest ML wait-time prediction | `{"department": "Cardiology", "current_queue_length": 4, "hour_of_day": 10, "day_of_week": 2}` |

---

## 🚀 Quick Local Setup Instructions

### 1. Prerequisites
- Python 3.10+
- MongoDB (Running locally on `mongodb://localhost:27017` or MongoDB Atlas URI)

### 2. Installation
```bash
git clone <repository_url>
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Environment Setup
Create a `.env` file (or copy from `.env.example`):
```env
MONGO_URI=mongodb://localhost:27017
MONGO_DATABASE=hospital_queue
PORT=5000
DEBUG=True
```

### 4. Run Flask Application
```bash
python app.py
```
The server will start on `http://localhost:5000`.

---

## 🧪 API Testing & Pytest Suite

Run the full automated Pytest suite (using `mongomock` isolated in-memory testing):
```bash
pytest tests/ -v
```

### Manual cURL Testing Examples

#### 1. List Available Doctors
```bash
curl http://localhost:5000/doctors
```

#### 2. Join Queue
```bash
curl -X POST http://localhost:5000/queue/join \
  -H "Content-Type: application/json" \
  -d '{"patient_id": "P001", "doctor_id": "D001", "department": "Cardiology", "priority": "normal"}'
```

#### 3. Check Queue Status
```bash
curl http://localhost:5000/queue/status/Q001
```

#### 4. Emergency Escalation (Moves patient to front of queue)
```bash
curl -X POST http://localhost:5000/queue/emergency \
  -H "Content-Type: application/json" \
  -d '{"queue_id": "Q001"}'
```

#### 5. ML Wait Time Prediction
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"department": "Cardiology", "current_queue_length": 4, "hour_of_day": 10, "day_of_week": 2}'
```
