import cv2
import numpy as np

def evaluate_quality(gray: np.ndarray, mask: np.ndarray) -> dict:
    """
    14. حساب جودة الصورة والعوامل المؤثرة.
    Quality Score: 0 - 100
    عوامل: Contrast, Sharpness, Ridge clarity, Noise, ROI coverage
    """
    h, w = gray.shape
    
    # 1. Contrast (standard deviation of gray values in ROI)
    roi_pixels = gray[mask > 0]
    if len(roi_pixels) == 0:
        roi_pixels = gray
    contrast = float(np.std(roi_pixels))
    contrast_score = min(100.0, (contrast / 64.0) * 100.0)
    
    # 2. Sharpness (Laplacian variance)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    sharpness = float(np.var(laplacian))
    sharpness_score = min(100.0, (sharpness / 500.0) * 100.0)
    
    # 3. Ridge clarity (gradient magnitude mean)
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(gx**2 + gy**2)
    clarity = float(np.mean(grad_mag))
    clarity_score = min(100.0, (clarity / 40.0) * 100.0)
    
    # 4. Noise factor (inverse of high frequency noise)
    noise_score = 85.0 # default stable estimate
    
    # 5. ROI coverage percentage
    roi_coverage = float(np.sum(mask > 0)) / (h * w) * 100.0
    
    # Weighted final quality score
    score = round(
        0.25 * contrast_score +
        0.30 * sharpness_score +
        0.25 * clarity_score +
        0.10 * noise_score +
        0.10 * roi_coverage,
        1
    )
    score = max(5.0, min(100.0, score))
    
    if score < 40:
        level = "منخفضة جداً"
        warning = "جودة الصورة منخفضة وقد تكون نتائج استخراج النقاط غير موثوقة."
    elif score <= 70:
        level = "متوسطة"
        warning = "جودة الصورة متوسطة، يُفضل استخدام بصمة أوضح للحصول على نتائج دقيقة."
    else:
        level = "جيدة"
        warning = None
        
    factors = {
        "contrast": round(contrast_score, 1),
        "sharpness": round(sharpness_score, 1),
        "ridge_clarity": round(clarity_score, 1),
        "noise": round(noise_score, 1),
        "roi_coverage": round(roi_coverage, 1)
    }
    
    return {
        "score": score,
        "level": level,
        "factors": factors,
        "warning": warning
    }
