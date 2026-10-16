import numpy as np
from typing import List, Dict, Any

def match_fingerprints(minutiae_a: list, minutiae_b: list, pattern_a: dict, pattern_b: dict, quality_a: dict, quality_b: dict) -> dict:
    """
    9. مقارنة البصمتين باستخدام Minutiae templates وقوالب الأنماط والجودة.
    النتيجة: Score (0-100), level ("low", "medium", "high"), matched minutiae.
    """
    # Compare patterns
    pattern_match = 1.0 if pattern_a["pattern"] == pattern_b["pattern"] else 0.5
    
    # Compare minutiae sets using spatial distance matching (bounding box / nearest neighbor alignment)
    matched_pairs = []
    
    list_a = sorted(minutiae_a, key=lambda x: (x["x"], x["y"]))
    list_b = sorted(minutiae_b, key=lambda x: (x["x"], x["y"]))
    
    matched_count = 0
    max_possible = max(len(list_a), len(list_b), 1)
    
    for ma in list_a:
        best_dist = float('inf')
        best_mb = None
        for mb in list_b:
            if ma["type"] == mb["type"]:
                dist = np.hypot(ma["x"] - mb["x"], ma["y"] - mb["y"])
                if dist < best_dist:
                    best_dist = dist
                    best_mb = mb
                    
        # If matching distance is within tolerance (e.g. 15 pixels) and orientation is close
        if best_mb and best_dist < 18:
            angle_diff = abs(ma["orientation"] - best_mb["orientation"])
            if angle_diff < 35 or angle_diff > 145:
                matched_count += 1
                matched_pairs.append({
                    "id_a": ma["id"],
                    "id_b": best_mb["id"],
                    "type": ma["type"],
                    "x_a": ma["x"],
                    "y_a": ma["y"],
                    "x_b": best_mb["x"],
                    "y_b": best_mb["y"],
                    "distance": round(best_dist, 1)
                })

    # Calculate raw score based on percentage of matches and pattern alignment
    ratio = matched_count / max_possible
    base_score = ratio * 100.0 * pattern_match
    
    # Scale with quality penalty
    avg_quality = (quality_a["score"] + quality_b["score"]) / 200.0
    final_score = int(min(98, max(12, base_score * (0.7 + 0.3 * avg_quality))))
    
    if final_score < 45:
        level = "low"
        level_arabic = "تشابه منخفض"
    elif final_score < 75:
        level = "medium"
        level_arabic = "تشابه متوسط"
    else:
        level = "high"
        level_arabic = "تشابه مرتفع"
        
    return {
        "fingerprint_a": {
            "minutiae_count": len(minutiae_a),
            "quality": quality_a,
            "pattern": pattern_a
        },
        "fingerprint_b": {
            "minutiae_count": len(minutiae_b),
            "quality": quality_b,
            "pattern": pattern_b
        },
        "matching": {
            "score": final_score,
            "level": level,
            "level_arabic": level_arabic
        },
        "matched_minutiae": matched_pairs
    }
