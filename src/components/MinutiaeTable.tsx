import React, { useState } from 'react';
import { MinutiaeItem, StatisticsInfo } from '../types/fingerprint';
import { ListFilter, Search, Hash, ShieldCheck } from 'lucide-react';

interface MinutiaeTableProps {
  minutiae: MinutiaeItem[];
  statistics: StatisticsInfo;
  onSelectPoint?: (point: MinutiaeItem) => void;
}

export const MinutiaeTable: React.FC<MinutiaeTableProps> = ({
  minutiae,
  statistics,
  onSelectPoint,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredMinutiae = minutiae.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (searchQuery && !m.id.toString().includes(searchQuery)) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">نقاط الخصائص (Minutiae)</h3>
              <p className="text-xs text-slate-500">النتائج المستخرجة وإحصائيات التحليل</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث برقم النقطة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            >
              <option value="all">كل الأنواع</option>
              <option value="ending">Ridge Ending (دائرة ○)</option>
              <option value="bifurcation">Bifurcation (مربع □)</option>
            </select>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
          <div className="bg-slate-50 p-2.5 rounded-lg text-center">
            <span className="text-xs text-slate-400 block">إجمالي المرشحات</span>
            <span className="text-sm font-bold text-slate-700">{statistics.total_candidates}</span>
          </div>
          <div className="bg-blue-50 p-2.5 rounded-lg text-center">
            <span className="text-xs text-blue-600 block">نهايات الخطوط ○</span>
            <span className="text-sm font-bold text-blue-700">{statistics.ridge_endings}</span>
          </div>
          <div className="bg-indigo-50 p-2.5 rounded-lg text-center">
            <span className="text-xs text-indigo-600 block">التفرعات □</span>
            <span className="text-sm font-bold text-indigo-700">{statistics.bifurcations}</span>
          </div>
          <div className="bg-rose-50 p-2.5 rounded-lg text-center">
            <span className="text-xs text-rose-600 block">النقاط الملغاة</span>
            <span className="text-sm font-bold text-rose-700">{statistics.rejected_candidates}</span>
          </div>
          <div className="bg-emerald-50 p-2.5 rounded-lg text-center col-span-2 sm:col-span-1">
            <span className="text-xs text-emerald-600 block">متوسط الثقة</span>
            <span className="text-sm font-bold text-emerald-700">{statistics.average_confidence}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-72">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4">ID</th>
              <th className="py-2.5 px-4">النوع (Type)</th>
              <th className="py-2.5 px-4">X</th>
              <th className="py-2.5 px-4">Y</th>
              <th className="py-2.5 px-4">الاتجاه (Orientation)</th>
              <th className="py-2.5 px-4">الثقة (Confidence)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMinutiae.length > 0 ? (
              filteredMinutiae.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => onSelectPoint && onSelectPoint(m)}
                  className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-4 font-semibold text-slate-800">#{m.id}</td>
                  <td className="py-2 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium ${
                        m.type === 'ending'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {m.type === 'ending' ? '○ Ending' : '□ Bifurcation'}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-slate-600">{m.x}</td>
                  <td className="py-2 px-4 text-slate-600">{m.y}</td>
                  <td className="py-2 px-4 text-slate-600">{m.orientation}°</td>
                  <td className="py-2 px-4 font-semibold text-emerald-600">{m.confidence}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-6 text-slate-400">
                  لا توجد نقاط مطابقة للبحث أو الفلتر.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
