import logging
from flask import Blueprint, request, jsonify
from services.medicine_service import search_medicines_rxnorm

logger = logging.getLogger(__name__)

medicine_bp = Blueprint("medicine_bp", __name__)


@medicine_bp.route("/medicines/search", methods=["GET"])
@medicine_bp.route("/api/medicines/search", methods=["GET"])
def search_medicines_route():
    """
    Search prescribable medicines via official NLM RxNorm Prescribe API.
    Endpoint: GET /medicines/search?q=<name>
    Query parameters:
        q: Drug name query (minimum 2 characters)
    Returns:
        List of clean medicine suggestions containing:
        - rxcui
        - name
        - synonym
        - prescribable_name
        - term_type
    """
    query = request.args.get("q", "")
    if not query:
        query = request.args.get("name", "")

    query = str(query).strip()

    # When query is less than 2 characters, return empty list immediately
    if len(query) < 2:
        return jsonify([]), 200

    suggestions, error = search_medicines_rxnorm(query)

    if error and not suggestions:
        logger.warning(f"[/medicines/search] RxNorm query '{query}' failed: {error}")
        return jsonify({
            "error": "RxNorm service unavailable",
            "detail": error,
            "suggestions": [],
            "results": []
        }), 503

    return jsonify(suggestions), 200
