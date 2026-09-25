# Smart Hospital Queue System — Windows & VS Code Local Setup Guide

This guide explains how to set up, run, test, and develop the **Smart Hospital Queue Management and Intelligent Consultation Timing System** locally on a Windows machine using VS Code, Python Flask, MongoDB, and React Vite.

---

## 💻 Prerequisites

Ensure the following tools are installed on your Windows machine:
1. **Python 3.10+**: `python --version`
2. **Node.js (v18+ or v20+)**: `node -v` & `npm -v`
3. **MongoDB Server (Local or MongoDB Atlas)**:
   - *Local*: [Download MongoDB Community Server](https://www.mongodb.com/try/download/community)
   - *Cloud*: [MongoDB Atlas Free Tier Cluster](https://www.mongodb.com/cloud/atlas)
4. **Git**: `git --version`
5. **VS Code**: [Download Visual Studio Code](https://code.visualstudio.com/)

---

## 🚀 Step-by-Step Local Setup

### Step 1: Open Workspace in VS Code
Open VS Code and navigate to the project directory:
```powershell
cd C:\Users\AnjanSharadamma\.gemini\antigravity\scratch\hospital-queue-system
code .
```

---

### Step 2: Set Up Backend (Python Flask)

1. Open PowerShell terminal in VS Code (`Ctrl + ~`) and navigate to `backend`:
   ```powershell
   cd backend
   ```

2. Create a Python Virtual Environment:
   ```powershell
   python -m venv venv
   ```

3. Activate the Virtual Environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
   *(If PowerShell blocks execution policies, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` first)*

4. Install Python Dependencies:
   ```powershell
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

---

### Step 3: Configure Environment Variables

1. Copy `.env.example` to create your local `.env` file:
   ```powershell
   cp .env.example .env
   ```

2. Open `.env` in VS Code and configure parameters:
   ```env
   # MongoDB Connection
   MONGO_URI=mongodb://localhost:27017
   MONGO_DATABASE=hospital_queue

   # App Configuration
   PORT=5000
   DEBUG=True
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

   # JWT & Security Secrets
   SECRET_KEY=dev-secret-key-change-in-production
   JWT_SECRET_KEY=super-secret-jwt-key-smart-hospital-2026

   # ML Prediction Service Configuration
   PREDICTION_PROVIDER=model
   ML_MODEL_PATH=ml/model.py

   # Maps API Key (Optional for real Google Maps routing)
   GOOGLE_MAPS_API_KEY=
   ```

---

### Step 4: Start MongoDB
Ensure your local MongoDB service is running:
```powershell
net start MongoDB
```
*(Or verify connection to MongoDB Atlas URI if using cloud MongoDB)*

---

### Step 5: Run Backend & Pytest Verification

1. Run Pytest Automated Tests:
   ```powershell
   python -m pytest tests/ -v
   ```
   *(All 38 tests should pass with 100% success)*

2. Start Flask Backend Server:
   ```powershell
   python app.py
   ```
   *Backend running on `http://127.0.0.1:5000`*

3. Verify Health Endpoint:
   Open browser or run in PowerShell:
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:5000/health"
   ```

---

### Step 6: Set Up Frontend (React Vite)

1. Open a new PowerShell terminal tab in VS Code and navigate to `frontend`:
   ```powershell
   cd frontend
   ```

2. Install Node.js Dependencies:
   ```powershell
   npm install
   ```

3. Start React Development Server:
   ```powershell
   npm run dev
   ```
   *Frontend running on `http://localhost:5173`*

4. Build Production Bundle:
   ```powershell
   npm run build
   ```

---

## 🔑 Default Initial Test Logins

The database initializes with seed users on startup using a single common demo password across all portals:

| Role | Phone | Common Demo Password | Portal View |
|---|---|---|---|
| **Patient** | `9876543211` | `PatientPass123!` | `/patient` |
| **Doctor** | `9876543210` | `PatientPass123!` | `/doctor` |
| **Admin** | `9999999999` | `PatientPass123!` | `/admin` |
| **Pharmacy** | `9876543230` | `PatientPass123!` | `/pharmacy` |
| **Laboratory** | `9876543240` | `PatientPass123!` | `/laboratory` |

