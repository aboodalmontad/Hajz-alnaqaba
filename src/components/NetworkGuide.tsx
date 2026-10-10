import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Wifi, 
  Smartphone, 
  Tv, 
  Server, 
  Copy, 
  Check, 
  ExternalLink, 
  Settings2, 
  ShieldCheck, 
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Info,
  Monitor,
  RefreshCw,
  RotateCcw,
  Trash2,
  Sparkles,
  Layers,
  Database,
  Users,
  Ticket as TicketIcon,
  TrendingUp,
  Clock,
  CheckCircle,
  Hourglass,
  Activity
} from 'lucide-react';
import { resolveBaseUrl, resolveAgentUrl, copyToClipboard } from '../utils/network';
import { clearAppCache, ClearCacheResult } from '../utils/cache';
import { Ticket, Counter, Staff } from '../types';

interface NetworkGuideProps {
  localIPs: string[];
  port: number;
  serverAppUrl?: string;
  onNavigate: (tab: 'home' | 'kiosk' | 'display' | 'staff' | 'admin') => void;
  connected?: boolean;
  onActivateServer?: () => Promise<boolean> | void;
  tickets?: Ticket[];
  counters?: Counter[];
  staffList?: Staff[];
}

export const NetworkGuide: React.FC<NetworkGuideProps> = ({
  localIPs,
  port,
  serverAppUrl,
  onNavigate,
  connected = false,
  onActivateServer,
  tickets = [],
  counters = [],
  staffList = []
}) => {
  const [overrideIP, setOverrideIP] = useState<string>('');
  const [copiedAgent, setCopiedAgent] = useState(false);
  const [copiedBase, setCopiedBase] = useState(false);
  const [activeQrTarget, setActiveQrTarget] = useState<'agent' | 'display' | 'kiosk'>('agent');
  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState<string | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheResult, setCacheResult] = useState<ClearCacheResult | null>(null);
  const [cacheMsg, setCacheMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Auto-connect and activate server as soon as the Home page is entered
  useEffect(() => {
    if (onActivateServer) {
      setActivating(true);
      Promise.resolve(onActivateServer())
        .catch(() => {})
        .finally(() => {
          setActivating(false);
        });
    }
  }, [onActivateServer]);

  const handleManualActivate = async () => {
    setActivating(true);
    setActivateMsg(null);
    try {
      if (onActivateServer) {
        await onActivateServer();
      }
      setActivateMsg('✓ تم الاتصال بالسيرفر وتحديث البيانات بنجاح!');
    } catch {
      setActivateMsg('تعذر الاتصال بالسيرفر، تأكد من تشغيل start.bat');
    } finally {
      setActivating(false);
      setTimeout(() => setActivateMsg(null), 3500);
    }
  };

  const handleClearCache = async (hardReload: boolean = false) => {
    setClearingCache(true);
    setCacheMsg(null);
    try {
      const res = await clearAppCache({ hardReload });
      setCacheResult(res);
      if (onActivateServer) {
        await onActivateServer();
      }
      if (hardReload) {
        setCacheMsg({
          text: '✓ تم مسح ذاكرة الكاش بنجاح! جاري إعادة تحميل الصفحة بنسخة جديدة تماماً...',
          type: 'success'
        });
      } else {
        setCacheMsg({
          text: `✓ تم مسح الكاش وتحديث بيانات النظام بنجاح (${res.timestamp})`,
          type: 'success'
        });
        setTimeout(() => setCacheMsg(null), 5000);
      }
    } catch (err: any) {
      console.error('Error clearing cache:', err);
      setCacheMsg({
        text: 'حدث خطأ أثناء مسح الكاش، جاري محاولة تحديث البيانات مباشرة.',
        type: 'error'
      });
      if (onActivateServer) await onActivateServer();
      setTimeout(() => setCacheMsg(null), 5000);
    } finally {
      if (!hardReload) {
        setClearingCache(false);
      }
    }
  };

  // Compute clean reachable URLs
  const baseUrl = resolveBaseUrl(localIPs, port, serverAppUrl, overrideIP);
  const agentUrl = resolveAgentUrl(baseUrl);
  const displayUrl = `${baseUrl.replace(/\/+$/, '')}/display`;
  const kioskUrl = `${baseUrl.replace(/\/+$/, '')}/kiosk`;

  const currentQrUrl = activeQrTarget === 'agent' 
    ? agentUrl 
    : activeQrTarget === 'display' 
      ? displayUrl 
      : kioskUrl;

  const currentQrTitle = activeQrTarget === 'agent'
    ? 'واجهة مندوب الوكالات من الهاتف المحمول'
    : activeQrTarget === 'display'
      ? 'شاشة العرض الرئيسية لصالة الانتظار'
      : 'جهاز إصدار التذاكر للمراجعين';

  const handleCopyAgent = async () => {
    const ok = await copyToClipboard(agentUrl);
    if (ok) {
      setCopiedAgent(true);
      setTimeout(() => setCopiedAgent(false), 2500);
    }
  };

  const handleCopyBase = async () => {
    const ok = await copyToClipboard(baseUrl);
    if (ok) {
      setCopiedBase(true);
      setTimeout(() => setCopiedBase(false), 2500);
    }
  };

  // Determine network mode text
  const isWebHosted = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1' && 
    window.location.hostname !== '::1';

  // --- Real-Time Statistics Calculations for Home Page ---
  // 1. عدد المندوبين العاملين على الشبابيك (Active staff at counters)
  const activeWorkingStaffCount = counters.filter(c => c.isOpen && !c.isPaused && Boolean(c.currentStaffId || c.currentStaffName)).length;

  // 2. إجمالي البطاقات المحجوزة (المسجلة في النظام اليوم)
  const totalBookedTicketsCount = tickets.length;

  // 3. عدد المعاملات المنجزة حتى اللحظة
  const completedTicketsCount = tickets.filter(t => t.status === 'completed').length;

  // معاملات قيد الخدمة وبانتظار النداء
  const waitingTicketsCount = tickets.filter(t => t.status === 'waiting').length;
  const servingTicketsCount = tickets.filter(t => t.status === 'serving').length;
  const skippedTicketsCount = tickets.filter(t => t.status === 'skipped').length;

  // 4. معدل الإنجاز (Completion Rate %)
  const completionRate = totalBookedTicketsCount > 0 
    ? Math.round((completedTicketsCount / totalBookedTicketsCount) * 100) 
    : 0;

  // 5. الوقت المتوسط التقريبي لإنجاز معاملة (Average Service Time)
  const avgServiceTimeMinutes = (() => {
    const servicedTickets = tickets.filter(t => {
      if (t.status !== 'completed' || !t.completedAt) return false;
      const start = t.documentingStartedAt || t.calledAt;
      return Boolean(start);
    });

    if (servicedTickets.length === 0) {
      // إذا لم تكتمل بعد أي معاملة بتوقيتات دقيقة، عرض تقدير افتراضي مبني على وتيرة العمل أو التقدير الطبيعي (مثلاً 4 دقائق)
      return totalBookedTicketsCount > 0 && completedTicketsCount > 0 ? 4 : 0;
    }

    const totalDurationSeconds = servicedTickets.reduce((acc, t) => {
      const start = new Date(t.documentingStartedAt || t.calledAt!).getTime();
      const end = new Date(t.completedAt!).getTime();
      const diffSec = Math.max(30, Math.round((end - start) / 1000));
      // تصفية القيم الشاذة جداً (أكثر من ساعتين مثلاً)
      return acc + (diffSec > 7200 ? 300 : diffSec);
    }, 0);

    const avgSeconds = Math.round(totalDurationSeconds / servicedTickets.length);
    return Math.max(1, Math.round(avgSeconds / 60));
  })();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Hero Welcome Card */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-500/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/30">
              <Wifi className="w-3.5 h-3.5" /> شبكة Wi-Fi المحلية (تعمل بدون اتصال إنترنت)
            </div>
            <div className="inline-flex items-center gap-1.5 bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-amber-400/40">
              الإصدار 5
            </div>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            نظام إدارة دور دائرة الوكالات <br />
            <span className="text-amber-400">نقابة المحامين بحلب</span>
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            نظام لحظي مترابط يربط هواتف مندوبي الوكالات وشاشة صالة الانتظار وجهاز إصدار التذاكر عبر الخادم المحلي. يستطيع أي مندوب مسح رمز الـ QR أدناه بهاتفه لفتح واجهة العمل واختيار الشباك فوراً.
          </p>

          {/* Real-time Server Connection Status & Activation Bar */}
          <div className="bg-slate-950/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${connected ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse' : activating ? 'bg-amber-400 animate-spin' : 'bg-rose-500'}`} />
              <div className="text-right">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  {connected ? (
                    <span className="text-emerald-300 font-extrabold">السيرفر المحلي متصل ونشط ومفعّل الآن</span>
                  ) : activating ? (
                    <span className="text-amber-300">جارِ الاتصال بالسيرفر وتفعيله...</span>
                  ) : (
                    <span className="text-rose-400">غير متصل بالسيرفر المحلي</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {baseUrl}
                </div>
              </div>
            </div>

            {/* Action Buttons Zone: Refresh & Clear Cache + Check Connection */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                onClick={() => handleClearCache(false)}
                disabled={clearingCache || activating}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer border border-amber-400/40"
                title="مسح ذاكرة التخزين المؤقت (الكاش) وتحديث بيانات النظام فوراً"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${clearingCache ? 'animate-spin' : ''}`} />
                <span>{clearingCache ? 'جارِ مسح الكاش والتحديث...' : 'تحديث ومسح الكاش'}</span>
              </button>

              <button
                onClick={handleManualActivate}
                disabled={activating || clearingCache}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-700 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                title="فحص الاتصال بالسيرفر المحلي"
              >
                <Wifi className={`w-3.5 h-3.5 ${activating ? 'animate-pulse text-amber-400' : 'text-emerald-400'}`} />
                <span className="hidden sm:inline">{activating ? 'جارِ الفحص...' : 'فحص السيرفر'}</span>
              </button>
            </div>
          </div>

          {/* Cache & Action Feedback Alerts */}
          {cacheMsg && (
            <div className={`text-xs font-bold p-3 rounded-xl border flex items-center justify-center gap-2 animate-fade-in ${cacheMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'}`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{cacheMsg.text}</span>
            </div>
          )}

          {activateMsg && !cacheMsg && (
            <div className={`text-xs font-bold p-2.5 rounded-xl text-center border animate-fade-in ${activateMsg.startsWith('✓') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
              {activateMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              onClick={() => onNavigate('staff')}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 text-xs sm:text-sm active:scale-95 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" /> فتح واجهة المندوب على هذا الجهاز (/agent)
            </button>
            <button
              onClick={() => onNavigate('display')}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 text-xs border border-slate-600 active:scale-95 cursor-pointer"
            >
              <Tv className="w-4 h-4" /> شاشة العرض
            </button>
            <button
              onClick={() => onNavigate('kiosk')}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 text-xs border border-slate-600 active:scale-95 cursor-pointer"
            >
              <Server className="w-4 h-4" /> إصدار التذاكر
            </button>

            {/* Quick Hard Reload & Clean Cache Button */}
            <button
              onClick={() => handleClearCache(true)}
              disabled={clearingCache}
              className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-amber-300 hover:text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 text-xs border border-amber-500/30 active:scale-95 cursor-pointer"
              title="إعادة تحميل نظيفة مع مسح كامل لملفات الكاش في المتصفح"
            >
              <RotateCcw className={`w-4 h-4 text-amber-400 ${clearingCache ? 'animate-spin' : ''}`} />
              <span>إعادة تحميل نظيفة (Hard Refresh)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: REAL-TIME OPERATION STATISTICS (إحصائيات التشغيل والعمل اللحظية) */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                إحصائيات ومؤشرات التشغيل المباشرة
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                متابعة لحظية ومحدثة مباشرة لنشاط الشبابيك والمعاملات المنجزة والمحجوزة
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 self-start sm:self-auto bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-3 py-1 rounded-full text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>تحديث مباشر متزامن</span>
          </div>
        </div>

        {/* 5 Primary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          
          {/* 1. عدد المندوبين العاملين على الشبابيك */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md border-2 border-slate-100 hover:border-blue-400/50 transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors pointer-events-none" />
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-bold text-slate-600 leading-tight">
                المندوبين العاملين على الشبابيك
              </span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-3xl font-black font-mono text-blue-600 tracking-tight">
                {activeWorkingStaffCount}
                <span className="text-xs font-sans font-bold text-slate-400 mr-1.5">مندوب</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <span>إجمالي الشبابيك المتاحة:</span>
                <strong className="text-slate-700 font-mono">{counters.filter(c => c.isOpen).length}</strong>
              </div>
            </div>
          </div>

          {/* 2. عدد البطاقات المحجوزة */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md border-2 border-slate-100 hover:border-amber-400/50 transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors pointer-events-none" />
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-bold text-slate-600 leading-tight">
                البطاقات المحجوزة اليوم
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <TicketIcon className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-3xl font-black font-mono text-amber-600 tracking-tight">
                {totalBookedTicketsCount}
                <span className="text-xs font-sans font-bold text-slate-400 mr-1.5">بطاقة</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                <span className="text-amber-700 font-bold">{waitingTicketsCount} قيد الانتظار</span>
                <span>·</span>
                <span className="text-blue-700 font-bold">{servingTicketsCount} قيد الخدمة</span>
              </div>
            </div>
          </div>

          {/* 3. معدل الإنجاز */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md border-2 border-slate-100 hover:border-indigo-400/50 transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-bold text-slate-600 leading-tight">
                معدل الإنجاز
              </span>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="text-3xl font-black font-mono text-indigo-600 tracking-tight flex items-baseline gap-1">
                <span>{completionRate}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }} 
                />
              </div>
            </div>
          </div>

          {/* 4. الوقت المتوسط التقريبي لإنجاز معاملة */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md border-2 border-slate-100 hover:border-cyan-400/50 transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-colors pointer-events-none" />
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-bold text-slate-600 leading-tight">
                متوسط وقت إنجاز المعاملة
              </span>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100">
                <Clock className="w-5 h-5 text-cyan-600" />
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-3xl font-black font-mono text-cyan-700 tracking-tight">
                {avgServiceTimeMinutes > 0 ? avgServiceTimeMinutes : '—'}
                {avgServiceTimeMinutes > 0 && <span className="text-xs font-sans font-bold text-slate-400 mr-1.5">دقيقة</span>}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {avgServiceTimeMinutes > 0 ? 'تقريبي لكل معاملة' : 'قيد القياس مع إنجاز المعاملات'}
              </div>
            </div>
          </div>

          {/* 5. عدد المعاملات المنجزة حتى اللحظة */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md border-2 border-slate-100 hover:border-emerald-400/50 transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-bold text-slate-600 leading-tight">
                المعاملات المنجزة حتى اللحظة
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-3xl font-black font-mono text-emerald-600 tracking-tight">
                {completedTicketsCount}
                <span className="text-xs font-sans font-bold text-slate-400 mr-1.5">معاملة</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                {skippedTicketsCount > 0 ? (
                  <span className="text-slate-600">{skippedTicketsCount} تجاوز لعدم الحضور</span>
                ) : (
                  <span className="text-emerald-700 font-medium">تم توثيقها بنجاح</span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* PRIMARY CARD: AGENT QR CODE & DIRECT ROUTE */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-amber-500/40 relative overflow-hidden space-y-6">
        
        {/* Header of Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-100 px-3 py-1 rounded-full text-xs font-bold">
              <Smartphone className="w-3.5 h-3.5" /> الرابط المباشر لمندوب الوكالات
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              رمز QR ودخول المندوب من الهاتف المحمول (<span className="font-mono text-amber-600 text-lg">/agent</span>)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              امسح الكود بكاميرا الهاتف للوصول الفوري لصفحة تسجيل الدخول، ثم اختيار الشباك، ثم استقبال المراجعين
            </p>
          </div>

          {/* Quick Target Switcher */}
          <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 self-start md:self-auto text-xs font-bold">
            <button
              onClick={() => setActiveQrTarget('agent')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeQrTarget === 'agent' 
                  ? 'bg-amber-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> هاتف المندوب
            </button>
            <button
              onClick={() => setActiveQrTarget('display')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeQrTarget === 'display' 
                  ? 'bg-amber-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tv className="w-3.5 h-3.5" /> شاشة الصالة
            </button>
            <button
              onClick={() => setActiveQrTarget('kiosk')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeQrTarget === 'kiosk' 
                  ? 'bg-amber-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5" /> إصدار التذاكر
            </button>
          </div>
        </div>

        {/* QR Code and URL Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* QR Code Visual Box */}
          <div className="md:col-span-5 lg:col-span-4 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-amber-50/30 rounded-3xl border border-slate-200 shadow-inner space-y-4">
            <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-100">
              <QRCodeSVG 
                value={currentQrUrl} 
                size={220} 
                level="H" 
                includeMargin={true}
              />
            </div>
            <div className="text-center space-y-1">
              <span className="text-xs font-extrabold text-slate-800 flex items-center justify-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                {currentQrTitle}
              </span>
              <p className="text-[11px] text-slate-500">افتح كاميرا الهاتف واضغط على الرابط المكتشف</p>
            </div>
          </div>

          {/* URL & Connect Details */}
          <div className="md:col-span-7 lg:col-span-8 space-y-5">
            
            {/* Direct URL Box */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>رابط الوصول المباشر (يمكن نسخه أو كتابته في متصفح الهاتف):</span>
                <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  {isWebHosted ? '🌐 عنوان النشر المباشر' : '📶 شبكة Wi-Fi المحلية'}
                </span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <div className="flex-1 bg-slate-900 text-amber-400 font-mono text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-700 break-all select-all flex items-center justify-between shadow-inner">
                  <span>{currentQrUrl}</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={activeQrTarget === 'agent' ? handleCopyAgent : handleCopyBase}
                    className="flex-1 sm:flex-none px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    {(activeQrTarget === 'agent' ? copiedAgent : copiedBase) ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>نسخ الرابط</span>
                      </>
                    )}
                  </button>

                  <a
                    href={currentQrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 border border-slate-200 transition-all"
                    title="فتح هذا المسار في نافذة متصفح جديدة للتجربة"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>فتح للتجربة</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Network Source Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-600" />
                  مصدر العنوان والشبكة المتصلة
                </span>
                <span className="text-[11px] font-mono text-slate-500">Port: {port}</span>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed">
                {isWebHosted ? (
                  <p>
                    التطبيق يعمل على نطاق مباشر. يمكن لأي هاتف محمول متصل بالإنترنت أو بالشبكة الوصول إلى الرابط فورياً دون إعدادات شبكة إضافية.
                  </p>
                ) : (
                  <p>
                    يعمل التطبيق محلياً. تأكد من أن هاتف المندوب متصل بنفس راوتر شبكة Wi-Fi الذي يتصل به كمبيوتر الخادم الرئيسي. لا يُستخدم عنوان <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono">127.0.0.1</code> أو <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono">localhost</code> لأن الهاتف لا يستطيع الاتصال بهما.
                  </p>
                )}
              </div>

              {/* IP Selection / Custom Override */}
              {localIPs.length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700">عناوين الـ IP المتاحة للكمبيوتر:</span>
                  {localIPs.map(ip => (
                    <button
                      key={ip}
                      onClick={() => setOverrideIP(ip)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                        (overrideIP === ip || (!overrideIP && baseUrl.includes(ip)))
                          ? 'bg-amber-600 text-white border-amber-600 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {ip}
                    </button>
                  ))}
                  {overrideIP && (
                    <button
                      onClick={() => setOverrideIP('')}
                      className="text-[11px] text-red-600 hover:underline px-2 py-0.5"
                    >
                      إعادة التعيين للعنوان التلقائي
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick 4 Steps for Delegates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-center">
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-1">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold inline-flex items-center justify-center">1</span>
                <div className="text-xs font-bold text-slate-800">مسح الرمز</div>
                <div className="text-[10px] text-slate-500">بكاميرا الهاتف</div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-1">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold inline-flex items-center justify-center">2</span>
                <div className="text-xs font-bold text-slate-800">تسجيل الدخول</div>
                <div className="text-[10px] text-slate-500">اسم الموظف و PIN</div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-1">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold inline-flex items-center justify-center">3</span>
                <div className="text-xs font-bold text-slate-800">اختيار الشباك</div>
                <div className="text-[10px] text-slate-500">تحديد شباك متاح</div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-1">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold inline-flex items-center justify-center">4</span>
                <div className="text-xs font-bold text-slate-800">بدء الاستدعاء</div>
                <div className="text-[10px] text-slate-500">خدمة المراجعين فوراً</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* DEDICATED CACHE & REFRESH CONTROL SECTION */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-100 px-3 py-1 rounded-full text-xs font-bold">
              <RotateCcw className="w-3.5 h-3.5" /> صيانة النظام وتحديث البيانات
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              تحديث ومسح ذاكرة التخزين المؤقت (Cache)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              استخدم هذه الأداة لتنظيف ملفات المتصفح المؤقتة وإجبار التطبيق على تحميل أحدث نسخة من الخادم وتحديث حالة الأدوار والشبابيك فوراً
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
              connected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {connected ? 'الخادم نشط ومتزامن' : 'الخادم غير متصل'}
            </span>
          </div>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Action 1: In-place Cache Clear & Data Refresh */}
          <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 rounded-2xl p-5 border border-amber-200/80 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                  <RefreshCw className={`w-5 h-5 ${clearingCache ? 'animate-spin' : ''}`} />
                </span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                  لحظي دون إعادة تحميل
                </span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">
                مسح الكاش وتحديث البيانات اللحظية
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                يمسح الذاكرة المؤقتة لطلبات الشبكة ويعيد جلب أحدث قائمة للتذاكر وحالات الموظفين والشبابيك فورياً دون مقاطعة استخدامك للصفحة.
              </p>
            </div>

            <button
              onClick={() => handleClearCache(false)}
              disabled={clearingCache || activating}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${clearingCache ? 'animate-spin' : ''}`} />
              <span>{clearingCache ? 'جارِ مسح الكاش والتحديث...' : 'مسح الكاش وتحديث البيانات الآن'}</span>
            </button>
          </div>

          {/* Action 2: Full Hard Refresh & Clean Reload */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 border border-slate-700 flex flex-col justify-between space-y-4 shadow-md">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-bold shadow-sm">
                  <RotateCcw className={`w-5 h-5 ${clearingCache ? 'animate-spin' : ''}`} />
                </span>
                <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  إعادة تحميل كاملة (Hard Reload)
                </span>
              </div>
              <h3 className="font-extrabold text-white text-base">
                تحديث شامل ومسح كامل للكاش
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                يمسح Cache Storage، يلغي برمجيات Service Workers القديمة، ثم يجبر المتصفح على تنزيل أحدث ملفات التطبيق من السيرفر كنسخة جديدة 100%.
              </p>
            </div>

            <button
              onClick={() => handleClearCache(true)}
              disabled={clearingCache}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${clearingCache ? 'animate-spin' : ''}`} />
              <span>{clearingCache ? 'جارِ المسح والتحميل...' : 'تحديث ومسح الكاش (إعادة تحميل نظيفة)'}</span>
            </button>
          </div>

        </div>

        {/* Clear Cache Details Info Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>متى يُنصح باستخدام مسح الكاش؟</strong> عند تعديل أسماء الشبابيك أو فئات المعاملات، أو إذا لاحظ أحد مندوبي الوكالات عدم تحديث رقمه على الشاشة.
            </span>
          </div>
          {cacheResult && (
            <div className="shrink-0 bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-xl text-[11px] border border-emerald-200 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              تم مسح {cacheResult.cachesCleared} مستودع كاش بنجاح ({cacheResult.timestamp})
            </div>
          )}
        </div>
      </div>

      {/* Network Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Main Server */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
            <Server className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">الخادم المحلي الرئيسي</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            الكمبيوتر الرئيسي المثبت في الدائرة يشغل الخادم وقاعدة البيانات المحلية ومزامنة WebSocket اللحظية على المنفذ {port}.
          </p>
        </div>

        {/* Card 2: Staff Mobile */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">هواتف مندوبي الوكالات</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            يعمل كل مندوب من متصفح هاتفه المحمول مباشرة عبر مسار <code className="font-mono bg-slate-100 px-1 text-amber-700">/agent</code> دون أي تطبيق خارجي مع تحديث فوري لحالة الشباك.
          </p>
        </div>

        {/* Card 3: Waiting Hall TV */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
            <Tv className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">شاشة صالة الانتظار</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            تفتح الشاشة الكبيرة في الصالة على مسار <code className="font-mono bg-slate-100 px-1 text-blue-700">/display</code> لتعرض الأدوار والنداء الصوتي بوضوح للمراجعين.
          </p>
        </div>

      </div>

    </div>
  );
};
