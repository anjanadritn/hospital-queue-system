from flask import Blueprint, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from services.auth_service import (
    send_auth_otp,
    verify_auth_otp,
    register_patient,
    login_user,
    reset_password,
    decode_jwt_token
)

auth_bp = Blueprint("auth_bp", __name__)

# SECURITY: Rate limiting on sensitive endpoints
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["10000 per day", "2000 per hour"]
)

@auth_bp.route("/auth/send-otp", methods=["POST"])
@limiter.limit("5 per minute")
def request_send_otp():
    data = request.get_json(silent=True) or {}
    phone = data.get("phone", "")
    purpose = data.get("purpose", "ACCOUNT_VERIFICATION")

    res, error = send_auth_otp(phone, purpose)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@auth_bp.route("/auth/verify-otp", methods=["POST"])
@limiter.limit("10 per minute")
def request_verify_otp():
    data = request.get_json(silent=True) or {}
    phone = data.get("phone", "")
    otp = data.get("otp", "")
    purpose = data.get("purpose", "ACCOUNT_VERIFICATION")

    if not phone or not otp:
        return jsonify({"verified": False, "error": "Phone number and OTP are required"}), 400

    ok, error = verify_auth_otp(phone, otp, purpose)
    if not ok:
        return jsonify({"verified": False, "error": error}), 400

    return jsonify({"verified": True, "message": "Phone number verified successfully"}), 200

@auth_bp.route("/auth/register", methods=["POST"])
@limiter.limit("5 per minute")
def request_register():
    data = request.get_json(silent=True) or {}
    res, error = register_patient(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 201

@auth_bp.route("/auth/login", methods=["POST"])
@limiter.limit("10 per minute")
def request_login():
    data = request.get_json(silent=True) or {}
    phone = data.get("phone", "")
    password = data.get("password", "")
    role = data.get("role")

    if not phone or not password:
        return jsonify({"error": "Phone number and password are required"}), 400

    res, error = login_user(phone, password, role)
    if error:
        return jsonify({"error": error}), 401
    return jsonify(res), 200

@auth_bp.route("/auth/me", methods=["GET"])
def get_current_user_profile():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return jsonify({"error": "No token provided"}), 401

    decoded = decode_jwt_token(auth_header)
    if not decoded:
        return jsonify({"error": "Invalid or expired token"}), 401

    from services.auth_service import get_user_by_phone
    user = get_user_by_phone(decoded.get("phone", ""))
    if user:
        user_clean = dict(user)
        user_clean.pop("password_hash", None)
        return jsonify(user_clean), 200

    return jsonify(decoded), 200

@auth_bp.route("/auth/forgot-password", methods=["POST"])
def request_forgot_password():
    data = request.get_json(silent=True) or {}
    phone = data.get("phone", "")
    res, error = send_auth_otp(phone, "PASSWORD_RESET")
    if error:
        return jsonify({"error": error}), 400
    return jsonify(res), 200

@auth_bp.route("/auth/reset-password", methods=["POST"])
def request_reset_password():
    data = request.get_json(silent=True) or {}
    phone = data.get("phone", "")
    otp = data.get("otp", "")
    new_pass = data.get("new_password", "")

    if not phone or not otp or not new_pass:
        return jsonify({"error": "Phone, OTP, and new password are required"}), 400

    ok, error = reset_password(phone, otp, new_pass)
    if not ok:
        return jsonify({"error": error}), 400

    return jsonify({"success": True, "message": "Password reset successfully. Please login."}), 200
