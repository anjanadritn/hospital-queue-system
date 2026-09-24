# Team Integration Guide — Smart Hospital Queue Backend

This document contains full API specifications, authentication rules, payload contracts, and integration examples for team members building the **Patient Mobile/Web App**, **Staff Dashboard**, and **ML Module**.

---

## 🌐 Base URL & Server Info
- **Local Development**: `http://localhost:5000`
- **Production AWS EC2**: `http://<your-ec2-ip-or-domain>`
- **Health Check Endpoint**: `GET /health`

---

## 🔑 Authentication & Authorization

All protected endpoints require a JWT Bearer Token passed in the HTTP Authorization header:
```http
Authorization: Bearer <your_jwt_access_token>
```

### Roles
- `patient`: Access to own profile, appointments, queue status, and notifications.
- `doctor`: Access to doctor queue controls (`call-next`, `call`, `start`, `complete`, `skip`, `recall`), `GET /queue/all`, and emergency promotion.
- `admin`: Full administrative access.

---

## 📲 Patient App APIs & Integration Examples

### 1. User Registration (`POST /auth/register`)
```json
// Request
{
  "email": "patient@example.com",
  "password": "password123",
  "role": "patient"
}

// Response (HTTP 201)
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "user_id": "U001",
    "email": "patient@example.com",
    "role": "patient"
  }
}
```

### 2. User Login (`POST /auth/login`)
```json
// Request
{
  "email": "patient@example.com",
  "password": "password123"
}

// Response (HTTP 200)
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "user_id": "U001",
    "email": "patient@example.com",
    "role": "patient"
  }
}
```

### 3. Create Patient Profile (`POST /patients`)
```json
// Request (Headers: Authorization: Bearer <token>)
{
  "name": "Alice Smith",
  "age": 28,
  "gender": "Female",
  "phone": "555-1111",
  "email": "patient@example.com"
}

// Response (HTTP 201)
{
  "patient_id": "P001",
  "user_id": "U001",
  "name": "Alice Smith",
  "age": 28,
  "gender": "Female",
  "phone": "555-1111",
  "email": "patient@example.com"
}
```

### 4. Book Appointment (`POST /appointments`)
```json
// Request (Headers: Authorization: Bearer <token>)
{
  "patient_id": "P001",
  "doctor_id": "D001",
  "department_id": "DEPT001",
  "appointment_date": "2026-08-20",
  "appointment_time": "10:30"
}

// Response (HTTP 201)
{
  "appointment_id": "A001",
  "patient_id": "P001",
  "doctor_id": "D001",
  "department_id": "DEPT001",
  "appointment_date": "2026-08-20",
  "appointment_time": "10:30",
  "status": "booked"
}
```

### 5. Join Hospital Queue (`POST /queue/join`) — *Strict Team Contract*
```json
// Request (Headers: Authorization: Bearer <token>)
{
  "patient_id": "P001",
  "department": "Cardiology",
  "priority": "normal"
}

// Response (HTTP 201)
{
  "queue_id": "Q001",
  "position": 1,
  "predicted_wait_min": 15
}
```

### 6. Get Live Queue Status (`GET /queue/status/<queue_id>`) — *Strict Team Contract*
```json
// Response (HTTP 200)
{
  "position": 1,
  "predicted_wait_min": 15,
  "status": "waiting"
}
```

### 7. Patient Notifications (`GET /notifications`)
```json
// Response (HTTP 200)
[
  {
    "notification_id": "N001",
    "patient_id": "P001",
    "queue_id": "Q001",
    "type": "departure_reminder",
    "title": "Time to Leave for Hospital",
    "message": "Estimated wait is ~30 mins and travel time is ~20 mins. Please start traveling now.",
    "predicted_wait_min": 30,
    "travel_time_min": 20,
    "recommended_departure_time": "2026-08-13T08:00:00+00:00",
    "status": "pending"
  }
]
```

---

## 👨‍⚕️ Staff & Doctor Dashboard APIs

### 1. List Public Doctors (`GET /doctors`) — *Strict Team Contract*
```json
// Response (HTTP 200)
[
  {
    "doctor_id": "D001",
    "name": "Dr. John Smith",
    "department": "Cardiology",
    "available": true
  }
]
```

### 2. List All Active Queues (`GET /queue/all?department=Cardiology`) — *Strict Team Contract*
*(Allowed Roles: doctor, admin)*
```json
// Response (HTTP 200)
[
  {
    "queue_id": "Q001",
    "patient_id": "P001",
    "position": 1,
    "priority": "normal",
    "status": "waiting"
  }
]
```

### 3. Doctor Call Next Patient (`POST /queue/call-next`)
```json
// Request (Headers: Authorization: Bearer <doctor_token>)
{
  "doctor_id": "D001"
}

// Response (HTTP 200)
{
  "queue_id": "Q001",
  "patient_id": "P001",
  "status": "called",
  "called_at": "2026-08-13T08:20:00+00:00"
}
```

### 4. Doctor Queue Control Operations
- `POST /queue/<queue_id>/call`: Move status `waiting` → `called`
- `POST /queue/<queue_id>/start`: Move status `called` → `in_consultation`
- `POST /queue/<queue_id>/complete`: Move status `in_consultation` → `completed` & recalculate positions
- `POST /queue/<queue_id>/skip`: Move status `waiting` → `skipped` & recalculate positions
- `POST /queue/<queue_id>/recall`: Move status `skipped` → `waiting`

### 5. Promote Emergency Priority (`POST /queue/emergency`) — *Strict Team Contract*
*(Allowed Roles: doctor, admin)*
```json
// Request
{
  "queue_id": "Q003"
}

// Response (HTTP 200)
{
  "success": true,
  "new_position": 1
}
```

---

## 🤖 ML Integration Module API (`POST /predict`) — *Strict Team Contract*

```json
// Request
{
  "department": "Cardiology",
  "current_queue_length": 8,
  "hour_of_day": 10,
  "day_of_week": 2
}

// Response (HTTP 200)
{
  "predicted_wait_min": 45
}
```

---

## ⚠️ Standard Error Response Format

All error responses return standard HTTP error status codes (400, 401, 403, 404, 409, 429, 500) with clean JSON:
```json
{
  "success": false,
  "error": "Detailed human-readable error explanation",
  "code": 400
}
```
