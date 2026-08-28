from functools import wraps
from flask import request, jsonify
from services.auth_service import decode_jwt_token

def require_auth(allowed_roles=None):
    """
    Role-Based Access Control & Authentication Decorator.
    Verifies JWT token in 'Authorization: Bearer <token>' header.
    Returns HTTP 401 if missing/invalid token, HTTP 403 if role mismatch.
    """
    if allowed_roles is None:
        allowed_roles = ["patient", "doctor", "admin"]

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header:
                return jsonify({
                    "error": "Authentication required. Please login before booking an appointment or accessing patient features."
                }), 401

            decoded = decode_jwt_token(auth_header)
            if not decoded:
                return jsonify({
                    "error": "Authentication required. Invalid or expired JWT token."
                }), 401

            role = decoded.get("role", "patient")
            if role not in allowed_roles:
                return jsonify({
                    "error": f"Unauthorized access. Only {allowed_roles} accounts can access this endpoint."
                }), 403

            request.current_user = decoded
            return f(*args, **kwargs)
        return decorated_function
    return decorator
