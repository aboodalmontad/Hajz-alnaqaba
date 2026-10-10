/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Lock, 
  UserCheck, 
  CheckCircle, 
  Volume2, 
  SkipForward, 
  RotateCcw, 
  Play, 
  Square, 
  LogOut, 
  AlertCircle,
  Building2,
  Clock,
  PhoneCall,
  ArrowRightLeft,
  PauseCircle,
  FileCheck2,
  Check,
  AlertTriangle,
  X,
  Home
} from 'lucide-react';
import { Staff, Counter, Ticket } from '../types';

interface StaffPortalProps {
  staffList: Staff[];
  counters: Counter[];
  tickets: Ticket[];
  onCallNext: (staffId: string, counterId: string) => Promise<any>;
  onRecall: (ticketId: string, staffId: string) => Promise<any>;
  onComplete: (ticketId: string, staffId: string) => Promise<any>;
  onSkip: (ticketId: string, notes: string) => Promise<any>;
  onReturnQueue: (ticketId: string) => Promise<any>;
  onNavigateHome?: () => void;
  departmentTitle?: string;
}

export const StaffPortal: React.FC<StaffPortalProps> = ({
  staffList,
  counters,
  tickets,
  onCallNext,
  onRecall,
  onComplete,
  onSkip,
  onReturnQueue,
  onNavigateHome,
  departmentTitle
}) => {
  // Login form state
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Authenticated staff state
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(() => {
    const saved = sessionStorage.getItem('agency_current_staff');
    return saved ? JSON.parse(saved) : null;
  });

  // Selected counter for claim screen
  const [selectedCounterId, setSelectedCounterId] = useState<string>('');
  const [counterClaimError, setCounterClaimError] = useState('');
  const [counterClaimLoading, setCounterClaimLoading] = useState(false);

  // Active desk modal states
  const [skipModal, setSkipModal] = useState(false);
  const [skipNotes, setSkipNotes] = useState('');
  const [releaseWarningModal, setReleaseWarningModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync currentStaff from props if updated
  useEffect(() => {
    if (currentStaff) {
      const updated = staffList.find(s => s.id === currentStaff.id);
      if (updated) {
        setCurrentStaff(prev => ({ ...prev!, ...updated }));
        sessionStorage.setItem('agency_current_staff', JSON.stringify({ ...currentStaff, ...updated }));
      }
    }
  }, [staffList]);

  // Handle staff login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!selectedStaffId) {
      setLoginError('يرجى اختيار اسم الموظف من القائمة.');
      return;
    }
    if (!pin) {
      setLoginError('يرجى إدخال الرمز الشخصي (PIN).');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: selectedStaffId, pin })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تسجيل الدخول.');
      }

      setCurrentStaff(data.staff);
      sessionStorage.setItem('agency_current_staff', JSON.stringify(data.staff));
      setPin('');
      showToast('success', `مرحباً بك يا زميل ${data.staff.name}`);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle staff logout
  const handleLogout = () => {
    // If working on counter, warn before leaving
    const claimedCounter = counters.find(c => c.currentStaffId === currentStaff?.id);
    if (claimedCounter) {
      const activeTicket = tickets.find(t => t.staffId === currentStaff?.id && t.status === 'serving');
      if (activeTicket) {
        alert('لديك معاملة جارية حالياً، يرجى إنهاء الخدمة أو تجاوز الدور قبل تسجيل الخروج.');
        return;
      }
    }

    setCurrentStaff(null);
    sessionStorage.removeItem('agency_current_staff');
    setSelectedCounterId('');
  };

  // Handle Claiming Counter
  const handleClaimCounter = async (counterIdToClaim: string) => {
    if (!currentStaff) return;
    setCounterClaimError('');
    setCounterClaimLoading(true);

    try {
      const res = await fetch('/api/staff/claim-counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: currentStaff.id,
          counterId: counterIdToClaim
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر حجز الشباك.');
      }

      // Update local current staff counterId
      const updatedStaff = { ...currentStaff, counterId: data.counter.id };
      setCurrentStaff(updatedStaff);
      sessionStorage.setItem('agency_current_staff', JSON.stringify(updatedStaff));

      showToast('success', data.message || 'تم حجز الشباك بنجاح، يمكنك بدء العمل.');
    } catch (err: any) {
      setCounterClaimError(err.message);
    } finally {
      setCounterClaimLoading(false);
    }
  };

  // Handle Releasing Counter (إنهاء العمل على الشباك)
  const handleReleaseCounter = async () => {
    if (!currentStaff || !activeCounter) return;

    // Check if there is an active serving ticket
    const activeServing = tickets.find(t => t.staffId === currentStaff.id && t.status === 'serving');
    if (activeServing) {
      setReleaseWarningModal(true);
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/staff/release-counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: currentStaff.id,
          counterId: activeCounter.id
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنهاء العمل على الشباك.');
      }

      const updatedStaff = { ...currentStaff, counterId: '' };
      setCurrentStaff(updatedStaff);
      sessionStorage.setItem('agency_current_staff', JSON.stringify(updatedStaff));
      setSelectedCounterId('');

      showToast('success', data.message || 'تم تحرير الشباك، يمكنك اختيار شباك آخر.');
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Pause (استراحة مؤقتة)
  const handleTogglePause = async () => {
    if (!currentStaff || !activeCounter) return;
    try {
      const res = await fetch('/api/staff/toggle-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: currentStaff.id,
          counterId: activeCounter.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت العملية.');
      showToast('success', data.message);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Call Next Ticket
  const handleCallNext = async () => {
    if (!currentStaff || !activeCounter) return;
    setActionLoading(true);
    try {
      await onCallNext(currentStaff.id, activeCounter.id);
      showToast('success', 'تم استدعاء المراجع وظهوره على الشاشة.');
    } catch (err: any) {
      showToast('error', err.message || 'حدث خطأ أثناء استدعاء الدور.');
    } finally {
      setActionLoading(false);
    }
  };

  // Recall Ticket
  const handleRecall = async () => {
    if (!myServingTicket || !currentStaff) return;
    try {
      await onRecall(myServingTicket.id, currentStaff.id);
      showToast('success', 'تمت إعادة النداء الصوتي على الشاشة.');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Complete Service
  const handleComplete = async () => {
    if (!myServingTicket || !currentStaff) return;
    try {
      await onComplete(myServingTicket.id, currentStaff.id);
      showToast('success', 'تم إنهاء توثيق المعاملة بنجاح.');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Skip Ticket
  const handleSkipSubmit = async () => {
    if (!myServingTicket) return;
    try {
      await onSkip(myServingTicket.id, skipNotes);
      setSkipModal(false);
      setSkipNotes('');
      showToast('success', 'تم تجاوز دور المراجع لعدم الحضور.');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // ==============================================================
  // VIEW 1: LOGIN SCREEN
  // ==============================================================
  if (!currentStaff) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 sm:py-12">
        {onNavigateHome && (
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm transition-all active:scale-95"
            >
              <Home className="w-4 h-4 text-amber-600" />
              العودة للرئيسية
            </button>
            <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-bold">
              مسار الهاتف: /agent
            </span>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg border border-amber-400">
              <Users className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">بوابة مندوب الوكالات</h1>
            <p className="text-xs text-slate-500 font-medium">
              {departmentTitle || 'دائرة الوكالات – نقابة المحامين بحلب'}
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 leading-relaxed text-right">
            قم باختيار اسمك وإدخال رمزك الشخصي (PIN) للبدء، ثم ستتمكن من اختيار الشباك المتاح الذي ستعمل عليه اليوم.
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">اختر اسم الموظف / المندوب:</label>
              <select
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                required
              >
                <option value="">-- اضغط للاختيار --</option>
                {staffList.filter(s => s.role === 'staff').map(s => (
                  <option key={s.id} value={s.id} disabled={!s.active}>
                    {s.name} ({s.jobTitle || 'مندوب وكالات'}) {!s.active ? ' [موقف إدارياً]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">الرمز الشخصي (PIN):</label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="أدخل الرمز الشخصي (4-6 أرقام)"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tracking-widest text-center"
                />
                <Lock className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
            >
              {loginLoading ? 'جارِ التحقق...' : 'تسجيل الدخول واختيار الشباك'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Find if current staff is currently claiming a counter
  const activeCounter = counters.find(c => c.currentStaffId === currentStaff.id);
  const waitingTickets = tickets.filter(t => t.status === 'waiting');
  const myServingTicket = tickets.find(t => t.staffId === currentStaff.id && t.status === 'serving');

  // ==============================================================
  // VIEW 2: CHOOSE COUNTER SCREEN (اختيار الشباك الذي ستعمل عليه)
  // ==============================================================
  if (!activeCounter) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        
        {/* Toast */}
        {toastMessage && (
          <div className={`p-4 rounded-2xl shadow-lg text-xs font-bold flex items-center justify-between ${
            toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Delegate Header */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-600 rounded-2xl flex items-center justify-center font-bold text-lg border border-amber-400">
              {currentStaff.name.charAt(0)}
            </div>
            <div>
              <div className="text-base font-bold">{currentStaff.name}</div>
              <div className="text-xs text-amber-400">مندوب وكالات معتمد</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs flex items-center gap-1.5 transition-all"
                title="العودة للرئيسية"
              >
                <Home className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">الرئيسية</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs flex items-center gap-1.5 transition-all"
              title="خروج"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>

        {/* Counter Selection Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              اختر الشباك الذي ستعمل عليه
            </h2>
            <p className="text-xs text-slate-500">
              حدد الشباك المتاح الذي تجلس أمامه في الصالة لبدء استقبال المراجعين
            </p>
          </div>

          {counterClaimError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{counterClaimError}</span>
            </div>
          )}

          {/* Counters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {counters.map(counter => {
              const isOccupiedByOther = counter.currentStaffId && counter.currentStaffId !== currentStaff.id;
              const isClosed = !counter.isOpen;
              const isAllowed = !currentStaff.allowedCounterIds || currentStaff.allowedCounterIds.length === 0 || currentStaff.allowedCounterIds.includes(counter.id);
              const isAvailable = !isOccupiedByOther && !isClosed && isAllowed;
              const isSelected = selectedCounterId === counter.id;

              let statusBadge = {
                text: 'متاح للاستلام',
                bg: 'bg-emerald-100 text-emerald-800 border-emerald-200'
              };

              if (isClosed) {
                statusBadge = { text: 'مغلق من الإدارة', bg: 'bg-red-100 text-red-800 border-red-200' };
              } else if (isOccupiedByOther) {
                statusBadge = { text: `يعمل عليه: ${counter.currentStaffName || 'مندوب آخر'}`, bg: 'bg-blue-100 text-blue-800 border-blue-200' };
              } else if (!isAllowed) {
                statusBadge = { text: 'غير مصرح لك باستخدامه', bg: 'bg-slate-200 text-slate-700 border-slate-300' };
              } else if (counter.isPaused) {
                statusBadge = { text: 'متوقف مؤقتاً (استراحة)', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
              }

              return (
                <div
                  key={counter.id}
                  onClick={() => {
                    if (isAvailable) setSelectedCounterId(counter.id);
                  }}
                  className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 select-none ${
                    !isAvailable 
                      ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed' 
                      : isSelected
                        ? 'border-amber-600 bg-amber-50/80 shadow-md ring-2 ring-amber-500/30 cursor-pointer'
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm cursor-pointer'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{counter.name}</span>
                      {isSelected && isAvailable && (
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${statusBadge.bg}`}>
                        {statusBadge.text}
                      </span>
                    </div>
                  </div>

                  {isAvailable && (
                    <div className="text-[11px] text-slate-500 font-medium">
                      اضغط لتحديد هذا الشباك
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={() => {
                if (selectedCounterId) handleClaimCounter(selectedCounterId);
              }}
              disabled={!selectedCounterId || counterClaimLoading}
              className={`w-full py-4 text-base sm:text-lg font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${
                selectedCounterId && !counterClaimLoading
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20 active:scale-98'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <UserCheck className="w-5 h-5" />
              {counterClaimLoading ? 'جارِ حجز الشباك...' : 'بدء العمل على هذا الشباك'}
            </button>
          </div>

        </div>

      </div>
    );
  }

  // ==============================================================
  // VIEW 3: ACTIVE QUEUE & DESK MANAGEMENT (واجهة المندوب النشطة)
  // ==============================================================
  const isCounterPaused = activeCounter.isPaused;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      
      {/* Toast */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl shadow-lg text-xs font-bold flex items-center justify-between ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Staff & Counter Header Bar */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-amber-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-600 rounded-2xl flex items-center justify-center font-bold text-lg border border-amber-400">
            {currentStaff.name.charAt(0)}
          </div>
          <div>
            <div className="text-base font-bold flex items-center gap-2">
              {currentStaff.name}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isCounterPaused ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isCounterPaused ? 'متوقف مؤقتاً (استراحة)' : 'يعمل بنشاط'}
              </span>
            </div>
            <div className="text-xs text-amber-400 font-semibold">{activeCounter.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-800 px-3.5 py-2 rounded-xl text-xs border border-slate-700 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>الانتظار: <strong className="text-white font-mono text-sm">{waitingTickets.length}</strong></span>
          </div>

          <button
            onClick={handleTogglePause}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              isCounterPaused 
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500' 
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            {isCounterPaused ? <Play className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
            {isCounterPaused ? 'استئناف العمل' : 'استراحة مؤقتة'}
          </button>

          <button
            onClick={handleReleaseCounter}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="إنهاء العمل على هذا الشباك واختيار شباك آخر"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
            تبديل الشباك
          </button>

          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs flex items-center gap-1.5 transition-all"
              title="العودة للرئيسية"
            >
              <Home className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-xl border border-slate-700 text-xs flex items-center gap-1.5 transition-all"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Ticket Control Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
        
        {/* Currently Served Ticket Banner */}
        <div className="text-center space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            المراجع الحالي على {activeCounter.name}
          </div>
          
          {myServingTicket ? (
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-500 rounded-3xl p-8 shadow-md space-y-3">
              <div className="text-6xl sm:text-7xl font-black font-mono tracking-wider text-amber-950">
                {myServingTicket.displayNumber}
              </div>
              <div className="text-base font-bold text-amber-900">
                {myServingTicket.categoryNameArabic}
              </div>
              
              <div className="flex items-center justify-center gap-2 pt-1">
                {myServingTicket.documentingStartedAt ? (
                  <span className="bg-emerald-600 text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    قيد توثيق الوكالة الآن
                  </span>
                ) : (
                  <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
                    <PhoneCall className="w-3.5 h-3.5" />
                    تم النداء، بانتظار تقدم المراجع للشباك
                  </span>
                )}
              </div>

              <div className="text-xs text-amber-800 font-mono pt-1">
                وقت الاستدعاء: {new Date(myServingTicket.calledAt || '').toLocaleTimeString('ar-SY')}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-8 text-slate-500 text-sm font-medium space-y-2">
              {isCounterPaused ? (
                <div className="text-amber-700 font-bold">
                  الشباك في حالة استراحة مؤقتة حالياً. اضغط على «استئناف العمل» في الأعلى لبدء النداء.
                </div>
              ) : (
                <div>
                  لا توجد تذكرة قيد الخدمة حالياً. الشباك جاهز لاستقبال المراجع التالي.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Grid */}
        <div className="space-y-3">
          {!myServingTicket ? (
            <button
              onClick={handleCallNext}
              disabled={actionLoading || waitingTickets.length === 0 || isCounterPaused}
              className={`w-full py-5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xl rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 border border-emerald-400 ${
                waitingTickets.length === 0 || isCounterPaused ? 'opacity-50 cursor-not-allowed' : 'active:scale-98'
              }`}
            >
              <UserCheck className="w-7 h-7" />
              استدعاء المراجع التالي ({waitingTickets.length} في قائمة الانتظار)
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Start Documenting Button */}
              {/* Removed by user request */}

              {/* Recall Button */}
              <button
                onClick={handleRecall}
                className="py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
              >
                <PhoneCall className="w-4 h-4" />
                إعادة النداء على الشاشة
              </button>

              {/* Complete Service Button */}
              <button
                onClick={handleComplete}
                className="py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                إنهاء الخدمة وتوثيق المعاملة
              </button>

              {/* Skip Ticket Button */}
              <button
                onClick={() => setSkipModal(true)}
                className="sm:col-span-2 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs"
              >
                <SkipForward className="w-4 h-4" />
                تجاوز الدور (عدم حضور المراجع عند النداء)
              </button>
            </div>
          )}

          {/* Release and Switch Counter Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              تريد تغيير مكانك أو إنهاء مناوبتك على {activeCounter.name}؟
            </span>
            <button
              onClick={handleReleaseCounter}
              disabled={actionLoading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
              إنهاء العمل على الشباك واختيار شباك آخر
            </button>
          </div>
        </div>

      </div>

      {/* MODAL: SKIP TICKET WITH NOTES */}
      {skipModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">تجاوز دور المراجع لعدم الحضور</h3>
            <p className="text-xs text-slate-500">يرجى تسجيل سبب التجاوز (اختياري):</p>
            <input
              type="text"
              value={skipNotes}
              onChange={e => setSkipNotes(e.target.value)}
              placeholder="مثال: لم يحضر المراجع بعد 3 نداءات"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSkipSubmit}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-md"
              >
                تأكيد التجاوز
              </button>
              <button
                onClick={() => setSkipModal(false)}
                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WARNING WHEN TRYING TO LEAVE COUNTER WITH ACTIVE TICKET */}
      {releaseWarningModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">معاملة جارية على الشباك</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              لديك مراجع قيد الخدمة حالياً ({myServingTicket?.displayNumber}). لا يمكنك مغادرة الشباك أو تبديله حتى تنهي توثيق المعاملة أو تتجاوز الدور.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setReleaseWarningModal(false)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md"
              >
                فهمت، العودة للمعاملة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
