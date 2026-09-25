import pytest
from unittest.mock import patch
import requests
from app import create_app
from services.medicine_service import clean_medicine_property, search_medicines_rxnorm, _SEARCH_CACHE


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_clean_medicine_property_complete():
    raw_prop = {
        "rxcui": "1092398",
        "name": "aspirin 500 MG / diphenhydramine hydrochloride 25 MG Oral Tablet",
        "synonym": "ASA 500 MG / Diphenhydramine Hydrochloride 25 MG Oral Tablet",
        "tty": "SCD",
        "psn": "aspirin 500 MG / diphenhydrAMINE HCl 25 MG Oral Tablet"
    }
    cleaned = clean_medicine_property(raw_prop)
    assert cleaned["rxcui"] == "1092398"
    assert cleaned["name"] == raw_prop["name"]
    assert cleaned["synonym"] == raw_prop["synonym"]
    assert cleaned["prescribable_name"] == raw_prop["psn"]
    assert cleaned["term_type"] == "SCD"


def test_clean_medicine_property_missing_psn_falls_back_to_name():
    raw_prop = {
        "rxcui": "12345",
        "name": "Paracetamol 500 MG Tablet",
        "synonym": "",
        "tty": "SCD"
    }
    cleaned = clean_medicine_property(raw_prop)
    assert cleaned["rxcui"] == "12345"
    assert cleaned["prescribable_name"] == "Paracetamol 500 MG Tablet"
    assert cleaned["synonym"] == ""
    assert cleaned["term_type"] == "SCD"


def test_search_medicines_less_than_two_characters(client):
    res1 = client.get("/medicines/search?q=")
    assert res1.status_code == 200
    assert res1.get_json() == []

    res2 = client.get("/medicines/search?q=a")
    assert res2.status_code == 200
    assert res2.get_json() == []


def test_search_medicines_with_prefix(client):
    res = client.get("/api/medicines/search?q=a")
    assert res.status_code == 200
    assert res.get_json() == []


def test_search_medicines_mocked_success(client):
    mock_payload = {
        "drugGroup": {
            "name": "amoxicillin",
            "conceptGroup": [
                {
                    "tty": "SCD",
                    "conceptProperties": [
                        {
                            "rxcui": "213169",
                            "name": "amoxicillin 500 MG Oral Capsule",
                            "synonym": "Amoxicillin 500 MG Capsule",
                            "tty": "SCD",
                            "psn": "amoxicillin 500 MG Oral Capsule"
                        }
                    ]
                }
            ]
        }
    }

    _SEARCH_CACHE.clear()
    with patch("services.medicine_service.requests.get") as mock_get:
        mock_response = requests.Response()
        mock_response.status_code = 200
        mock_response.json = lambda: mock_payload
        mock_get.return_value = mock_response

        res = client.get("/medicines/search?q=amoxicillin")
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        assert item["rxcui"] == "213169"
        assert item["name"] == "amoxicillin 500 MG Oral Capsule"
        assert item["synonym"] == "Amoxicillin 500 MG Capsule"
        assert item["prescribable_name"] == "amoxicillin 500 MG Oral Capsule"
        assert item["term_type"] == "SCD"


def test_search_medicines_mocked_empty_response(client):
    mock_payload = {
        "drugGroup": {
            "name": None
        }
    }

    _SEARCH_CACHE.clear()
    with patch("services.medicine_service.requests.get") as mock_get:
        mock_response = requests.Response()
        mock_response.status_code = 200
        mock_response.json = lambda: mock_payload
        mock_get.return_value = mock_response

        res = client.get("/medicines/search?q=unknownmed123")
        assert res.status_code == 200
        data = res.get_json()
        assert data == []


def test_search_medicines_network_failure(client):
    _SEARCH_CACHE.clear()
    with patch("services.medicine_service.requests.get", side_effect=requests.RequestException("Network unreachable")):
        res = client.get("/medicines/search?q=paracetamol")
        assert res.status_code == 503
        data = res.get_json()
        assert "error" in data
