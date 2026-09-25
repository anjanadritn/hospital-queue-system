import logging
import time
import urllib.parse
from typing import List, Dict, Optional, Tuple
import requests

logger = logging.getLogger(__name__)

# Base endpoint for NLM Prescribable RxNorm API
RXNORM_PRESCRIBE_BASE_URL = "https://rxnav.nlm.nih.gov/REST/Prescribe/drugs.json"

# In-memory TTL cache to reduce external network round-trips for common drug queries
# Cache entry format: { "timestamp": float, "data": List[Dict] }
_SEARCH_CACHE: Dict[str, Dict] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes
MAX_CACHE_ENTRIES = 200


def clean_medicine_property(prop: Dict) -> Dict:
    """
    Format a single RxNorm conceptProperty into a clean, standardized medicine suggestion.
    """
    rxcui = str(prop.get("rxcui") or "").strip()
    name = str(prop.get("name") or "").strip()
    synonym = str(prop.get("synonym") or "").strip()
    psn = str(prop.get("psn") or "").strip()
    tty = str(prop.get("tty") or "").strip()

    prescribable_name = psn if psn else name

    return {
        "rxcui": rxcui,
        "name": name,
        "synonym": synonym,
        "prescribable_name": prescribable_name,
        "term_type": tty,
        # Field aliases for convenient consumption
        "psn": psn,
        "tty": tty,
    }


def search_medicines_rxnorm(query: str, limit: int = 50) -> Tuple[List[Dict], Optional[str]]:
    """
    Query the official NLM Prescribable RxNorm API for prescribable drugs matching query.
    Endpoint: https://rxnav.nlm.nih.gov/REST/Prescribe/drugs.json?name=<name>&expand=psn

    Returns:
        (clean_suggestions_list, error_message_or_None)
    """
    if not query or len(query.strip()) < 2:
        return [], None

    clean_query = query.strip()
    cache_key = clean_query.lower()

    # Check cache
    now = time.time()
    if cache_key in _SEARCH_CACHE:
        cached = _SEARCH_CACHE[cache_key]
        if now - cached["timestamp"] < CACHE_TTL_SECONDS:
            return cached["data"][:limit], None

    params = {
        "name": clean_query,
        "expand": "psn"
    }

    url = f"{RXNORM_PRESCRIBE_BASE_URL}?{urllib.parse.urlencode(params)}"
    headers = {
        "User-Agent": "SmartHospitalQueue-PrescriptionEngine/1.0 (NLM-RxNorm-Prescribe-Client)",
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=8.0)
        if response.status_code != 200:
            logger.warning(
                f"[RxNorm API] External API returned HTTP {response.status_code} for query '{clean_query}'"
            )
            return [], f"RxNorm API returned status {response.status_code}"

        payload = response.json()
    except requests.RequestException as e:
        logger.warning(f"[RxNorm API] Connection failed for query '{clean_query}': {e}")
        return [], f"Failed to connect to RxNorm API: {str(e)}"
    except Exception as e:
        logger.error(f"[RxNorm API] Unexpected error parsing response for '{clean_query}': {e}")
        return [], f"Unexpected error processing RxNorm response: {str(e)}"

    drug_group = payload.get("drugGroup") or {}
    concept_groups = drug_group.get("conceptGroup") or []

    suggestions = []
    seen_rxcuis = set()

    # Iterate over concept groups (SCD, SBD, GPCK, BPCK, etc.)
    for group in concept_groups:
        props = group.get("conceptProperties") or []
        for prop in props:
            cleaned = clean_medicine_property(prop)
            rxcui = cleaned.get("rxcui")

            if not rxcui or rxcui in seen_rxcuis:
                continue

            seen_rxcuis.add(rxcui)
            suggestions.append(cleaned)

    # Sort priority: prioritize prescribable clinical drugs (SCD) and branded drugs (SBD)
    # followed by generic packs (GPCK)
    def tty_priority(item: Dict) -> int:
        t = item.get("term_type", "")
        if t == "SCD":  # Semantic Clinical Drug (e.g. Amoxicillin 500mg capsule)
            return 1
        if t == "SBD":  # Semantic Branded Drug (e.g. Amoxil 500mg capsule)
            return 2
        if t == "GPCK": # Generic Pack
            return 3
        if t == "BPCK": # Branded Pack
            return 4
        return 5

    suggestions.sort(key=tty_priority)

    # Cache successful result
    if len(_SEARCH_CACHE) > MAX_CACHE_ENTRIES:
        _SEARCH_CACHE.clear()
    _SEARCH_CACHE[cache_key] = {"timestamp": now, "data": suggestions}

    return suggestions[:limit], None
