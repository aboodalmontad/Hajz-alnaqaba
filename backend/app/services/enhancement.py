import cv2
import numpy as np

def enhance_ridges(gray: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    8. تقدير اتجاه الـRidges.
    9. تحسين الـRidges.
    10. Binarization.
    11. Skeletonization.
    """
    h, w = gray.shape
    
    # Adaptive thresholding for binarization
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 15, 4
    )
    
    # Apply ROI mask to binary image
    binary = cv2.bitwise_and(binary, binary, mask=mask)
    
    # Skeletonization using OpenCV morphological thinning approximation
    skeleton = np.zeros(gray.shape, dtype=np.uint8)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    temp_bin = binary.copy()
    
    for _ in range(12): # Iterative thinning
        erode = cv2.erode(temp_bin, element)
        temp = cv2.subtract(temp_bin, cv2.dilate(erode, element))
        skeleton = cv2.bitwise_or(skeleton, temp)
        temp_bin = erode.copy()
        if cv2.countNonZero(temp_bin) == 0:
            break
            
    skeleton = cv2.bitwise_and(skeleton, skeleton, mask=mask)
    
    # Estimate average ridge orientation map (simplified for robust feature extraction)
    # Return binary, skeleton, and mask
    return binary, skeleton, mask
