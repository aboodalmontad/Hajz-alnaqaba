from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ImageInfo(BaseModel):
    width: int
    height: int

class QualityInfo(BaseModel):
    score: float # 0 - 100
    level: str # "منخفضة جداً" / "متوسطة" / "جيدة"
    factors: Dict[str, float]
    warning: Optional[str] = None

class PatternInfo(BaseModel):
    pattern: str # "Arch", "Loop", "Whorl", "Unknown"
    confidence: float

class PointInfo(BaseModel):
    x: float
    y: float
    confidence: float

class MinutiaeItem(BaseModel):
    id: int
    type: str # "ending" or "bifurcation"
    x: float
    y: float
    orientation: float
    confidence: float

class StatisticsInfo(BaseModel):
    total_candidates: int
    ridge_endings: int
    bifurcations: int
    rejected_candidates: int
    average_confidence: float

class AnalyzeResponse(BaseModel):
    record_id: Optional[int] = None
    image: ImageInfo
    quality: QualityInfo
    pattern: PatternInfo
    core: Optional[PointInfo] = None
    deltas: List[PointInfo] = []
    minutiae: List[MinutiaeItem] = []
    statistics: StatisticsInfo
    annotated_image_url: str

class FingerprintSummary(BaseModel):
    minutiae_count: int
    quality: QualityInfo
    pattern: PatternInfo

class MatchingResult(BaseModel):
    score: int # 0 - 100
    level: str # "low", "medium", "high"
    level_arabic: str # "تشابه منخفض", "تشابه متوسط", "تشابه مرتفع"

class CompareResponse(BaseModel):
    fingerprint_a: FingerprintSummary
    fingerprint_b: FingerprintSummary
    matching: MatchingResult
    matched_minutiae: List[Dict[str, Any]] = []
