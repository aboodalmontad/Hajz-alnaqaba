import React, { useState } from 'react';
import { MinutiaeItem } from '../types/fingerprint';
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';

interface FingerprintViewerProps {
  imageUrl: string;
  minutiae: MinutiaeItem[];
  title?: string;
  onSelectPoint?: (point: MinutiaeItem) => void;
}

export const FingerprintViewer: React.FC<FingerprintViewerProps> = ({
  imageUrl,
  minutiae,
  title = 'الصورة المشروحة للبصمة',
  onSelectPoint,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [selectedPoint, setSelectedPoint] = useState<MinutiaeItem | null>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.75));
  const handleReset = () => setZoom(1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">
            (○ Ridge Ending | □ Bifurcation) - انقر على أي نقطة لعرض تفاصيلها
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
          <button
            onClick={handleZoomIn}
            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded transition-colors"
            title="تكبير"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded transition-colors"
            title="تصغير"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded transition-colors"
            title="إعادة ضبط"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative overflow-auto bg-slate-900 flex items-center justify-center min-h-[360px] max-h-[500px] p-4">
        <div
          className="relative transition-transform duration-200 ease-out origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          <img
            src={imageUrl}
            alt="Annotated Fingerprint"
            className="max-w-full h-auto rounded shadow-lg object-contain"
          />
        </div>
      </div>

      {selectedPoint && (
        <div className="bg-indigo-50 border-t border-indigo-100 p-3 text-xs flex items-center justify-between text-indigo-900">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-600" />
            <span>
              النقطة <strong className="font-bold">#{selectedPoint.id}</strong> ({selectedPoint.type === 'ending' ? 'Ridge Ending' : 'Bifurcation'}): X={selectedPoint.x}, Y={selectedPoint.y}, الاتجاه={selectedPoint.orientation}°, الثقة={selectedPoint.confidence}
            </span>
          </div>
          <button
            onClick={() => setSelectedPoint(null)}
            className="text-indigo-700 hover:text-indigo-900 font-semibold"
          >
            إغلاق
          </button>
        </div>
      )}
    </div>
  );
};
