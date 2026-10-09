/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Ticket, Building2, Printer, CheckCircle, Clock, AlertTriangle, FileText, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ticket as TicketType, CategoryConfig } from '../types';

interface KioskProps {
  issuancePaused: boolean;
  onIssueTicket: (category: string) => Promise<TicketType | null>;
  waitingCount: number;
  categories?: CategoryConfig[];
  departmentTitle?: string;
}

export const Kiosk: React.FC<KioskProps> = ({
  issuancePaused,
  onIssueTicket,
  waitingCount,
  categories: customCategories,
  departmentTitle
}) => {
  const defaultCategories: CategoryConfig[] = [
    { id: 'general', name: 'وكالات عامة', desc: 'تنظيم الوكالات العامة وسحب النسخ', prefix: 'A' },
    { id: 'special', name: 'وكالات خاصة', desc: 'وكالات البيع، الفراغ، الإدارة، وغيرها', prefix: 'B' },
    { id: 'attestation', name: 'تصديق العقود', desc: 'تصديق وتثبيت العقود والاتفاقيات', prefix: 'C' },
    { id: 'inquiry', name: 'الاستعلامات والدعم', desc: 'الاستعلام عن الأوراق المطلوبة والرسوم', prefix: 'D' },
  ];

  const categories = customCategories && customCategories.length > 0 ? customCategories : defaultCategories;
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.id || 'general');
  const [lastIssuedTicket, setLastIssuedTicket] = useState<TicketType | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const categoryColors: Record<string, string> = {
    A: 'border-amber-500 bg-amber-50 text-amber-900',
    B: 'border-blue-500 bg-blue-50 text-blue-900',
    C: 'border-emerald-500 bg-emerald-50 text-emerald-900',
    D: 'border-purple-500 bg-purple-50 text-purple-900'
  };

  const handleGetTicket = async () => {
    if (issuancePaused) return;
    setIsIssuing(true);
    try {
      const ticket = await onIssueTicket(selectedCategory);
      if (ticket) {
        setLastIssuedTicket(ticket);
        setShowModal(true);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
        playBeep();
      }
    } catch (err) {
      console.error('Failed to issue ticket', err);
    } finally {
      setIsIssuing(false);
    }
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // AudioContext might be blocked before user interaction
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl border border-amber-500/30 text-center space-y-3">
        <div className="w-16 h-16 bg-amber-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg border border-amber-400">
          <Ticket className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">جهاز إصدار تذاكر الدور</h1>
        <p className="text-slate-300 text-sm">{departmentTitle || 'دائرة الوكالات – نقابة المحامين بحلب'}</p>
        <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full text-xs text-slate-300 border border-slate-700">
          <Clock className="w-4 h-4 text-amber-400" />
          المراجعين المنتظرين حالياً في الصالة: <strong className="text-white font-mono text-sm">{waitingCount}</strong> مراجع
        </div>
      </div>

      {issuancePaused ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold text-red-900">إصدار التذاكر متوقف مؤقتًا</h2>
          <p className="text-red-700 text-sm">تم إيقاف إصدار التذاكر مؤقتًا من قبل مسؤول الدائرة. يرجى مراجعة الموظف المسؤول.</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          <h2 className="text-lg font-bold text-slate-800 text-center">اختر نوع الخدمة المطلوبة:</h2>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const colorStyle = categoryColors[cat.prefix] || 'border-slate-300 bg-slate-50 text-slate-900';
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-6 rounded-2xl border-2 text-right transition-all flex flex-col justify-between gap-4 ${
                    isSelected 
                      ? 'border-amber-600 bg-amber-50/80 shadow-md ring-2 ring-amber-500/20' 
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-xl font-mono font-black text-lg flex items-center justify-center border ${colorStyle}`}>
                        {cat.prefix}
                      </span>
                      <span className="font-bold text-slate-900 text-lg">{cat.name}</span>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'}`}>
                      {isSelected && <CheckCircle className="w-4 h-4" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{cat.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Big Action Button */}
          <div className="pt-4">
            <button
              onClick={handleGetTicket}
              disabled={isIssuing}
              className="w-full py-6 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-2xl sm:text-3xl rounded-2xl shadow-xl hover:shadow-2xl transition-all transform active:scale-95 flex items-center justify-center gap-4 border border-amber-400/50"
            >
              <Ticket className="w-10 h-10 animate-bounce" />
              احصل على رقم دور
            </button>
          </div>

        </div>
      )}

      {/* Ticket Modal / Print View */}
      {showModal && lastIssuedTicket && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 text-center space-y-6 animate-in fade-in zoom-in duration-200">
            
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-800">تم إصدار تذكرتك بنجاح</h3>
              <p className="text-xs text-slate-500">يرجى الاحتفاظ بالتذكرة والانتظار حتى ظهور رقمك على الشاشة</p>
            </div>

            {/* Physical Ticket Simulator Card */}
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 space-y-4 shadow-inner text-center">
              <div className="text-xs font-bold text-slate-600">{departmentTitle || 'نقابة المحامين بحلب - دائرة الوكالات'}</div>
              
              <div className="py-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 mb-1">{lastIssuedTicket.categoryNameArabic}</div>
                <div className="text-5xl font-black font-mono tracking-wider text-amber-700">
                  {lastIssuedTicket.displayNumber}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex justify-between px-2">
                <span>التاريخ: {new Date().toLocaleDateString('ar-SY')}</span>
                <span>الوقت: {new Date(lastIssuedTicket.createdAt).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md"
              >
                <Printer className="w-4 h-4" /> طباعة التذكرة
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all text-sm shadow-md"
              >
                تم / تذكرة جديدة
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
