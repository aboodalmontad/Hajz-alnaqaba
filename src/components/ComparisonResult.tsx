import React from 'react';
import { CompareResult } from '../types/fingerprint';
import { GitCompare, CheckCircle, BarChart2, ShieldAlert } from 'lucide-react';

interface ComparisonResultProps {
  result: CompareResult;
}

export const ComparisonResult: React.FC<ComparisonResultProps> = ({ result }) => {
  const { fingerprint_a, fingerprint_b, matching, matched_minutiae } = result;

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <GitCompare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">نتيجة مقارنة البصمتين</h2>
            <p className="text-xs text-slate-500">التحليل الخوارزمي المتقدم لمطابقة قوالب الخصائص</p>
          </div>
        </div>

        <div className="text-left bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
          <span className="text-xs text-indigo-600 block">درجة التشابه الخوارزمية</span>
          <span className="text-2xl font-bold text-indigo-700">{matching.score} / 100</span>
        </div>
      </div>

      {/* Similarity Level Banner */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${getLevelBadge(matching.level)}`}>
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <div>
            <span className="text-sm font-semibold block">مستوى التشابه: {matching.level_arabic}</span>
            <span className="text-xs opacity-80">
              هذه الدرجة خوارزمية إرشادية تعتمد على تقاطع النقاط والأنماط، ولا تُعد معياراً جنائياً لتحديد الهوية الشخصية.
            </span>
          </div>
        </div>
        <span className="text-lg font-bold px-3 py-1 bg-white/70 rounded-lg shadow-sm">
          {matching.score}%
        </span>
      </div>

      {/* Side by side comparison summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fingerprint A Summary */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <h4 className="font-semibold text-slate-800">البصمة الأولى (A)</h4>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">
              {fingerprint_a.pattern.pattern}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 block">عدد Minutiae:</span>
              <span className="font-bold text-slate-700 text-sm">{fingerprint_a.minutiae_count}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 block">جودة البصمة:</span>
              <span className="font-bold text-slate-700 text-sm">{fingerprint_a.quality.score}</span>
            </div>
          </div>
        </div>

        {/* Fingerprint B Summary */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <h4 className="font-semibold text-slate-800">البصمة الثانية (B)</h4>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">
              {fingerprint_b.pattern.pattern}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 block">عدد Minutiae:</span>
              <span className="font-bold text-slate-700 text-sm">{fingerprint_b.minutiae_count}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 block">جودة البصمة:</span>
              <span className="font-bold text-slate-700 text-sm">{fingerprint_b.quality.score}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Matched Minutiae Table */}
      <div className="flex flex-col gap-3">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-600" /> النقاط المتطابقة بصرياً ({matched_minutiae.length} نقطة مطابقة)
        </h4>
        <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-xl">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">النوع</th>
                <th className="py-2.5 px-3">نقطة A (ID)</th>
                <th className="py-2.5 px-3">إحداثيات A</th>
                <th className="py-2.5 px-3">نقطة B (ID)</th>
                <th className="py-2.5 px-3">إحداثيات B</th>
                <th className="py-2.5 px-3">مسافة التطابق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matched_minutiae.length > 0 ? (
                matched_minutiae.map((match, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-medium">
                        {match.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-800">#{match.id_a}</td>
                    <td className="py-2 px-3 text-slate-600">({match.x_a}, {match.y_a})</td>
                    <td className="py-2 px-3 font-bold text-slate-800">#{match.id_b}</td>
                    <td className="py-2 px-3 text-slate-600">({match.x_b}, {match.y_b})</td>
                    <td className="py-2 px-3 text-emerald-600 font-semibold">{match.distance} px</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">
                    لم يتم العثور على نقاط مطابقة مباشرة ضمن عتبة المسافة المحددة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
