import React from 'react';
import { QualityInfo } from '../types/fingerprint';
import { AlertTriangle, CheckCircle2, Award, Activity } from 'lucide-react';

interface QualityCardProps {
  quality: QualityInfo;
}

export const QualityCard: React.FC<QualityCardProps> = ({ quality }) => {
  const isPoor = quality.score < 40;
  const isMedium = quality.score >= 40 && quality.score <= 70;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">تحليل جودة البصمة</h3>
            <p className="text-xs text-slate-500">تقييم معيار الجودة التقني</p>
          </div>
        </div>
        <div className="text-left">
          <span className="text-2xl font-bold text-indigo-600">{quality.score}</span>
          <span className="text-xs text-slate-400 block">من 100</span>
        </div>
      </div>

      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
        <span className="text-sm font-medium text-slate-600">مستوى الجودة:</span>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
            isPoor
              ? 'bg-rose-100 text-rose-700'
              : isMedium
              ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {isPoor ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {quality.level}
        </span>
      </div>

      {quality.warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{quality.warning}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
          <Activity className="w-3.5 h-3.5" /> العوامل المؤثرة:
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between bg-slate-50 p-2 rounded">
            <span className="text-slate-500">التباين (Contrast):</span>
            <span className="font-semibold text-slate-700">{quality.factors.contrast}%</span>
          </div>
          <div className="flex justify-between bg-slate-50 p-2 rounded">
            <span className="text-slate-500">الوضوح (Sharpness):</span>
            <span className="font-semibold text-slate-700">{quality.factors.sharpness}%</span>
          </div>
          <div className="flex justify-between bg-slate-50 p-2 rounded">
            <span className="text-slate-500">وضوح الخطوط:</span>
            <span className="font-semibold text-slate-700">{quality.factors.ridge_clarity}%</span>
          </div>
          <div className="flex justify-between bg-slate-50 p-2 rounded">
            <span className="text-slate-500">تغطية ROI:</span>
            <span className="font-semibold text-slate-700">{quality.factors.roi_coverage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
