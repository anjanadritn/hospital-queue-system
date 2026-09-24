# Smart Hospital Queue & Appointment Management System

A full-stack hospital management web application designed to eliminate physical waiting room congestion, streamline patient appointments, generate sequential tokens, calculate dynamic queue positions & wait times, and empower doctors with real-time consultation desk queue controls.

---

## 🌟 Key Features

### 👤 1. Patient Portal
- **Registration & Auth**: Secure account registration with email validation, phone, DOB, and password hashing.
- **Appointment Booking**: Select department -> select available doctor -> select date & time slot -> confirm & auto-generate token number.
- **Live Queue Position Tracker**: Real-time card showing **Your Token Number**, **Currently Serving Token**, **Patients Ahead**, and **Estimated Waiting Time** (e.g. `~25 mins`).
- **In-App Notifications**: Real-time notifications when token is called, consultation begins, or appointment completes.
- **Appointment History & Cancellation**: View past and active appointments with visual status pills.

### 🩺 2. Doctor Consultation Desk
- **Queue Overview**: Live dashboard displaying waiting queue count, called patient, and completed count.
- **Consultation Desk Controls**:
  - `[CALL NEXT PATIENT]`: Selects earliest waiting patient, marks status as `CALLED`, updates patient's live tracker.
  - `[START CONSULTATION]`: Changes status from `CALLED` to `IN_CONSULTATION`.
  - `[COMPLETE CONSULTATION]`: Marks consultation as `COMPLETED` and advances queue.
  - `[SKIP PATIENT]`: Marks patient as `SKIPPED` without stalling active queue.
  - `[RECALL PATIENT]`: Restores skipped patient back to active `WAITING` queue.
- **Patient Summary**: Displays patient name, phone, age/gender, and reason notes on desk.

### 🛡️ 3. Admin Control Panel
- **System Metrics**: Overview cards for total patients, doctors, departments, today's appointments, waiting count, and completed count.
- **Department Management**: Add new hospital departments, edit details, activate or deactivate departments.
- **Doctor Roster Management**: Add new doctors, assign department/fee/specialization, toggle active status.
- **Patients Directory**: Searchable directory of all registered patients.
- **System Settings**: Configure default consultation duration (minutes) used to calculate dynamic wait estimates.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 18, Vite, Lucide-React (Medical Icons), Axios, Vanilla Modern CSS Design System |
| **Backend** | Python 3.13, FastAPI, Pydantic v2, PyJWT, Passlib (Bcrypt hashing), WebSockets |
| **Database & ORM** | SQLAlchemy 2.0 ORM, SQLite (Default zero-config), PostgreSQL support |
| **Testing** | Pytest, FastAPI TestClient, HTTPX |

---

## 🔑 Quick Demo Login Credentials

The database comes pre-seeded with realistic hospital sample data so you can immediately test all three user roles:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@hospital.com` | `admin123` | Full administrative control & analytics |
| **Doctor (Cardiology)** | `dr.smith@hospital.com` | `doctor123` | Doctor Desk with active 7-patient queue |
| **Doctor (Gen. Med)** | `dr.sarah@hospital.com` | `doctor123` | Doctor Desk with active 3-patient queue |
| **Patient (Alice)** | `patient1@gmail.com` | `patient123` | Active Token #1 in Cardiology queue |
| **Patient (Bob)** | `patient2@gmail.com` | `patient23` | Active Token #2 in Cardiology queue |

> ⚡ *The login page also includes 1-click **Quick Demo Login Pills** to sign in instantly!*

---

## 💻 How to Run the Application Locally

### Prerequisites
- Python 3.10+
- Node.js v18+ and npm

### 1. Clone & Setup Backend
```powershell
# Navigate to backend directory
cd hospital-queue-system/backend

# Install backend dependencies
pip install -r requirements.txt

# Seed the database with sample departments, doctors, patients & today's queues
python app/utils/seed_data.py

# Start FastAPI server (runs on http://localhost:8000)
uvicorn app.main:app --reload --port 8000
```

### 2. Setup Frontend
Open a new terminal tab:
```powershell
# Navigate to frontend directory
cd hospital-queue-system/frontend

# Install node dependencies
npm install

# Start Vite React server (runs on http://localhost:5173)
npm run dev -- --port 5173
```

Now open **`http://localhost:5173`** in your browser!

---

## 🧪 Running Automated Tests

To execute the Pytest test suite covering registration, auth, token generation, queue transitions, and RBAC:

```powershell
cd hospital-queue-system/backend
pytest -v
```

---

## 📡 API Endpoints Summary

- `POST /api/auth/register` - Patient registration
- `POST /api/auth/login` - Obtain JWT token
- `GET /api/auth/me` - Check authenticated user session
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department (Admin)
- `GET /api/doctors` - List doctors
- `POST /api/doctors` - Create doctor (Admin)
- `POST /api/appointments` - Book appointment & auto-generate token
- `GET /api/patients/appointments` - Patient appointment history & queue status
- `GET /api/queue/{doctor_id}` - Get doctor live queue snapshot
- `POST /api/queue/{doctor_id}/next` - Call next waiting patient
- `POST /api/queue/{appointment_id}/start` - Start consultation
- `POST /api/queue/{appointment_id}/complete` - Complete consultation
- `POST /api/queue/{appointment_id}/skip` - Skip patient
- `POST /api/queue/{appointment_id}/recall` - Recall skipped patient
- `GET /api/admin/dashboard` - Administrative analytics & metrics
- `WS /ws/queue/{doctor_id}` - Real-time queue WebSocket
