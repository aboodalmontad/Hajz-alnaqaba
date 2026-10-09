/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  Info
} from 'lucide-react';
import { resolveBaseUrl, resolveAgentUrl, copyToClipboard } from '../utils/network';

interface NetworkGuideProps {
  localIPs: string[];
  port: number;
  serverAppUrl?: string;
  onNavigate: (tab: 'home' | 'kiosk' | 'display' | 'staff' | 'admin') => void;
}

export const NetworkGuide: React.FC<NetworkGuideProps> = ({
  localIPs,
  port,
  serverAppUrl,
  onNavigate
}) => {
  const [overrideIP, setOverrideIP] = useState<string>('');
  const [copiedAgent, setCopiedAgent] = useState(false);
  const [copiedBase, setCopiedBase] = useState(false);
  const [activeQrTarget, setActiveQrTarget] = useState<'agent' | 'display' | 'kiosk'>('agent');

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
              الإصدار 1
            </div>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            نظام إدارة دور دائرة الوكالات <br />
            <span className="text-amber-400">نقابة المحامين بحلب</span>
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            نظام لحظي مترابط يربط هواتف مندوبي الوكالات وشاشة صالة الانتظار وجهاز إصدار التذاكر عبر الخادم المحلي. يستطيع أي مندوب مسح رمز الـ QR أدناه بهاتفه لفتح واجهة العمل واختيار الشباك فوراً.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              onClick={() => onNavigate('staff')}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 text-xs sm:text-sm"
            >
              <Smartphone className="w-4 h-4" /> فتح واجهة المندوب على هذا الجهاز (/agent)
            </button>
            <button
              onClick={() => onNavigate('display')}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 text-xs border border-slate-600"
            >
              <Tv className="w-4 h-4" /> شاشة العرض
            </button>
            <button
              onClick={() => onNavigate('kiosk')}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 text-xs border border-slate-600"
            >
              <Server className="w-4 h-4" /> إصدار التذاكر
            </button>
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
