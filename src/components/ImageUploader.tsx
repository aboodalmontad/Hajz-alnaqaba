import React, { useRef, useState } from 'react';
import { Upload, FileCheck, XCircle } from 'lucide-react';

interface ImageUploaderProps {
  label: string;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  selectedFile,
  onFileSelect,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelect(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/50'
            : selectedFile
            ? 'border-emerald-500 bg-emerald-50/30'
            : 'border-slate-300 hover:border-indigo-400 bg-white'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleChange}
          accept="image/*"
          className="hidden"
          disabled={disabled}
        />

        {selectedFile ? (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 truncate max-w-[240px]">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {(selectedFile.size / 1024).toFixed(1)} كيلوبايت - انقر للتغيير
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFileSelect(null);
              }}
              className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 mt-1"
            >
              <XCircle className="w-3.5 h-3.5" /> حذف الملف
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                اسحب صورة البصمة هنا، أو انقر للاختيار
              </p>
              <p className="text-xs text-slate-400 mt-1">
                PNG, JPG, JPEG, BMP (بحد أقصى 10 ميجابايت)
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
