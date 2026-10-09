/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Building2, 
  Ticket, 
  Tv, 
  Users, 
  ShieldAlert, 
  Wifi, 
  QrCode, 
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { resolveBaseUrl, resolveAgentUrl, copyToClipboard } from '../utils/network';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: 'home' | 'kiosk' | 'display' | 'staff' | 'admin') => void;
  connected: boolean;
  localIPs: string[];
  port: number;
  serverAppUrl?: string;
  waitingCount: number;
  departmentTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  connected,
  localIPs,
  port,
  serverAppUrl,
  waitingCount,
  departmentTitle
}) => {
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl = resolveBaseUrl(localIPs, port, serverAppUrl);
  const agentUrl = resolveAgentUrl(baseUrl);

  const handleCopy = async () => {
    const success = await copyToClipboard(agentUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <>
      <header className="bg-slate-900 text-white shadow-md border-b border-amber-600/30 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Brand Zone */}
            <div 
              onClick={() => setCurrentTab('home')}
              className="flex items-center gap-3 cursor-pointer select-none"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg border border-amber-400/40">
                <Building2 className="w-7 h-7 text-slate-950" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
                  {departmentTitle || 'نقابة المحامين بحلب'}
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30">دائرة الوكالات</span>
                  <span className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded-md font-bold">الإصدار 2</span>
                </div>
                <div className="text-xs text-slate-400">نظام إدارة الدور والانتظار (محلي لحظي عبر Wi-Fi)</div>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="hidden xl:flex items-center gap-1 text-sm font-medium">
              <button
                onClick={() => setCurrentTab('home')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  currentTab === 'home' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Wifi className="w-4 h-4" />
                شبكة Wi-Fi و QR
              </button>
              
              <button
                onClick={() => setCurrentTab('kiosk')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  currentTab === 'kiosk' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Ticket className="w-4 h-4" />
                جهاز إصدار التذاكر
              </button>

              <button
                onClick={() => setCurrentTab('display')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 relative ${
                  currentTab === 'display' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Tv className="w-4 h-4" />
                شاشة العرض الرئيسية
                {waitingCount > 0 && (
                  <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                    {waitingCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setCurrentTab('staff')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  currentTab === 'staff' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4 text-amber-400" />
                بوابة المندوب (الهاتف)
              </button>

              <button
                onClick={() => setCurrentTab('admin')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  currentTab === 'admin' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                صلاحيات المدير الكاملة
              </button>
            </nav>

            {/* Connection & Agent QR Quick Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-md border border-amber-400/40 transition-all active:scale-95"
                title="عرض رمز QR لمندوبي الوكالات من الهاتف"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden md:inline">رمز الهاتف للمندوب</span>
                <span className="md:hidden">كود الهاتف</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-slate-300 font-mono text-[11px] truncate max-w-[140px]" title={baseUrl}>
                  {baseUrl.replace(/^https?:\/\//, '')}
                </span>
              </div>
            </div>

          </div>

          {/* Mobile Bottom Navigation Bar */}
          <div className="flex xl:hidden overflow-x-auto py-2 gap-1.5 border-t border-slate-800 text-xs scrollbar-none">
            <button
              onClick={() => setCurrentTab('home')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 ${currentTab === 'home' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
            >
              <Wifi className="w-3.5 h-3.5" /> الشبكة
            </button>
            <button
              onClick={() => setCurrentTab('staff')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 ${currentTab === 'staff' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400" /> المندوب (/agent)
            </button>
            <button
              onClick={() => setCurrentTab('kiosk')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 ${currentTab === 'kiosk' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
            >
              <Ticket className="w-3.5 h-3.5" /> إصدار دور
            </button>
            <button
              onClick={() => setCurrentTab('display')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 ${currentTab === 'display' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
            >
              <Tv className="w-3.5 h-3.5" /> الشاشة
            </button>
            <button
              onClick={() => setCurrentTab('admin')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 ${currentTab === 'admin' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
            >
              <ShieldAlert className="w-3.5 h-3.5" /> المدير
            </button>
          </div>

        </div>
      </header>

      {/* QUICK AGENT QR MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center relative border border-slate-200">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pt-1">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl mx-auto flex items-center justify-center shadow-sm">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">رمز دخول المندوب من الهاتف</h3>
              <p className="text-xs text-slate-500">
                افتح كاميرا الهاتف وامسح الرمز لفتح مسار <span className="font-mono text-amber-700 font-bold">/agent</span> مباشرة
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
              <QRCodeSVG value={agentUrl} size={190} level="H" includeMargin={true} />
            </div>

            <div className="space-y-2">
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-800 break-all select-all text-center">
                {agentUrl}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'تم نسخ الرابط!' : 'نسخ الرابط'}
                </button>
                <a
                  href={agentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                  title="فتح الرابط في نافذة جديدة"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  تجربة
                </a>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 text-right bg-amber-50/70 border border-amber-200/60 p-3 rounded-xl leading-relaxed">
              💡 <strong>ملاحظة للمندوب:</strong> لا حاجة لتثبيت تطبيق من المتجر؛ يفتح المتصفح مباشرة، يختار المندوب اسمه ويدخل الرمز، ثم يحدد الشباك ويبدأ استقبال المراجعين فوراً.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
