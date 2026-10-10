/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Tv, 
  Clock, 
  Volume2, 
  Building2, 
  UserCheck, 
  AlertCircle, 
  VolumeX,
  Megaphone,
  BellRing,
  ArrowDown,
  X,
  Sparkles,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Layers,
  ArrowRight,
  Monitor,
  Flame,
  Users
} from 'lucide-react';
import { Ticket, Counter, SystemSettings } from '../types';

interface MainDisplayProps {
  tickets: Ticket[];
  counters: Counter[];
  settings: SystemSettings;
  lastCalledTicket?: { ticket: Ticket; counter: string; isRecall?: boolean; recallCount?: number; timestamp?: string } | null;
  onNavigateHome?: () => void;
}

export const MainDisplay: React.FC<MainDisplayProps> = ({ 
  tickets, 
  counters, 
  settings, 
  lastCalledTicket,
  onNavigateHome 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [displayMode, setDisplayMode] = useState<'all' | 'serving-only'>('all'); // وضع العرض الشامل أو عرض الأرقام الحالية فقط
  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);

  // Active recall alert state for eye-catching modal overlay
  const [activeRecall, setActiveRecall] = useState<{
    ticket: Ticket;
    counter: string;
    recallCount?: number;
    timestamp: string;
  } | null>(null);
  const [recallRemaining, setRecallRemaining] = useState<number>(10);

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Track Fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error('Fullscreen toggle error:', e);
    }
  };

  // Countdown timer for recall alert modal
  useEffect(() => {
    if (!activeRecall) return;
    const interval = setInterval(() => {
      setRecallRemaining(prev => {
        if (prev <= 1) {
          setActiveRecall(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRecall]);

  // Track new ticket additions to play the chime and notify ticket owner when a number is added
  const [prevTicketsCount, setPrevTicketsCount] = useState<number>(tickets.length);
  const [prevLatestTicketId, setPrevLatestTicketId] = useState<string>(tickets[tickets.length - 1]?.id || '');

  useEffect(() => {
    if (tickets.length > prevTicketsCount) {
      const latestTicket = tickets[tickets.length - 1];
      if (latestTicket && latestTicket.id !== prevLatestTicketId && latestTicket.status === 'waiting') {
        if (settings.soundAlertsEnabled && audioEnabled) {
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const playTone = (freq: number, start: number, duration: number, vol = 0.28) => {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
              gain.gain.setValueAtTime(vol, audioCtx.currentTime + start);
              gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + duration);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start(audioCtx.currentTime + start);
              osc.stop(audioCtx.currentTime + start + duration);
            };
            playTone(523.25, 0.0, 0.60, 0.30);  // C5
            playTone(659.25, 0.30, 0.65, 0.30); // E5
            playTone(783.99, 0.60, 0.75, 0.32); // G5
            playTone(1046.50, 0.90, 1.30, 0.35); // C6
            playTone(1318.51, 1.35, 1.50, 0.33); // E6
          } catch (e) {}
        }
      }
    }
    setPrevTicketsCount(tickets.length);
    if (tickets.length > 0) {
      setPrevLatestTicketId(tickets[tickets.length - 1].id);
    }
  }, [tickets, settings.soundAlertsEnabled, audioEnabled, prevTicketsCount, prevLatestTicketId]);

  // Play audio chime and text-to-speech when lastCalledTicket changes
  useEffect(() => {
    if (!lastCalledTicket) return;

    const isRecall = Boolean(lastCalledTicket.isRecall);
    const recallNum = lastCalledTicket.recallCount || lastCalledTicket.ticket.recallCount || 1;

    if (isRecall) {
      setActiveRecall({
        ticket: lastCalledTicket.ticket,
        counter: lastCalledTicket.counter,
        recallCount: recallNum,
        timestamp: lastCalledTicket.timestamp || new Date().toISOString()
      });
      setRecallRemaining(10);
    }

    setHighlightTicketId(lastCalledTicket.ticket.id);
    const timeout = setTimeout(() => {
      setHighlightTicketId(null);
    }, isRecall ? 14000 : 9000);

    // Audio chime using Web Audio API (أصوات موسيقية تنبيهية ونغمية أطول وأكثر جذباً للانتباه)
    if (settings.soundAlertsEnabled && audioEnabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        if (isRecall) {
          // نغمة موسيقية مميزة وطويلة لإعادة النداء: لحن تنبيهي قوي ومتدرج (D5 -> F#5 -> A5 -> D6 -> F#6)
          const playAlertTone = (freq: number, start: number, duration: number, vol = 0.32) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
            gain.gain.setValueAtTime(vol, audioCtx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + start);
            osc.stop(audioCtx.currentTime + start + duration);
          };
          playAlertTone(587.33, 0.0, 0.55, 0.35);   // D5
          playAlertTone(739.99, 0.30, 0.55, 0.35);  // F#5
          playAlertTone(880.00, 0.60, 0.65, 0.38);  // A5
          playAlertTone(1174.66, 0.90, 1.20, 0.40); // D6
          playAlertTone(1479.98, 1.30, 1.40, 0.38); // F#6 (إطالة ولحن إضافي لفت الانتباه)
        } else {
          // نغمة موسيقية أطول وأكثر جاذبية عند استدعاء بطاقة جديدة: لحن متناغم ثري (C5 -> E5 -> G5 -> C6 -> E6)
          const playTone = (freq: number, start: number, duration: number, vol = 0.28) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
            gain.gain.setValueAtTime(vol, audioCtx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + start);
            osc.stop(audioCtx.currentTime + start + duration);
          };
          playTone(523.25, 0.0, 0.60, 0.30);  // C5
          playTone(659.25, 0.30, 0.65, 0.30); // E5
          playTone(783.99, 0.60, 0.75, 0.32); // G5
          playTone(1046.50, 0.90, 1.30, 0.35); // C6
          playTone(1318.51, 1.35, 1.50, 0.33); // E6 (نغمة ختامية طويلة ومميزة)
        }
      } catch (e) {
        // AudioContext fallback
      }

      // تم إلغاء القراءة الصوتية (SpeechSynthesis) بناءً على طلب المستخدم: إصدار صوت موسيقى فقط بدون قراءة الأرقام
    }

    return () => clearTimeout(timeout);
  }, [lastCalledTicket, settings.soundAlertsEnabled, audioEnabled]);

  // Filter serving tickets (حالياً قيد الخدمة على الشبابيك)
  const servingTickets = useMemo(() => {
    return tickets.filter(t => t.status === 'serving');
  }, [tickets]);

  // Filter waiting tickets (في صالة الانتظار)
  const waitingTickets = useMemo(() => {
    return tickets.filter(t => t.status === 'waiting');
  }, [tickets]);



  // قائمة موحدة وشاملة للبطاقات التي أتى دورها الآن على الشبابيك
  // تتضمن كل شباك مفتوح مع تذكرته، وأي تذكرة serving حتى لو لم تكن مطابقة بالمعرّف
  const activeServingCards = useMemo(() => {
    const list: Array<{
      id: string;
      counterName: string;
      counterId?: string;
      ticket?: Ticket;
      isOpen: boolean;
      staffName?: string;
    }> = [];

    const assignedTicketIds = new Set<string>();

    // 1. إضافة كل الشبابيك المفتوحة وربطها بالتذكرة قيد الخدمة إن وجدت
    counters.forEach(counter => {
      const match = servingTickets.find(t => t.counterId === counter.id || t.counterName === counter.name);
      if (match) {
        assignedTicketIds.add(match.id);
      }
      list.push({
        id: `counter-${counter.id}`,
        counterName: counter.name,
        counterId: counter.id,
        ticket: match,
        isOpen: counter.isOpen,
        staffName: match?.staffName || counter.currentStaffName
      });
    });

    // 2. إذا كانت هناك أي تذكرة serving لم ترتبط بشباك أعلاه، إضافتها مباشرة لضمان عدم ضياع أي بطاقة أتى دورها
    servingTickets.forEach(ticket => {
      if (!assignedTicketIds.has(ticket.id)) {
        list.unshift({
          id: `orphan-${ticket.id}`,
          counterName: ticket.counterName || 'الشباك العام',
          counterId: ticket.counterId,
          ticket: ticket,
          isOpen: true,
          staffName: ticket.staffName
        });
      }
    });

    return list;
  }, [counters, servingTickets]);

  // Trigger preview test recall (for testing visual appeal)
  const handleTriggerTestRecall = () => {
    const sample = servingTickets[0] || tickets[0] || {
      id: `sample-${Date.now()}`,
      number: 1,
      displayNumber: 'A-001',
      category: 'special',
      categoryNameArabic: 'توثيق وكالة',
      status: 'serving' as const,
      createdAt: new Date().toISOString(),
      counterName: 'الشباك 1',
      staffName: 'حسان مرشحة'
    };

    setActiveRecall({
      ticket: sample,
      counter: sample.counterName || 'الشباك 1',
      timestamp: new Date().toISOString()
    });
    setRecallRemaining(10);
    setHighlightTicketId(sample.id);

    if (settings.soundAlertsEnabled && audioEnabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
      } catch (e) {}
    }
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-white p-3 sm:p-5 flex flex-col justify-between relative transition-all ${
      activeRecall ? 'shadow-[inset_0_0_100px_rgba(244,63,94,0.4)]' : ''
    }`}>
      
      {/* تم إخفاء الهيدر العلوي بشكل كامل لمنح شاشة العرض كامل المساحة الرأسية للبطاقات */}

      {/* Main Grid Content */}
      <div className={`my-4 flex-1 ${
        displayMode === 'serving-only'
          ? 'flex flex-col'
          : 'grid grid-cols-1 lg:grid-cols-12 gap-5'
      }`}>
        
        {/* ======================================================== */}
        {/* SECTION 1: ALL ACTIVE SERVING CARDS (البطاقات التي أتى دورها حالياً) */}
        {/* ======================================================== */}
        <div className={`space-y-4 flex flex-col ${
          displayMode === 'serving-only' ? 'w-full flex-1' : 'lg:col-span-8'
        }`}>
          <div className="flex items-center justify-between bg-slate-900/80 px-4 py-2.5 rounded-2xl border border-slate-800/90">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-base sm:text-lg font-black text-amber-400 flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                البطاقات التي أتى دورها حالياً على الشبابيك
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {lastCalledTicket?.isRecall && (
                <span className="bg-rose-500/20 text-rose-300 text-xs font-bold px-3 py-1 rounded-full border border-rose-500/40 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  تنبيه: تكرار نداء
                </span>
              )}
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {activeServingCards.filter(c => c.ticket).length} دور نشط
              </span>
            </div>
          </div>

          {/* Cards Grid: Dynamic layout based on number of counters */}
          <div className={`grid gap-4 flex-1 ${
            activeServingCards.length <= 2 
              ? 'grid-cols-1 sm:grid-cols-2' 
              : activeServingCards.length <= 4 
                ? 'grid-cols-1 sm:grid-cols-2' 
                : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
          }`}>
            {activeServingCards.map((card) => {
              const currentServing = card.ticket;
              const isRecallActive = currentServing && highlightTicketId === currentServing.id && lastCalledTicket?.isRecall;
              const isNormalHighlighted = currentServing && highlightTicketId === currentServing.id && !lastCalledTicket?.isRecall;

              return (
                <div 
                  key={card.id}
                  className={`rounded-3xl p-5 sm:p-6 border-2 flex flex-col justify-between transition-all shadow-2xl relative overflow-hidden ${
                    isRecallActive
                      ? 'bg-gradient-to-br from-rose-950 via-slate-900 to-rose-900/90 border-rose-500 ring-8 ring-rose-500/70 shadow-[0_0_60px_rgba(244,63,94,0.7)] scale-[1.02] animate-pulse'
                      : isNormalHighlighted 
                        ? 'bg-gradient-to-br from-amber-950 via-slate-900 to-slate-900 border-amber-400 ring-4 ring-amber-400/50 scale-[1.02] shadow-[0_0_40px_rgba(245,158,11,0.4)]' 
                        : currentServing 
                          ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border-amber-500/70 shadow-lg hover:border-amber-400' 
                          : card.isOpen
                            ? 'bg-slate-900/60 border-slate-800'
                            : 'bg-slate-950/40 border-slate-900 opacity-60'
                  }`}
                >
                  {/* Glowing Top Line */}
                  {currentServing && (
                    <div className={`absolute top-0 inset-x-0 h-1.5 ${
                      isRecallActive 
                        ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 animate-pulse'
                        : isNormalHighlighted
                          ? 'bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400 animate-pulse'
                          : 'bg-gradient-to-r from-transparent via-amber-500/80 to-transparent'
                    }`} />
                  )}

                  {/* Header of the Card: Counter Name & Status Badge */}
                  <div className="flex items-center justify-between border-b border-slate-800/90 pb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        isRecallActive 
                          ? 'bg-rose-500 animate-ping'
                          : currentServing 
                            ? 'bg-amber-400 animate-pulse' 
                            : card.isOpen 
                              ? 'bg-emerald-500' 
                              : 'bg-slate-600'
                      }`} />
                      <span className="text-base sm:text-lg font-black text-white tracking-tight">
                        {card.counterName}
                      </span>
                    </div>

                    {isRecallActive ? (
                      <span className="text-xs px-3 py-1 rounded-full font-black bg-rose-600 text-white shadow-lg animate-bounce flex items-center gap-1.5 border border-rose-400">
                        <Megaphone className="w-3.5 h-3.5" />
                        إعادة نداء عاجل
                      </span>
                    ) : isNormalHighlighted ? (
                      <span className="text-xs px-3 py-1 rounded-full font-black bg-amber-500 text-slate-950 shadow-md animate-pulse flex items-center gap-1">
                        <BellRing className="w-3.5 h-3.5" />
                        النداء الحالي
                      </span>
                    ) : currentServing ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        أتى الدور
                      </span>
                    ) : card.isOpen ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        متاح للنداء
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-800 text-slate-500">
                        مغلق
                      </span>
                    )}
                  </div>

                  {/* Giant Central Ticket Number */}
                  <div className="py-6 sm:py-8 text-center flex-1 flex flex-col justify-center">
                    {currentServing ? (
                      <div className="space-y-3">
                        <div className="text-[11px] font-bold text-amber-300 tracking-wider uppercase">
                          رقم الدور المطلوب
                        </div>
                        <div className={`text-6xl sm:text-7xl lg:text-8xl font-black font-mono tracking-wider ${
                          isRecallActive 
                            ? 'text-rose-400 drop-shadow-[0_0_35px_rgba(244,63,94,0.95)] animate-pulse' 
                            : isNormalHighlighted
                              ? 'text-yellow-300 drop-shadow-[0_0_30px_rgba(245,158,11,0.9)] animate-pulse'
                              : 'text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                        }`}>
                          {currentServing.displayNumber}
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl bg-slate-950/70 border border-amber-500/30 text-xs sm:text-sm font-bold text-slate-200">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>{currentServing.categoryNameArabic}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 py-4">
                        <div className="text-xl sm:text-2xl text-slate-500 font-bold">
                          {card.isOpen ? 'جاهز لاستقبال المراجع...' : 'الشباك غير متاح'}
                        </div>
                        <p className="text-xs text-slate-600">
                          {card.isOpen ? 'سيظهر رقم الدور هنا فور استدعائه' : 'خارج أوقات العمل'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer Box: Staff & Instructions */}
                  <div className={`rounded-2xl p-3 text-xs border transition-all ${
                    isRecallActive
                      ? 'bg-rose-950/80 text-rose-200 border-rose-500/60 font-bold shadow-md'
                      : currentServing 
                        ? 'bg-slate-950/70 text-slate-300 border-slate-800/90' 
                        : 'bg-slate-950/30 text-slate-500 border-slate-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">
                          {card.staffName ? `المندوب: ${card.staffName}` : 'مندوب شباك الوكالات'}
                        </span>
                      </div>

                      {currentServing?.calledAt && (
                        <div className="text-[11px] text-amber-400/90 font-mono font-bold shrink-0">
                          {new Date(currentServing.calledAt).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 2: WAITING QUEUE ONLY (قائمة قيد الانتظار فقط) */}
        {/* ======================================================== */}
        {displayMode === 'all' && (
          <div className="lg:col-span-4 flex flex-col">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col flex-1">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-100 flex items-center gap-2">
                      قائمة قيد الانتظار
                    </h3>
                    <p className="text-[11px] text-slate-400">الأدوار القادمة في صالة المراجعين</p>
                  </div>
                </div>

                <span className="bg-sky-500/15 text-sky-300 text-xs font-mono font-bold px-3 py-1 rounded-full border border-sky-500/30 flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  {waitingTickets.length} بالانتظار
                </span>
              </div>

              {/* Waiting List Items */}
              <div className="py-3 flex-1 overflow-y-auto max-h-[calc(100vh-16rem)] space-y-2.5 pr-1">
                {waitingTickets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-16 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-slate-300">لا توجد أرقام في الانتظار حالياً</span>
                    <span className="text-xs text-slate-500">تمت خدمة جميع المراجعين المسجلين في الصالة</span>
                  </div>
                ) : (
                  waitingTickets.map((t, idx) => (
                    <div 
                      key={t.id}
                      className="bg-slate-950/70 border border-slate-800 hover:border-sky-500/40 rounded-2xl p-3 flex items-center justify-between shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 text-xs font-mono font-black flex items-center justify-center group-hover:bg-sky-500 group-hover:text-slate-950 transition-colors">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-lg font-mono font-black text-white group-hover:text-sky-300 transition-colors">
                            {t.displayNumber}
                          </div>
                          <div className="text-xs text-slate-400">
                            {t.categoryNameArabic}
                          </div>
                        </div>
                      </div>

                      <div className="text-left">
                        <div className="text-[11px] font-mono text-slate-400">
                          {new Date(t.createdAt).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60">
                          قيد الانتظار
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {waitingTickets.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>إجمالي المنتظرين في الصالة:</span>
                  <span className="font-mono font-bold text-sky-400 text-sm">{waitingTickets.length}</span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* EYE-CATCHING RECALL OVERLAY MODAL (إشعار إعادة النداء الفوري والملفت للأنظار) */}
      {/* ======================================================== */}
      {activeRecall && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative max-w-2xl sm:max-w-3xl w-full bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950 border-4 border-rose-500 rounded-3xl p-6 sm:p-10 shadow-[0_0_100px_rgba(244,63,94,0.7)] text-center overflow-hidden">
            
            {/* Blinking Ambient Background Glows */}
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-rose-500/25 rounded-full blur-3xl animate-ping pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-amber-500/25 rounded-full blur-3xl animate-pulse pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={() => setActiveRecall(null)}
              className="absolute top-4 left-4 p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer z-10 border border-slate-700 active:scale-95"
              title="إغلاق التنبيه"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Top Attention Badge */}
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-rose-600 text-white font-black text-xs sm:text-sm shadow-xl shadow-rose-600/50 border-2 border-rose-300 animate-bounce mb-4">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
              </span>
              <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span>
                {activeRecall.recallCount && activeRecall.recallCount >= 3
                  ? 'إعادة نداء عاجل (النداء 3 من 3 – الأخير قبل تجاوز الدور)'
                  : `إعادة نداء عاجل للمراجع (النداء ${activeRecall.recallCount || 1} من 3)`}
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-rose-200 tracking-wide mb-2">
              يرجى انتباه المراجع صاحب رقم الدور التالي:
            </h3>

            {/* Giant Number Display Box */}
            <div className="my-3 py-4 sm:py-6 bg-slate-950/70 border-2 border-rose-500/50 rounded-3xl shadow-inner relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent animate-pulse" />
              
              <div className="text-7xl sm:text-8xl md:text-9xl font-black font-mono tracking-widest text-rose-400 drop-shadow-[0_0_35px_rgba(244,63,94,0.9)] animate-pulse">
                {activeRecall.ticket.displayNumber}
              </div>

              <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs sm:text-sm font-bold">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>نوع المعاملة: {activeRecall.ticket.categoryNameArabic}</span>
              </div>
            </div>

            {/* Target Counter Destination Box */}
            <div className="mt-5 p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-2 border-amber-400 rounded-3xl shadow-2xl space-y-2">
              <div className="text-xs sm:text-sm font-black text-amber-300 flex items-center justify-center gap-2">
                <ArrowDown className="w-5 h-5 text-amber-400 animate-bounce" />
                <span>يرجى التوجه فوراً وبشكل عاجل إلى:</span>
                <ArrowDown className="w-5 h-5 text-amber-400 animate-bounce" />
              </div>

              <div className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md py-1">
                <span className="text-amber-400">{activeRecall.counter}</span>
              </div>

              {activeRecall.ticket.staffName && (
                <div className="text-xs sm:text-sm text-slate-300 pt-2 border-t border-slate-800/80 font-medium flex items-center justify-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>مندوب الوكالات المسؤول: <strong className="text-white">{activeRecall.ticket.staffName}</strong></span>
                </div>
              )}
            </div>

            {/* Progress Countdown Bar */}
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono font-bold">
                <span className="flex items-center gap-1.5 text-rose-300">
                  <BellRing className="w-3.5 h-3.5 animate-spin" /> تنبيه نشط على شاشة الصالة
                </span>
                <span>يختفي التنبيه تلقائياً خلال: {recallRemaining} ث</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(recallRemaining / 10) * 100}%` }}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Bottom Footer Bar with clock, ticker and discrete controls */}
      <footer className="bg-slate-900/95 border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3 mt-3 shadow-2xl">
        {/* Right side (RTL): Clock & Department */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-mono text-sm font-bold text-amber-300">
              {currentTime.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[10px] text-slate-400 border-r border-slate-800 pr-2 hidden md:inline">
              {currentTime.toLocaleDateString('ar-SY', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{settings.departmentTitle || 'دائرة الوكالات – نقابة المحامين بحلب'}</span>
          </div>
        </div>

        {/* Center: Live Ticker */}
        <div className="flex-1 overflow-hidden mx-2 hidden md:block">
          <div className="animate-marquee whitespace-nowrap font-medium text-slate-300 text-xs">
            {settings.tickerMessage || 'يرجى الانتباه إلى أرقام الدور وظهورها على شاشة الشبابيك عند النداء الصوتي. أهلاً بكم في نقابة المحامين بحلب.'}
          </div>
        </div>

        {/* Left side: Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Display Mode Toggle */}
          <button
            onClick={() => setDisplayMode(prev => prev === 'all' ? 'serving-only' : 'all')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
            title="إظهار أو إخفاء قائمة الانتظار"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">{displayMode === 'all' ? 'الشبابيك فقط' : 'إظهار قائمة الانتظار'}</span>
          </button>

          {/* Test Recall Button */}
          <button
            onClick={handleTriggerTestRecall}
            className="px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-all flex items-center gap-1 cursor-pointer"
            title="تجربة ظهور إشعار إعادة النداء"
          >
            <Megaphone className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden lg:inline">تجربة نداء</span>
          </button>

          {/* Audio Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              audioEnabled ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="تفعيل أو كتم التنبيه الصوتي"
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold border border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
            title={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-amber-400" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden lg:inline">{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
          </button>

          {/* Exit Button back to App */}
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-700 bg-slate-800/80 hover:bg-rose-900/40 hover:border-rose-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              title="العودة للقائمة الرئيسية"
            >
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span>خروج</span>
            </button>
          )}
        </div>
      </footer>

    </div>
  );
};
