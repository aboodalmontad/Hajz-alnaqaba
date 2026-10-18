import os
import cv2
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.app.utils.image_utils import validate_and_load_image, sanitize_filename
from backend.app.services.image_processing import preprocess_image
from backend.app.services.segmentation import segment_fingerprint
from backend.app.services.enhancement import enhance_ridges
from backend.app.services.minutiae import extract_minutiae
from backend.app.services.quality import evaluate_quality
from backend.app.services.pattern import classify_pattern
from backend.app.services.matcher import match_fingerprints

router = APIRouter(prefix="/api", tags=["Compare"])

def process_single_image_for_matching(file_bytes: bytes, filename: str):
    img = validate_and_load_image(file_bytes, filename)
    gray = preprocess_image(img)
    mask = segment_fingerprint(gray)
    _, skeleton, roi_mask = enhance_ridges(gray, mask)
    minutiae, _ = extract_minutiae(skeleton, roi_mask)
    quality = evaluate_quality(gray, roi_mask)
    pattern, _, _ = classify_pattern(gray, minutiae)
    return minutiae, quality, pattern

@router.post("/compare")
async def compare_fingerprints(image_a: UploadFile = File(...), image_b: UploadFile = File(...)):
    bytes_a = await image_a.read()
    bytes_b = await image_b.read()
    
    fname_a = sanitize_filename(image_a.filename or "fingerprint_a.png")
    fname_b = sanitize_filename(image_b.filename or "fingerprint_b.png")
    
    minutiae_a, quality_a, pattern_a = process_single_image_for_matching(bytes_a, fname_a)
    minutiae_b, quality_b, pattern_b = process_single_image_for_matching(bytes_b, fname_b)
    
    comparison_result = match_fingerprints(
        minutiae_a=minutiae_a,
        minutiae_b=minutiae_b,
        pattern_a=pattern_a,
        pattern_b=pattern_b,
        quality_a=quality_a,
        quality_b=quality_b
    )
    
    return comparison_result
