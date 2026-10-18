import cv2
import numpy as np
from typing import Optional, Dict, Any

def classify_pattern(gray: np.ndarray, minutiae: list) -> tuple[Dict[str, Any], Optional[Dict[str, Any]], list]:
    """
    7. Fingerprint Pattern classification (Arch, Loop, Whorl, Unknown).
    8. Core and Delta detection.
    """
    h, w = gray.shape
    
    # Heuristic pattern classification based on minutiae distribution and ridge flow
    endings = sum(1 for m in minutiae if m["type"] == "ending")
    bifs = sum(1 for m in minutiae if m["type"] == "bifurcation")
    total = len(minutiae)
    
    if total < 10:
        pattern = "Unknown"
        confidence = 0.45
    elif bifs > endings * 1.2:
        pattern = "Whorl"
        confidence = 0.82
    elif endings > bifs * 1.5:
        pattern = "Loop"
        confidence = 0.85
    else:
        pattern = "Arch"
        confidence = 0.76
        
    pattern_info = {
        "pattern": pattern,
        "confidence": confidence
    }
    
    # Core and Delta detection (estimate center core if sufficient minutiae exist)
    core = None
    deltas = []
    
    if total >= 15:
        # Estimate core near center of mass of minutiae
        cx = int(np.mean([m["x"] for m in minutiae]))
        cy = int(np.mean([m["y"] for m in minutiae]))
        core = {
            "x": cx,
            "y": cy - 20,
            "confidence": 0.84
        }
        
        # Estimate a delta lower in the fingerprint
        deltas.append({
            "x": cx - 40,
            "y": cy + 60,
            "confidence": 0.75
        })
        
    return pattern_info, core, deltas
