# AWS EC2 Deployment Guide — Smart Hospital Queue Backend

This guide outlines the production deployment procedure for the Flask + PyMongo backend application onto an AWS EC2 instance using Gunicorn, systemd, and Nginx.

---

## 1. AWS EC2 Instance Provisioning
- **OS Recommendation**: Ubuntu Server 22.04 LTS (x86_64)
- **Instance Type**: `t3.micro` (Free Tier) or `t3.small`
- **Security Group Inbound Rules**:
  - `SSH (22)`: My IP / Restricted Admin IP
  - `HTTP (80)`: `0.0.0.0/0`
  - `HTTPS (443)`: `0.0.0.0/0`
  - *Note*: Do **NOT** open port `27017` (MongoDB) to the public internet.

---

## 2. Server Environment Setup

Connect to your EC2 instance via SSH:
```bash
ssh -i your-key.pem ubuntu@<your-ec2-public-ip>
```

Update system packages and install Python, pip, and venv:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv nginx git -y
```

---

## 3. Application Deployment & Virtual Environment Setup

Clone repository and navigate to backend directory:
```bash
git clone <your-repository-url> hospital-queue-backend
cd hospital-queue-backend/backend
```

Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
```

---

## 4. Production Environment Configuration

Create production `.env` file:
```bash
cp .env.example .env
nano .env
```

Configure mandatory variables in `.env`:
```env
FLASK_ENV=production
DEBUG=False
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/hospital_queue?retryWrites=true&w=majority
MONGODB_DATABASE=hospital_queue
SECRET_KEY=generate-a-strong-random-secret-key-here-32-chars
JWT_SECRET_KEY=generate-a-strong-jwt-secret-key-here-32-chars
CORS_ORIGINS=https://your-patient-app.com,https://your-staff-dashboard.com
PREDICTION_PROVIDER=mock
GOOGLE_MAPS_API_KEY=your-actual-google-maps-key
```

---

## 5. Systemd Service Setup (Gunicorn Process Manager)

Copy systemd service file:
```bash
sudo cp deployment/hospital-queue.service /etc/systemd/system/hospital-queue.service
sudo systemctl daemon-reload
sudo systemctl enable hospital-queue
sudo systemctl start hospital-queue
```

Verify service status:
```bash
sudo systemctl status hospital-queue
```

---

## 6. Nginx Reverse Proxy Configuration

Create Nginx site configuration at `/etc/nginx/sites-available/hospital-queue`:
```nginx
server {
    listen 80;
    server_name <your-domain-or-ec2-ip>;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable configuration and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/hospital-queue /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. Production Verification

Verify health endpoint via curl:
```bash
curl http://localhost/health
```

Expected Output:
```json
{
  "status": "ok",
  "service": "hospital-queue-backend",
  "database": {
    "connected": true,
    "detail": "connected"
  }
}
```
