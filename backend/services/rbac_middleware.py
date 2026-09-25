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

    # Normalize allowed roles: lowercase and trimmed
    norm_allowed = {str(r).strip().lower() for r in allowed_roles}
    # "user" is synonymous with "patient" for end-user patients
    if "patient" in norm_allowed:
        norm_allowed.add("user")

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

            # Extract and normalize role
            raw_role = decoded.get("role")
            if not raw_role or str(raw_role).strip().lower() in ["", "none", "null"]:
                # If role is not explicitly specified, infer from token identifiers
                if decoded.get("patient_id") or decoded.get("user_id"):
                    user_role = "patient"
                elif decoded.get("doctor_id"):
                    user_role = "doctor"
                else:
                    user_role = "patient"
            else:
                user_role = str(raw_role).strip().lower()

            # Canonicalize synonyms: "user", "client", "customer" are all patients
            if user_role in ["user", "client", "customer"]:
                user_role = "patient"

            if user_role not in norm_allowed:
                return jsonify({
                    "error": f"Unauthorized access. Only {list(allowed_roles)} accounts can access this endpoint."
                }), 403

            decoded["role"] = user_role
            request.current_user = decoded
            return f(*args, **kwargs)
        return decorated_function
    return decorator
