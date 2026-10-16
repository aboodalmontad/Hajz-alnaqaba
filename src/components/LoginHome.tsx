/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  Ticket as TicketIcon, 
  Lock, 
  KeyRound, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Server,
  FileText
} from 'lucide-react';
import { Staff, Counter, Branch, BranchManagerUser } from '../types';
import { apiFetch } from '../utils/network';

interface LoginHomeProps {
  onLoginSuccess: (authData: { role: 'hq_admin' | 'branch_manager' | 'counter_staff' | 'agency_delegate'; token: string; name: string; branchId?: string }) => void;
  staffList: Staff[];
  counters: Counter[];
}

const defaultSeedManagers: BranchManagerUser[] = [
  {
    id: 'bm-alp',
    branchId: 'branch-aleppo-main',
    branchName: 'المقر الرئيسي - القصر العدلي بحلب',
    fullName: 'الأستاذ أحمد الحلبي',
    username: 'manager_aleppo',
    password: 'Aleppo@2026',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bm-afr',
    branchId: 'branch-afrin',
    branchName: 'مكتب نقابة المحامين - فرع عفرين',
    fullName: 'الأستاذ محمد الكردي',
    username: 'manager_afrin',
    password: 'Afrin@2026',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bm-azz',
    branchId: 'branch-azaz',
    branchName: 'مكتب نقابة المحامين - فرع إعزاز',
    fullName: 'الأستاذ حسان الإعزازي',
    username: 'manager_azaz',
    password: 'Azaz@2026',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bm-bab',
    branchId: 'branch-albab',
    branchName: 'مكتب نقابة المحامين - فرع الباب',
    fullName: 'الأستاذ عمر البابي',
    username: 'manager_albab',
    password: 'Albab@2026',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bm-mnb',
    branchId: 'branch-manbij',
    branchName: 'مكتب نقابة المحامين - فرع منبج / الأتارب',
    fullName: 'الأستاذ باسل الأتاربي',
    username: 'manager_manbij',
    password: 'Manbij@2026',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

export const LoginHome: React.FC<LoginHomeProps> = ({ onLoginSuccess, staffList, counters }) => {
  const [selectedRole, setSelectedRole] = useState<'hq_admin' | 'branch_manager' | 'counter_staff' | 'agency_delegate'>('hq_admin');
  const [passwordInput, setPasswordInput] = useState('');
  const [managerUsername, setManagerUsername] = useState('manager_aleppo');
  const [selectedStaffId, setSelectedStaffId] = useState(staffList[0]?.id || '');
  const [selectedBranchId, setSelectedBranchId] = useState('branch-aleppo-main');

  // Branch managers list loaded from server / localStorage / seed
  const [branchManagersList, setBranchManagersList] = useState<BranchManagerUser[]>(() => {
    try {
      const raw = localStorage.getItem('agency_branch_managers');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultSeedManagers;
  });

  const [selectedManagerId, setSelectedManagerId] = useState<string>(() => {
    return defaultSeedManagers[0]?.id || 'bm-alp';
  });

  // Fetch latest branch managers from central database on mount
  React.useEffect(() => {
    apiFetch('/api/admin/branch-managers')
      .then(res => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setBranchManagersList(res.data);
          try {
            localStorage.setItem('agency_branch_managers', JSON.stringify(res.data));
          } catch {}
        }
      })
      .catch(() => {
        // Keep current cache or seed managers
      });
  }, []);

  const handleManagerSelectChange = (id: string) => {
    setSelectedManagerId(id);
    if (id === 'custom') {
      return;
    }
    const found = branchManagersList.find(m => m.id === id);
    if (found) {
      setManagerUsername(found.username);
      setSelectedBranchId(found.branchId);
    }
  };

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (selectedRole === 'hq_admin') {
        // Central HQ Admin login with 'admin' or '9999'
        const pinToTest = passwordInput.trim();
        if (pinToTest !== 'admin' && pinToTest !== '9999') {
          // Try backend api verification
          try {
            const res = await apiFetch('/api/admin/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pin: pinToTest })
            });
            if (res && res.success) {
              const token = res.token || 'admin-token-ok';
              try {
                sessionStorage.setItem('agency_admin_token', token);
                localStorage.setItem('agency_admin_token', token);
              } catch {}
              onLoginSuccess({
                role: 'hq_admin',
                token,
                name: res.adminName || 'المدير العام'
              });
              return;
            }
          } catch {}
          setErrorMessage('كلمة مرور الإدارة المركزية غير صحيحة. كلمة المرور الافتتاحية هي admin');
          setLoading(false);
          return;
        }

        const token = `admin-token-${Date.now()}`;
        try {
          sessionStorage.setItem('agency_admin_token', token);
          localStorage.setItem('agency_admin_token', token);
        } catch {}
        onLoginSuccess({
          role: 'hq_admin',
          token,
          name: 'المدير العام (الإدارة المركزية)'
        });
      } 
      else if (selectedRole === 'branch_manager') {
        const cleanUser = managerUsername.trim();
        const cleanPass = passwordInput.trim();

        if (!cleanUser || !cleanPass) {
          setErrorMessage('يرجى إدخال اسم مستخدم مدير الفرع وكلمة المرور المستقلة.');
          setLoading(false);
          return;
        }

        // Security Guard: Prohibit delegate PINs from acting as branch managers
        const isStaffPin = staffList.some(s => s.pin === cleanPass);
        const matchingManager = branchManagersList.find(
          m => m.username.toLowerCase() === cleanUser.toLowerCase() && m.password === cleanPass
        );

        if ((isStaffPin || cleanPass === '123456') && (!matchingManager || matchingManager.password !== cleanPass)) {
          setErrorMessage('رمز المندوب أو موظف الشباك لا يخول الدخول كمدير فرع! يجب إدخال اسم المستخدم وكلمة المرور الخاصة بمدير الفرع والمعرفة من الإدارة المركزية.');
          setLoading(false);
          return;
        }

        // Try backend authentication first
        let backendSucceeded = false;
        try {
          const res = await apiFetch('/api/branch-manager/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: cleanUser, password: cleanPass })
          });

          if (res && res.success && res.manager) {
            backendSucceeded = true;
            const token = res.token || `bm-token-${Date.now()}`;
            try {
              sessionStorage.setItem('agency_admin_token', token);
              localStorage.setItem('agency_admin_token', token);
            } catch {}
            onLoginSuccess({
              role: 'branch_manager',
              token,
              name: `مدير الفرع: ${res.manager.fullName}`,
              branchId: res.manager.branchId
            });
            return;
          }
        } catch (apiErr: any) {
          setErrorMessage(apiErr.message || 'اسم المستخدم أو كلمة مرور مدير الفرع غير صحيحة. يتم تعريف مدراء الفروع وتحديد كلمات مرورهم من قبل الإدارة المركزية.');
          setLoading(false);
          return;
        }

        if (!backendSucceeded) {
          // Offline verification strictly against Central HQ defined managers
          if (!matchingManager) {
            setErrorMessage('اسم المستخدم أو كلمة مرور مدير الفرع غير صحيحة. يتم تعريف مدراء الفروع وتحديد كلمات مرورهم حصراً من قبل الإدارة المركزية.');
            setLoading(false);
            return;
          }

          if (!matchingManager.active) {
            setErrorMessage('تم تعطيل حساب مدير هذا الفرع من قبل الإدارة المركزية.');
            setLoading(false);
            return;
          }

          const token = `branch-token-${matchingManager.id}-${Date.now()}`;
          try {
            sessionStorage.setItem('agency_admin_token', token);
            localStorage.setItem('agency_admin_token', token);
          } catch {}
          onLoginSuccess({
            role: 'branch_manager',
            token,
            name: `مدير الفرع: ${matchingManager.fullName}`,
            branchId: matchingManager.branchId
          });
          return;
        }
      }
      else if (selectedRole === 'counter_staff') {
        // Counter staff login
        const staff = staffList.find(s => s.id === selectedStaffId);
        if (!staff) {
          setErrorMessage('يرجى اختيار موظف صالح.');
          setLoading(false);
          return;
        }
        const pinToTest = passwordInput.trim();
        if (pinToTest && pinToTest !== '123456' && pinToTest !== staff.pin) {
          // verify via backend
          try {
            const res = await apiFetch('/api/staff/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ staffId: staff.id, pin: pinToTest })
            });
            if (res && res.success) {
              onLoginSuccess({
                role: 'counter_staff',
                token: `staff-token-${staff.id}`,
                name: staff.name
              });
              return;
            }
          } catch {}
          setErrorMessage('الرمز الشخصي (PIN) لموظف النافذة غير صحيح.');
          setLoading(false);
          return;
        }

        onLoginSuccess({
          role: 'counter_staff',
          token: `staff-token-${staff.id}`,
          name: staff.name
        });
      }
      else if (selectedRole === 'agency_delegate') {
        // Agency delegate login
        onLoginSuccess({
          role: 'agency_delegate',
          token: `delegate-token-${Date.now()}`,
          name: 'مندوب الوكالات'
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6" dir="rtl">
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden relative z-10 backdrop-blur-xl">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-6 sm:p-8 text-center border-b border-slate-800 relative">
          <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/40 rounded-2xl mx-auto flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
            <Building2 className="w-8 h-8" />
          </div>
          <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold mb-2">
            نقابة المحامين – الجمهورية العربية السورية
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            تطبيق أرشفة الوكالات ونظام الدور
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-2">
            نظام إدارة الوكالات وتنظيم الدور ومتابعة المعاملات في المكاتب والفروع
          </p>
        </div>

        {/* Login Form Body */}
        <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-6">
          {errorMessage && (
            <div className="bg-red-950/80 border border-red-500/50 text-red-200 p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 animate-shake">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">اختر نوع الصلاحية / المستخدم:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole('hq_admin')}
                className={`p-3 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                  selectedRole === 'hq_admin'
                    ? 'bg-amber-600/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedRole === 'hq_admin' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">الإدارة المركزية</div>
                  <div className="text-[10px] text-slate-400">التحكم الشامل والإعدادات</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('branch_manager')}
                className={`p-3 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                  selectedRole === 'branch_manager'
                    ? 'bg-amber-600/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedRole === 'branch_manager' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">إدارة المكتب الفرعي</div>
                  <div className="text-[10px] text-slate-400">إدارة الفرع والموظفين</div>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Fields based on role */}
          {selectedRole === 'branch_manager' && (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Branch Manager Account Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">اختر فرعك / حساب مدير الفرع المعتمد:</label>
                <select
                  value={selectedManagerId}
                  onChange={e => handleManagerSelectChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                >
                  {branchManagersList.map(bm => (
                    <option key={bm.id} value={bm.id}>
                      {bm.branchName} – ({bm.fullName} | {bm.username}) {!bm.active ? ' [معطل إدارياً]' : ''}
                    </option>
                  ))}
                  <option value="custom">✍️ إدخال اسم مستخدم آخر يدويّاً</option>
                </select>
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">اسم مستخدم مدير الفرع (Username):</label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={managerUsername}
                    onChange={e => {
                      setManagerUsername(e.target.value);
                      setSelectedManagerId('custom');
                    }}
                    placeholder="مثال: manager_aleppo أو manager_afrin"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-10 pl-4 py-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Security Banner */}
              <div className="text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-500/30 p-3 rounded-xl space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-400">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>أمان الصلاحيات: لكل مدير فرع حساب مستقل تماماً</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  يتم تعريف وتعيين مدراء الفروع وتحديد أسماء المستخدمين وكلمات المرور الخاصة بهم حصراً من قبل <strong>الإدارة المركزية</strong>، ولا يمكن الدخول برمز موظف أو مندوب وكالات.
                </p>
              </div>
            </div>
          )}

          {selectedRole === 'counter_staff' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-bold text-slate-300 block">اختر حساب الموظف:</label>
              <select
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.jobTitle || 'موظف'})</option>
                ))}
              </select>
            </div>
          )}

          {/* Password / PIN Field */}
          {selectedRole !== 'agency_delegate' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-bold text-slate-300 block">
                {selectedRole === 'hq_admin'
                  ? 'كلمة مرور الإدارة المركزية (admin):'
                  : selectedRole === 'branch_manager'
                  ? 'كلمة مرور مدير الفرع المستقلة (المحددة من الإدارة المركزية):'
                  : 'الرمز الشخصي (PIN) لموظف النافذة:'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder={
                    selectedRole === 'hq_admin'
                      ? 'أدخل admin'
                      : selectedRole === 'branch_manager'
                      ? 'أدخل كلمة المرور الخاصة بحساب مدير الفرع'
                      : 'أدخل الرمز الشخصي للموظف (مثال: 123456)'
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-10 pl-4 py-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              {selectedRole === 'hq_admin' && (
                <p className="text-[11px] text-amber-400/80">كلمة المرور الافتتاحية للتجربة هي: <strong className="font-mono">admin</strong></p>
              )}
              {selectedRole === 'branch_manager' && (
                <p className="text-[11px] text-slate-400">
                  🔐 كلمات مرور مدراء الفروع معينة من الإدارة المركزية. مثال حساب فرع حلب: <span className="font-mono text-amber-300">Aleppo@2026</span>
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-black rounded-2xl shadow-xl shadow-amber-950/40 border border-amber-300 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50 text-sm"
          >
            <span>{loading ? 'جاري التحقق وتسجيل الدخول...' : 'تسجيل الدخول للنظام'}</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </form>

        {/* Footer info */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center text-[11px] text-slate-500">
          يعمل النظام محلياً بالكامل دون الحاجة للاتترنت (أوفلاين) مع دعم المزامنة السحابية اختيارياً.
        </div>
      </div>
    </div>
  );
};
