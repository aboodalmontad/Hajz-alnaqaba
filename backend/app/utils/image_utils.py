import os
import cv2
import numpy as np
from PIL import Image
from fastapi import UploadFile, HTTPException
from backend.app.core.config import ALLOWED_EXTENSIONS, MAX_FILE_SIZE

def validate_and_load_image(file_bytes: bytes, filename: str) -> np.ndarray:
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).")
    
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"نوع الملف غير مسموح به. الصيغ المقبولة: {', '.join(ALLOWED_EXTENSIONS)}")

    try:
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="الملف المرفوع ليس صورة صالحة أو تالفة.")
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"فشل قراءة الصورة: {str(e)}")

def sanitize_filename(filename: str) -> str:
    base = os.path.basename(filename)
    clean = "".join(c for c in base if c.isalnum() or c in ('_', '-', '.'))
    return clean or "fingerprint.png"
