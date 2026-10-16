import { AnalyzeResult, CompareResult } from '../types/fingerprint';

export async function analyzeFingerprint(file: File): Promise<AnalyzeResult> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'فشل تحليل البصمة.');
    } else {
      const errText = await response.text().catch(() => '');
      throw new Error(errText || `فشل تحليل البصمة (رمز الحالة: ${response.status})`);
    }
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  throw new Error('استجابة غير صالحة من خادم التحليل.');
}

export async function compareFingerprints(fileA: File, fileB: File): Promise<CompareResult> {
  const formData = new FormData();
  formData.append('image_a', fileA);
  formData.append('image_b', fileB);

  const response = await fetch('/api/compare', {
    method: 'POST',
    body: formData,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'فشل مقارنة البصمتين.');
    } else {
      const errText = await response.text().catch(() => '');
      throw new Error(errText || `فشل مقارنة البصمتين (رمز الحالة: ${response.status})`);
    }
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  throw new Error('استجابة غير صالحة من خادم المقارنة.');
}

