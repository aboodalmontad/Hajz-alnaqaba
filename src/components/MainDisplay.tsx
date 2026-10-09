/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Tv, Clock, Volume2, Building2, UserCheck, ArrowLeft, AlertCircle, VolumeX } from 'lucide-react';
import { Ticket, Counter, SystemSettings } from '../types';

interface MainDisplayProps {
  tickets: Ticket[];
  counters: Counter[];
  settings: SystemSettings;
  lastCalledTicket?: { ticket: Ticket; counter: string; isRecall?: boolean } | null;
}

export const MainDisplay: React.FC<MainDisplayProps> = ({ 
  tickets, 
  counters, 
  settings,
  lastCalledTicket 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Play audio chime and text-to-speech when lastCalledTicket changes
  useEffect(() => {
    if (!lastCalledTicket || !settings.soundAlertsEnabled || !audioEnabled) return;

    setHighlightTicketId(lastCalledTicket.ticket.id);
    const timeout = setTimeout(() => setHighlightTicketId(null), 8000);

    // Audio chime using Web Audio API
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + duration);
      };

      // Two-tone bell / chime
      playTone(523.25, 0, 0.4); // C5
      playTone(659.25, 0.25, 0.6); // E5
      playTone(783.99, 0.5, 0.8); // G5
    } catch (e) {
      // AudioContext may require prior user interaction
    }

    // Optional Arabic Speech synthesis
    if ('speechSynthesis' in window) {
      try {
        const text = `تذكرة رقم ${lastCalledTicket.ticket.displayNumber}، يرجى التوجه إلى ${lastCalledTicket.counter}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        // Speech synth fallback
      }
    }

    return () => clearTimeout(timeout);
  }, [lastCalledTicket, settings.soundAlertsEnabled, audioEnabled]);

  // Filter serving tickets
  const servingTickets = tickets.filter(t => t.status === 'serving');
  // Filter waiting tickets
  const waitingTickets = tickets.filter(t => t.status === 'waiting');

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-950 text-white p-4 sm:p-6 flex flex-col justify-between">
      
      {/* Top Header */}
      <header className="bg-slate-900/90 border border-amber-500/30 rounded-2xl px-6 py-4 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center shadow-lg border border-amber-400">
            <Building2 className="w-8 h-8 text-slate-950" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {settings.departmentTitle || 'دائرة الوكالات – نقابة المحامين بحلب'}
            </h1>
            <p className="text-xs sm:text-sm text-amber-400">
              {settings.departmentSubtitle || 'شاشة عرض أدواري المراجعين في صالة الانتظار'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              audioEnabled ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="تفعيل أو كتم التنبيه الصوتي"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{audioEnabled ? 'الصوت مفعّل' : 'الصوت مكتوم'}</span>
          </button>

          <div className="flex items-center gap-6 bg-slate-950/80 px-5 py-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-5 h-5 text-amber-400" />
              <span className="text-lg font-mono font-bold">
                {currentTime.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="text-xs text-slate-400 border-r border-slate-800 pr-5 hidden sm:block">
              {currentTime.toLocaleDateString('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-6 flex-1">
        
        {/* Currently Serving Counters (2 Columns on large) */}
        <div className="lg:col-span-2 space-y-4 flex flex-col">
          <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            الأرقام قيد الخدمة حالياً على الشبابيك
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {counters.filter(c => c.isOpen).map((counter) => {
              const currentServing = servingTickets.find(t => t.counterId === counter.id);
              const isHighlighted = currentServing && highlightTicketId === currentServing.id;

              return (
                <div 
                  key={counter.id}
                  className={`rounded-3xl p-6 border-2 flex flex-col justify-between transition-all shadow-xl ${
                    isHighlighted 
                      ? 'bg-amber-900/80 border-amber-400 ring-4 ring-amber-400/50 scale-[1.02]' 
                      : currentServing 
                        ? 'bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/80 shadow-amber-500/10' 
                        : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-base font-bold text-slate-200">{counter.name}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${currentServing ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                      {currentServing ? 'نشط الآن' : 'متاح'}
                    </span>
                  </div>

                  <div className="py-8 text-center">
                    {currentServing ? (
                      <div className="space-y-2">
                        <div className="text-6xl sm:text-7xl font-black font-mono tracking-wider text-amber-400">
                          {currentServing.displayNumber}
                        </div>
                        <div className="text-sm text-slate-300 font-medium">
                          {currentServing.categoryNameArabic}
                        </div>
                      </div>
                    ) : (
                      <div className="text-2xl text-slate-600 font-medium">
                        في انتظار النداء...
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950/50 rounded-xl p-3 text-center text-xs text-slate-400 border border-slate-800">
                    {currentServing ? `الموظف: ${currentServing.staffName || 'مندوب الوكالات'}` : 'جاهز لاستقبال المراجع التالي'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Waiting Queue Preview */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <Tv className="w-5 h-5 text-amber-400" />
              قائمة الانتظار في الصالة
            </h2>
            <span className="bg-amber-500/20 text-amber-400 text-xs font-mono font-bold px-3 py-1 rounded-full border border-amber-500/30">
              {waitingTickets.length} مراجع منتظر
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-2.5 max-h-[450px]">
            {waitingTickets.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">
                لا توجد أرقام في قائمة الانتظار حالياً
              </div>
            ) : (
              waitingTickets.slice(0, 15).map((t, idx) => (
                <div 
                  key={t.id}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between shadow-sm hover:border-amber-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="text-lg font-mono font-black text-white">{t.displayNumber}</div>
                      <div className="text-[11px] text-slate-400">{t.categoryNameArabic}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {new Date(t.createdAt).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>

          {waitingTickets.length > 15 && (
            <div className="pt-2 text-center text-xs text-slate-500">
              والمزيد من المراجعين قيد الانتظار...
            </div>
          )}
        </div>

      </div>

      {/* Footer Ticker */}
      <footer className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3 flex items-center justify-between text-xs text-slate-400 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap">
          {settings.tickerMessage || 'يرجى الانتباه إلى أرقام الدور وظهورها على شاشة الشبابيك عند النداء الصوتي. أهلاً بكم في نقابة المحامين بحلب.'}
        </div>
        <div className="font-mono text-amber-400 shrink-0 mr-4">نقابة المحامين بحلب © 2026</div>
      </footer>

    </div>
  );
};
