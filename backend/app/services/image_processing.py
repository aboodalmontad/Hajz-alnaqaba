import cv2
import numpy as np

def preprocess_image(img: np.ndarray) -> np.ndarray:
    """
    4. تحويلها إلى grayscale عند الحاجة.
    5. تحسين التباين.
    6. إزالة الضوضاء.
    """
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    # Contrast enhancement using CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Noise removal using Bilateral Filter or Median Blur
    denoised = cv2.bilateralFilter(enhanced, 5, 50, 50)
    
    return denoised
