import cv2
import numpy as np

def segment_fingerprint(gray: np.ndarray) -> np.ndarray:
    """
    7. تحديد Fingerprint ROI باستخدام حساب التباين المحلي (Local Variance).
    يعيد مصفوفة ثنائية (Mask) بنفس أبعاد الصورة (255 للمنطقة الفعالة، 0 للخلفية).
    """
    block_size = 16
    h, w = gray.shape
    
    # Calculate local variance to separate foreground (fingerprint ridges) from background
    mean = cv2.blur(gray.astype(np.float32), (block_size, block_size))
    sq_mean = cv2.blur((gray.astype(np.float32)) ** 2, (block_size, block_size))
    variance = sq_mean - (mean ** 2)
    
    # Threshold variance to get ROI mask
    _, mask = cv2.threshold(variance, 100, 255, cv2.THRESH_BINARY)
    mask = mask.astype(np.uint8)
    
    # Morphological operations to clean up mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    
    # If mask is empty or mostly zero, fallback to full image mask
    if np.sum(mask > 0) < (h * w * 0.1):
        mask = np.ones((h, w), dtype=np.uint8) * 255
        
    return mask
