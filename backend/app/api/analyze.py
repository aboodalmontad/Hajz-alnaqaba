import os
import cv2
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.app.core.config import ANNOTATED_DIR, APP_URL
from backend.app.utils.image_utils import validate_and_load_image, sanitize_filename
from backend.app.services.image_processing import preprocess_image
from backend.app.services.segmentation import segment_fingerprint
from backend.app.services.enhancement import enhance_ridges
from backend.app.services.minutiae import extract_minutiae
from backend.app.services.quality import evaluate_quality
from backend.app.services.pattern import classify_pattern
from backend.app.storage.database import save_fingerprint_record

router = APIRouter(prefix="/api", tags=["Analysis"])

@router.post("/analyze")
async def analyze_fingerprint(image: UploadFile = File(...)):
    file_bytes = await image.read()
    filename = sanitize_filename(image.filename or "fingerprint.png")
    
    # 1 & 2. Load and validate image
    img = validate_and_load_image(file_bytes, filename)
    h, w, _ = img.shape
    
    # 3 to 6. Preprocessing & Denoising
    gray = preprocess_image(img)
    
    # 7. Fingerprint ROI Segmentation
    mask = segment_fingerprint(gray)
    
    # 8 to 11. Enhancement, Binarization, Skeletonization
    binary, skeleton, roi_mask = enhance_ridges(gray, mask)
    
    # 12 & 13. Minutiae Extraction & Filtering
    minutiae, statistics = extract_minutiae(skeleton, roi_mask)
    
    # 14. Quality Evaluation
    quality = evaluate_quality(gray, roi_mask)
    
    # Pattern classification & Core/Delta
    pattern, core, deltas = classify_pattern(gray, minutiae)
    
    # Generate annotated image
    annotated_img = img.copy()
    for m in minutiae:
        mx, my = int(m["x"]), int(m["y"])
        if m["type"] == "ending":
            # Circle for Ridge Ending (Blue/Cyan or Green)
            cv2.circle(annotated_img, (mx, my), 6, (255, 0, 0), 2)
            cv2.putText(annotated_img, str(m["id"]), (mx + 8, my + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 0, 0), 1)
        else:
            # Square for Bifurcation (Red/Magenta)
            cv2.rectangle(annotated_img, (mx - 5, my - 5), (mx + 5, my + 5), (0, 0, 255), 2)
            cv2.putText(annotated_img, str(m["id"]), (mx + 8, my + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
            
    # Save annotated image
    ann_filename = f"annotated_{uuid.uuid4().hex}_{filename}"
    ann_path = os.path.join(ANNOTATED_DIR, ann_filename)
    cv2.imwrite(ann_path, annotated_img)
    
    # Save record to database
    record_id = save_fingerprint_record(
        quality_score=quality["score"],
        quality_level=quality["level"],
        pattern=pattern["pattern"],
        minutiae=minutiae,
        quality=quality
    )
    
    annotated_image_url = f"/api/annotated/{ann_filename}"
    
    return {
        "record_id": record_id,
        "image": {
            "width": w,
            "height": h
        },
        "quality": quality,
        "pattern": pattern,
        "core": core,
        "deltas": deltas,
        "minutiae": minutiae,
        "statistics": statistics,
        "annotated_image_url": annotated_image_url
    }
