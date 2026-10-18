export interface ImageInfo {
  width: number;
  height: number;
}

export interface QualityInfo {
  score: number;
  level: string;
  factors: {
    contrast: number;
    sharpness: number;
    ridge_clarity: number;
    noise: number;
    roi_coverage: number;
  };
  warning?: string | null;
}

export interface PatternInfo {
  pattern: string;
  confidence: number;
}

export interface PointInfo {
  x: number;
  y: number;
  confidence: number;
}

export interface MinutiaeItem {
  id: number;
  type: 'ending' | 'bifurcation';
  x: number;
  y: number;
  orientation: number;
  confidence: number;
}

export interface StatisticsInfo {
  total_candidates: number;
  ridge_endings: number;
  bifurcations: number;
  rejected_candidates: number;
  average_confidence: number;
}

export interface AnalyzeResult {
  record_id?: number;
  image: ImageInfo;
  quality: QualityInfo;
  pattern: PatternInfo;
  core?: PointInfo | null;
  deltas: PointInfo[];
  minutiae: MinutiaeItem[];
  statistics: StatisticsInfo;
  annotated_image_url: string;
}

export interface FingerprintSummary {
  minutiae_count: number;
  quality: QualityInfo;
  pattern: PatternInfo;
}

export interface MatchingResultData {
  score: number;
  level: string;
  level_arabic: string;
}

export interface CompareResult {
  fingerprint_a: FingerprintSummary;
  fingerprint_b: FingerprintSummary;
  matching: MatchingResultData;
  matched_minutiae: Array<{
    id_a: number;
    id_b: number;
    type: string;
    x_a: number;
    y_a: number;
    x_b: number;
    y_b: number;
    distance: number;
  }>;
}
