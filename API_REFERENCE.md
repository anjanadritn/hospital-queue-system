# Smart Hospital Backend — Complete API Reference

This document provides explicit API specifications for all production endpoints in the Smart Hospital Queue Management system.

---

## 🔒 Authentication & Authorization Headers

For all protected endpoints, pass the JWT access token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_access_token>
```

---

## 📑 Endpoints Overview

| Category | Method | Endpoint Path | Access Role | Description |
|---|---|---|---|---|
| **Health** | `GET` | `/health` | Public | System & DB status check |
| **Auth** | `POST` | `/auth/send-otp` | Public | Send 6-digit phone OTP |
| **Auth** | `POST` | `/auth/verify-otp` | Public | Verify 6-digit phone OTP |
| **Auth** | `POST` | `/auth/register` | Public | Register new patient account |
| **Auth** | `POST` | `/auth/login` | Public | Authenticate user & receive JWT |
| **Auth** | `GET` | `/auth/me` | Protected | Get current user identity |
| **Auth** | `POST` | `/auth/forgot-password` | Public | Reset forgotten password with OTP |
| **Doctors** | `GET` | `/doctors` | Public | List specialist doctors |
| **Symptoms** | `GET` | `/symptoms/search` | Public | Search symptoms & disease categories |
| **Appointments** | `POST` | `/appointments/book` | Patient | Book consultation (max 2 days advance) |
| **Appointments** | `GET` | `/appointments/patient/<id>` | Patient | List patient's bookings |
| **Queue** | `POST` | `/queue/join` | Patient | Join hospital queue |
| **Queue** | `GET` | `/queue/status/<queue_id>` | Protected (Owner/Doctor/Admin) | Track private queue token status |
| **Queue** | `GET` | `/queue/all` | Doctor / Admin | List all active queue tokens |
| **Queue** | `POST` | `/queue/emergency` | Protected | Escalate token to Emergency Priority |
| **Queue** | `POST` | `/queue/<queue_id>/arrive` | Patient | Mark hospital arrival mode |
| **Consultation** | `POST` | `/consultation/<id>/generate-otp` | Patient | Generate 6-digit consultation OTP |
| **Consultation** | `GET` | `/consultation/<id>/otp-status` | Protected | Check active consultation OTP status |
| **Consultation** | `POST` | `/doctor/consultation/<id>/verify-otp` | Doctor | Doctor verifies OTP to start visit |
| **Consultation** | `POST` | `/doctor/consultation/<id>/complete` | Doctor | Doctor completes consultation |
| **Notifications** | `GET` | `/notifications/<patient_id>` | Patient | Fetch patient notifications & unread count |
| **Notifications** | `POST` | `/notifications/<id>/read` | Patient | Mark single notification read |
| **Notifications** | `POST` | `/notifications/patient/<id>/read-all` | Patient | Mark all notifications read |
| **ML Engine** | `POST` | `/predict` | Public | Predict consultation duration via Random Forest |

---

## ⚙️ Detailed Endpoint Specifications

### 1. Health Check
- **`GET /health`**
- **Authentication**: None
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "service": "hospital-queue-backend",
    "database_connected": true,
    "database": {
      "connected": true,
      "detail": "connected"
    }
  }
  ```

---

### 2. Authentication Flow

#### A. Send Phone OTP
- **`POST /auth/send-otp`**
- **Request Body**:
  ```json
  {
    "phone": "9876543210",
    "purpose": "ACCOUNT_VERIFICATION"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "OTP sent to 9876543210 for ACCOUNT_VERIFICATION",
    "phone": "9876543210",
    "purpose": "ACCOUNT_VERIFICATION",
    "development_otp": "482910"
  }
  ```

#### B. Verify Phone OTP
- **`POST /auth/verify-otp`**
- **Request Body**:
  ```json
  {
    "phone": "9876543210",
    "otp": "482910",
    "purpose": "ACCOUNT_VERIFICATION"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "verified": true,
    "message": "Phone number verified successfully"
  }
  ```

#### C. Patient Signup
- **`POST /auth/register`**
- **Request Body**:
  ```json
  {
    "name": "Alice Smith",
    "phone": "9876543210",
    "email": "alice@example.com",
    "password": "Password123!",
    "otp": "482910"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "user_id": "U_PAT_1042",
      "patient_id": "P502",
      "name": "Alice Smith",
      "phone": "9876543210",
      "email": "alice@example.com",
      "role": "patient",
      "phone_verified": true
    }
  }
  ```

#### D. User Login
- **`POST /auth/login`**
- **Request Body**:
  ```json
  {
    "phone": "9876543210",
    "password": "Password123!",
    "role": "patient"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "user_id": "U_PAT_1042",
      "patient_id": "P502",
      "name": "Alice Smith",
      "role": "patient"
    },
    "redirect": "/patient"
  }
  ```

---

### 3. Queue & Appointments

#### A. Book Consultation
- **`POST /appointments/book`**
- **Authorization**: `Bearer <patient_token>`
- **Request Body**:
  ```json
  {
    "patient_id": "P001",
    "doctor_id": "D001",
    "department": "Cardiology",
    "consultation_date": "2026-08-16",
    "priority": "normal",
    "symptoms": ["Chest discomfort", "Shortness of breath"],
    "custom_symptoms": "Mild fatigue"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "booking_id": "B004",
    "consultation_date": "2026-08-16",
    "doctor_id": "D001",
    "department": "Cardiology",
    "predicted_consultation_duration": 25,
    "status": "booked"
  }
  ```

#### B. Join Queue
- **`POST /queue/join`**
- **Authorization**: `Bearer <patient_token>`
- **Request Body**:
  ```json
  {
    "doctor_id": "D001",
    "department": "Cardiology",
    "priority": "normal",
    "symptoms": ["Fever", "Headache"]
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "queue_id": "Q005",
    "position": 1,
    "status": "waiting",
    "predicted_wait_time": 15
  }
  ```

---

### 4. Random Forest ML Prediction Engine
- **`POST /predict`**
- **Authentication**: None
- **Request Body**:
  ```json
  {
    "symptoms": ["Fever", "Headache"],
    "department": "General Medicine",
    "priority": "normal",
    "queue_position": 5
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "predicted_consultation_duration_min": 25
  }
  ```

---

### 5. Consultation Verification OTP

#### A. Doctor Verify OTP
- **`POST /doctor/consultation/<booking_id>/verify-otp`**
- **Authorization**: `Bearer <doctor_token>`
- **Request Body**:
  ```json
  {
    "otp": "654321"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "verified": true,
    "status": "in_consultation",
    "booking_id": "B004"
  }
  ```
