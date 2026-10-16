import os
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.image_processing import preprocess_image
from backend.app.services.segmentation import segment_fingerprint
from backend.app.services.enhancement import enhance_ridges
from backend.app.services.minutiae import extract_minutiae
from backend.app.services.quality import evaluate_quality
from backend.app.services.matcher import match_fingerprints

client = TestClient(app)

@pytest.fixture
def synthetic_fingerprint():
    # Create a synthetic grayscale image with artificial ridge-like patterns
    img = np.ones((300, 300), dtype=np.uint8) * 240
    for i in range(50, 250, 20):
        cv2.line(img, (50, i), (250, i), (50, 50, 50), 4)
    return img

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_image_processing_pipeline(synthetic_fingerprint):
    gray = preprocess_image(synthetic_fingerprint)
    assert gray.shape == (300, 300)
    
    mask = segment_fingerprint(gray)
    assert mask.shape == (300, 300)
    
    binary, skeleton, roi_mask = enhance_ridges(gray, mask)
    assert binary.shape == (300, 300)
    assert skeleton.shape == (300, 300)
    
    minutiae, stats = extract_minutiae(skeleton, roi_mask)
    assert isinstance(minutiae, list)
    assert isinstance(stats, dict)
    
    quality = evaluate_quality(gray, roi_mask)
    assert "score" in quality
    assert 0 <= quality["score"] <= 100

def test_matcher_service():
    m_a = [
        {"id": 1, "type": "ending", "x": 100, "y": 100, "orientation": 45.0, "confidence": 0.90},
        {"id": 2, "type": "bifurcation", "x": 150, "y": 150, "orientation": 90.0, "confidence": 0.88}
    ]
    m_b = [
        {"id": 1, "type": "ending", "x": 102, "y": 99, "orientation": 46.0, "confidence": 0.91},
        {"id": 2, "type": "bifurcation", "x": 149, "y": 152, "orientation": 88.0, "confidence": 0.85}
    ]
    p_a = {"pattern": "Loop", "confidence": 0.8}
    p_b = {"pattern": "Loop", "confidence": 0.85}
    q_a = {"score": 85.0, "level": "جيدة", "factors": {}}
    q_b = {"score": 82.0, "level": "جيدة", "factors": {}}
    
    res = match_fingerprints(m_a, m_b, p_a, p_b, q_a, q_b)
    assert "matching" in res
    assert res["matching"]["score"] > 50
