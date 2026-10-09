/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Users, 
  Tv, 
  PauseCircle, 
  PlayCircle, 
  RotateCcw, 
  Download, 
  Upload, 
  FileText, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Building2, 
  Plus, 
  Settings, 
  Trash2, 
  Edit3, 
  Volume2, 
  Clock, 
  Key, 
  ArrowRightLeft, 
  RefreshCw, 
  LogOut,
  X,
  FileSpreadsheet,
  Layers,
  PhoneCall,
  UserX,
  UserCheck,
  Smartphone,
  Copy,
  ExternalLink,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Staff, Counter, Ticket, AuditLog, SystemSettings, CounterSession } from '../types';
import { resolveBaseUrl, resolveAgentUrl, copyToClipboard, apiFetch } from '../utils/network';

interface AdminDashboardProps {
  staffList: Staff[];
  counters: Counter[];
  tickets: Ticket[];
  counterSessions?: CounterSession[];
  issuancePaused: boolean;
  date: string;
  settings: SystemSettings;
  auditLogs: AuditLog[];
  localIPs?: string[];
  port?: number;
  serverAppUrl?: string;
  onRefreshState: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  staffList,
  counters,
  tickets,
  counterSessions = [],
  issuancePaused,
  date,
  settings,
  auditLogs,
  localIPs = ['127.0.0.1'],
  port = 3000,
  serverAppUrl,
  onRefreshState
}) => {
  // Auth state
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('agency_admin_token') || null;
  });
  const [adminPinInput, setAdminPinInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'data_management' | 'settings' | 'logs'>('data_management');
  const [dataSubTab, setDataSubTab] = useState<'tickets' | 'counters' | 'staff' | 'shifts'>('counters');

  // Agent QR URL calculation
  const baseUrl = resolveBaseUrl(localIPs, port, serverAppUrl);
  const agentUrl = resolveAgentUrl(baseUrl);
  const [copiedAgentUrl, setCopiedAgentUrl] = useState(false);

  // Filter & Search states
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');
  const [shiftSearch, setShiftSearch] = useState('');

  // Modals & form states
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [ticketFormNumber, setTicketFormNumber] = useState('');
  const [ticketFormStatus, setTicketFormStatus] = useState<Ticket['status']>('waiting');
  const [ticketFormCounter, setTicketFormCounter] = useState('');
  const [ticketFormNotes, setTicketFormNotes] = useState('');

  // Staff forms
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffFormName, setStaffFormName] = useState('');
  const [staffFormPin, setStaffFormPin] = useState('');
  const [staffFormCounter, setStaffFormCounter] = useState('');
  const [staffFormActive, setStaffFormActive] = useState(true);
  const [staffFormAllowedCounters, setStaffFormAllowedCounters] = useState<string[]>([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);

  // Counter forms
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [counterFormName, setCounterFormName] = useState('');
  const [counterFormOpen, setCounterFormOpen] = useState(true);
  const [showAddCounterModal, setShowAddCounterModal] = useState(false);

  // Move Staff Counter Modal
  const [moveStaffModal, setMoveStaffModal] = useState<{
    staff: Staff;
    currentCounterName: string;
  } | null>(null);
  const [targetMoveCounterId, setTargetMoveCounterId] = useState('');

  // Settings form
  const [formSettings, setFormSettings] = useState<SystemSettings>(settings);
  const [currentAdminPin, setCurrentAdminPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Confirm delete modal
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Status message banner
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync settings when props change
  useEffect(() => {
    if (settings) {
      setFormSettings(settings);
    }
  }, [settings]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Admin Request Helper
  const adminFetch = async (url: string, options: RequestInit = {}) => {
    if (!adminToken) throw new Error('يرجى تسجيل الدخول كمسؤول.');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      'x-admin-token': adminToken,
      ...(options.headers || {})
    };

    try {
      return await apiFetch(url, { ...options, headers });
    } catch (err: any) {
      if (err.message && err.message.includes('401')) {
        setAdminToken(null);
        sessionStorage.removeItem('agency_admin_token');
        throw new Error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجددًا.');
      }
      throw err;
    }
  };

  // Login handler
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const data = await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPinInput })
      });

      setAdminToken(data.token);
      sessionStorage.setItem('agency_admin_token', data.token);
      setAdminPinInput('');
      onRefreshState();
      showToast('success', 'مرحباً بك، تم التحقق من صلاحيات المدير العام.');
    } catch (err: any) {
      setAuthError(err.message || 'رمز الدخول غير صحيح.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    sessionStorage.removeItem('agency_admin_token');
  };

  // Change Admin PIN
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);
    try {
      const data = await adminFetch('/api/admin/change-pin', {
        method: 'POST',
        body: JSON.stringify({ currentPin: currentAdminPin, newPin: newAdminPin })
      });
      setPinChangeMsg({ type: 'success', text: data.message });
      setCurrentAdminPin('');
      setNewAdminPin('');
      showToast('success', 'تم تحديث رمز المدير العام بنجاح.');
    } catch (err: any) {
      setPinChangeMsg({ type: 'error', text: err.message });
    }
  };

  // Save System Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(formSettings)
      });
      onRefreshState();
      showToast('success', 'تم حفظ إعدادات النظام وشاشة العرض بنجاح.');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Toggle Issuance
  const handleToggleIssuance = async () => {
    try {
      const data = await adminFetch('/api/admin/toggle-issuance', { method: 'POST' });
      onRefreshState();
      showToast('success', data.issuancePaused ? 'تم إيقاف إصدار التذاكر مؤقتاً.' : 'تم استئناف إصدار التذاكر.');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Start New Day
  const handleNewDay = () => {
    setConfirmModal({
      title: 'بدء يوم عمل جديد وتصفير الأدوار',
      message: 'هل أنت متأكد من بدء يوم عمل جديد؟ سيتم تصفير ترقيم تذاكر اليوم والبدء من 001 وتحرير الشبابيك مع الاحتفاظ الكامل بسجل العمليات السابق.',
      onConfirm: async () => {
        try {
          const data = await adminFetch('/api/admin/new-day', { method: 'POST' });
          onRefreshState();
          showToast('success', data.message);
        } catch (err: any) {
          showToast('error', err.message);
        }
      }
    });
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const res = await fetch('/api/admin/export-csv', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (!res.ok) throw new Error('فشل تصدير التقرير');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير_دائرة_الوكالات_${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('success', 'تم تصدير تقرير اليوم بنجاح.');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Backup Download
  const handleBackup = () => {
    window.open(`/api/admin/backup?token=${adminToken}`, '_blank');
  };

  // Restore Database
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmModal({
      title: 'تأكيد استعادة قاعدة البيانات',
      message: 'سيتم استبدال البيانات الحالية بالكامل بمحتويات ملف النسخ الاحتياطي. هل ترغب بالاستمرار؟',
      onConfirm: () => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const json = JSON.parse(event.target?.result as string);
            const data = await adminFetch('/api/admin/restore', {
              method: 'POST',
              body: JSON.stringify(json)
            });
            onRefreshState();
            showToast('success', data.message || 'تمت استعادة قاعدة البيانات بنجاح.');
          } catch (err: any) {
            showToast('error', err.message || 'ملف النسخ الاحتياطي غير صالح.');
          }
        };
        reader.readAsText(file);
      }
    });
  };

  // ----------------------------------------------------
  // TICKET ACTIONS
  // ----------------------------------------------------
  const openEditTicketModal = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setTicketFormNumber(ticket.displayNumber);
    setTicketFormStatus(ticket.status);
    setTicketFormCounter(ticket.counterId || '');
    setTicketFormNotes(ticket.notes || '');
  };

  const handleSaveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;

    try {
      await adminFetch(`/api/admin/tickets/${editingTicket.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          displayNumber: ticketFormNumber,
          status: ticketFormStatus,
          counterId: ticketFormCounter,
          notes: ticketFormNotes
        })
      });
      setEditingTicket(null);
      onRefreshState();
      showToast('success', `تم تعديل بيانات التذكرة ${ticketFormNumber} بنجاح.`);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleTicketAction = async (ticketId: string, action: string) => {
    try {
      await adminFetch(`/api/admin/tickets/${ticketId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      onRefreshState();
      showToast('success', 'تم تنفيذ الإجراء الإداري على التذكرة بنجاح.');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleRecallTicket = async (ticketId: string) => {
    try {
      await adminFetch(`/api/admin/tickets/${ticketId}/recall`, { method: 'POST' });
      showToast('success', 'تم إرسال نداء فوري على شاشة العرض.');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteTicket = (ticket: Ticket) => {
    setConfirmModal({
      title: 'حذف تذكرة دور نهائياً',
      message: `هل أنت متأكد من حذف التذكرة رقم ${ticket.displayNumber} نهائياً؟ هذا الإجراء لا يمكن التراجع عنه وسيسجل في سجل التدقيق.`,
      onConfirm: async () => {
        try {
          await adminFetch(`/api/admin/tickets/${ticket.id}`, { method: 'DELETE' });
          onRefreshState();
          showToast('success', `تم حذف التذكرة ${ticket.displayNumber} بنجاح.`);
        } catch (err: any) {
          showToast('error', err.message);
        }
      }
    });
  };

  // ----------------------------------------------------
  // COUNTER ACTIONS
  // ----------------------------------------------------
  const handleSaveCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCounter) {
        await adminFetch('/api/admin/counters', {
          method: 'POST',
          body: JSON.stringify({
            id: editingCounter.id,
            name: counterFormName,
            isOpen: counterFormOpen
          })
        });
        setEditingCounter(null);
        showToast('success', `تم تحديث ${counterFormName} بنجاح.`);
      } else {
        await adminFetch('/api/admin/counters', {
          method: 'POST',
          body: JSON.stringify({
            name: counterFormName,
            isOpen: counterFormOpen
          })
        });
        setShowAddCounterModal(false);
        showToast('success', `تمت إضافة الشباك الجديد ${counterFormName} بنجاح.`);
      }
      setCounterFormName('');
      onRefreshState();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteCounter = (counter: Counter) => {
    setConfirmModal({
      title: 'حذف شباك خدمة',
      message: `هل أنت متأكد من حذف ${counter.name}؟ سيتم فك ارتباط أي موظف مرتبط به.`,
      onConfirm: async () => {
        try {
          await adminFetch(`/api/admin/counters/${counter.id}`, { method: 'DELETE' });
          onRefreshState();
          showToast('success', `تم حذف ${counter.name} بنجاح.`);
        } catch (err: any) {
          showToast('error', err.message);
        }
      }
    });
  };

  // Admin Force Release Counter
  const handleForceReleaseCounter = (counter: Counter) => {
    setConfirmModal({
      title: 'إنهاء حجز الشباك إدارياً',
      message: `هل أنت متأكد من إنهاء حجز ${counter.name} وفصله عن المندوب (${counter.currentStaffName || 'الموظف الحالي'})؟ سيتم تحرير الشباك ليصبح متاحاً فوراً.`,
      onConfirm: async () => {
        try {
          await adminFetch('/api/admin/force-release-counter', {
            method: 'POST',
            body: JSON.stringify({ counterId: counter.id })
          });
          onRefreshState();
          showToast('success', `تم إنهاء حجز ${counter.name} بنجاح.`);
        } catch (err: any) {
          showToast('error', err.message);
        }
      }
    });
  };

  // Admin Move Staff Counter
  const handleMoveStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveStaffModal || !targetMoveCounterId) return;

    try {
      await adminFetch('/api/admin/move-staff-counter', {
        method: 'POST',
        body: JSON.stringify({
          staffId: moveStaffModal.staff.id,
          targetCounterId: targetMoveCounterId
        })
      });
      setMoveStaffModal(null);
      setTargetMoveCounterId('');
      onRefreshState();
      showToast('success', 'تم نقل الموظف إلى الشباك بنجاح.');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // ----------------------------------------------------
  // STAFF ACTIONS
  // ----------------------------------------------------
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        await adminFetch('/api/admin/staff', {
          method: 'POST',
          body: JSON.stringify({
            id: editingStaff.id,
            name: staffFormName,
            pin: staffFormPin,
            counterId: staffFormCounter,
            active: staffFormActive,
            allowedCounterIds: staffFormAllowedCounters
          })
        });
        setEditingStaff(null);
        showToast('success', `تم تعديل بيانات الموظف ${staffFormName} بنجاح.`);
      } else {
        await adminFetch('/api/admin/staff', {
          method: 'POST',
          body: JSON.stringify({
            name: staffFormName,
            pin: staffFormPin,
            counterId: staffFormCounter,
            active: staffFormActive,
            allowedCounterIds: staffFormAllowedCounters
          })
        });
        setShowAddStaffModal(false);
        showToast('success', `تمت إضافة الموظف الجديد ${staffFormName} بنجاح.`);
      }
      setStaffFormName('');
      setStaffFormPin('');
      setStaffFormCounter('');
      setStaffFormAllowedCounters([]);
      onRefreshState();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteStaff = (staff: Staff) => {
    setConfirmModal({
      title: 'حذف حساب موظف',
      message: `هل أنت متأكد من حذف الموظف ${staff.name}؟ سيتم إلغاء حسابه ورمزه من النظام.`,
      onConfirm: async () => {
        try {
          await adminFetch(`/api/admin/staff/${staff.id}`, { method: 'DELETE' });
          onRefreshState();
          showToast('success', `تم حذف حساب ${staff.name} بنجاح.`);
        } catch (err: any) {
          showToast('error', err.message);
        }
      }
    });
  };

  // ----------------------------------------------------
  // LOGIN SCREEN (If not authenticated as Admin)
  // ----------------------------------------------------
  if (!adminToken) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl p-8 shadow-2xl border border-slate-200 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-600 to-amber-700 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg border border-amber-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">لوحة تحكم المدير العام</h1>
            <p className="text-xs text-slate-500">دائرة الوكالات – نقابة المحامين بحلب</p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed text-right">
            هذه اللوحة مخصصة للمدير العام فقط، ومحمية بمصادقة خادم مستقلة للتحكم الشامل ببيانات الدور والشبابيك والموظفين.
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">رمز المرور الإداري (PIN):</label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={12}
                  value={adminPinInput}
                  onChange={e => setAdminPinInput(e.target.value)}
                  placeholder="أدخل رمز المدير (الافتراضي: 9999)"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tracking-widest text-center"
                />
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4 text-amber-400" />
              {authLoading ? 'جارِ التحقق...' : 'تسجيل دخول المدير العام'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Calculate live statistics
  const waitingTickets = tickets.filter(t => t.status === 'waiting');
  const servingTickets = tickets.filter(t => t.status === 'serving');
  const completedTickets = tickets.filter(t => t.status === 'completed');
  const skippedTickets = tickets.filter(t => t.status === 'skipped');
  const cancelledTickets = tickets.filter(t => t.status === 'cancelled');

  // Filter tickets for data management
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.displayNumber.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.categoryNameArabic.includes(ticketSearch) ||
      (t.counterName && t.counterName.includes(ticketSearch)) ||
      (t.staffName && t.staffName.includes(ticketSearch)) ||
      (t.notes && t.notes.includes(ticketSearch));

    if (!matchesSearch) return false;
    if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl shadow-lg text-sm font-bold flex items-center justify-between transition-all ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Top Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-500/30 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-600 rounded-2xl flex items-center justify-center shadow-lg border border-amber-400">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">صلاحيات المدير العام الكاملة</h1>
              <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-md border border-amber-500/40 font-semibold">
                إدارة مركزية شاملة
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-1 flex items-center gap-3">
              <span>تاريخ التشغيل: <strong className="text-amber-400 font-mono">{date}</strong></span>
              <span>·</span>
              <span>حالة الإصدار: <strong className={issuancePaused ? 'text-red-400' : 'text-emerald-400'}>{issuancePaused ? 'متوقف مؤقتاً' : 'نشط وجاهز'}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleToggleIssuance}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm ${
              issuancePaused 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {issuancePaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            {issuancePaused ? 'استئناف إصدار التذاكر' : 'إيقاف إصدار التذاكر مؤقتاً'}
          </button>

          <button
            onClick={handleNewDay}
            className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl font-bold text-xs flex items-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4" /> بدء يوم عمل جديد
          </button>

          <button
            onClick={handleAdminLogout}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all text-xs flex items-center gap-1.5"
            title="تسجيل الخروج من الإدارة"
          >
            <LogOut className="w-4 h-4" /> خروج
          </button>
        </div>
      </div>

      {/* PROMINENT AGENT QR & LINK CARD FOR ADMIN */}
      <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-white border-2 border-amber-500/30 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right w-full md:w-auto">
          <div className="p-2.5 bg-white rounded-2xl shadow-md border border-amber-200 shrink-0">
            <QRCodeSVG value={agentUrl} size={110} level="H" includeMargin={true} />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-amber-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              <Smartphone className="w-3.5 h-3.5" /> رمز QR لدخول المندوبين من الهاتف (/agent)
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              امسح الرمز أو شارك الرابط المباشر مع مندوبي الوكالات
            </h3>
            <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
              يفتح المندوب الرابط من متصفح هاتفه المتصل بالشبكة، ليسجل الدخول ويحجز شباكه المتاح ويبدأ استقبال المراجعين فوراً.
            </p>
            <div className="bg-slate-900 text-amber-300 font-mono text-xs px-3 py-1 rounded-xl break-all select-all inline-block mt-1">
              {agentUrl}
            </div>
          </div>
        </div>

        <div className="flex flex-row gap-2 shrink-0 w-full md:w-auto justify-end">
          <button
            onClick={async () => {
              const ok = await copyToClipboard(agentUrl);
              if (ok) {
                setCopiedAgentUrl(true);
                setTimeout(() => setCopiedAgentUrl(false), 2500);
              }
            }}
            className="flex-1 md:flex-none px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
          >
            {copiedAgentUrl ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedAgentUrl ? 'تم نسخ الرابط!' : 'نسخ الرابط'}
          </button>
          <a
            href={agentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-none px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-300 transition-all text-center shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            تجربة
          </a>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('data_management')}
          className={`px-5 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'data_management' 
              ? 'bg-amber-600 text-white shadow-md' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          إدارة بيانات النظام (تذاكر، شبابيك، موظفين، مناوبات)
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview' 
              ? 'bg-amber-600 text-white shadow-md' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          نظرة عامة والتقارير
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'settings' 
              ? 'bg-amber-600 text-white shadow-md' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          إعدادات الشاشة والتطبيق والرمز
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'logs' 
              ? 'bg-amber-600 text-white shadow-md' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          سجل التدقيق والرقابة الدائم
        </button>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: إدارة بيانات النظام (SYSTEM DATA MANAGEMENT) */}
      {/* ======================================================== */}
      {activeTab === 'data_management' && (
        <div className="space-y-6">
          
          {/* Subtabs for System Data */}
          <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            <button
              onClick={() => setDataSubTab('counters')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                dataSubTab === 'counters' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>حالة الشبابيك ومندوبيها ({counters.length})</span>
            </button>
            <button
              onClick={() => setDataSubTab('tickets')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                dataSubTab === 'tickets' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>تذاكر الدور اليوم ({tickets.length})</span>
            </button>
            <button
              onClick={() => setDataSubTab('staff')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                dataSubTab === 'staff' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>الموظفون والصلاحيات ({staffList.length})</span>
            </button>
            <button
              onClick={() => setDataSubTab('shifts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                dataSubTab === 'shifts' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>سجل مناوبات الشبابيك ({counterSessions.length})</span>
            </button>
          </div>

          {/* SUBTAB: COUNTERS MANAGEMENT WITH LIVE DELEGATE STATUS */}
          {dataSubTab === 'counters' && (
            <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">متابعة الشبابيك وحالة المندوبين في الوقت الفعلي</h3>
                  <p className="text-xs text-slate-500">
                    رؤية المندوب الذي يعمل على كل شباك، إنهاء الحجز إدارياً، أو نقل المندوب إلى شباك آخر
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingCounter(null);
                    setCounterFormName('');
                    setCounterFormOpen(true);
                    setShowAddCounterModal(true);
                  }}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> إضافة شباك جديد
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {counters.map(counter => {
                  const isOccupied = !!counter.currentStaffId;
                  const isPaused = !!counter.isPaused;
                  const staffObj = staffList.find(s => s.id === counter.currentStaffId);

                  let statusBadge = {
                    text: 'متاح للاستلام',
                    color: 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  };

                  if (!counter.isOpen) {
                    statusBadge = { text: 'مغلق من الإدارة', color: 'bg-red-100 text-red-800 border-red-200' };
                  } else if (isOccupied && isPaused) {
                    statusBadge = { text: 'متوقف مؤقتاً (استراحة)', color: 'bg-amber-100 text-amber-800 border-amber-200' };
                  } else if (isOccupied) {
                    statusBadge = { text: 'يعمل عليه مندوب بنشاط', color: 'bg-blue-100 text-blue-800 border-blue-200' };
                  }

                  return (
                    <div 
                      key={counter.id} 
                      className={`p-5 rounded-2xl border-2 space-y-4 flex flex-col justify-between transition-all ${
                        isOccupied ? 'bg-amber-50/40 border-amber-300' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 text-sm">{counter.name}</h4>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge.color}`}>
                            {statusBadge.text}
                          </span>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">المندوب الحالي:</span>
                            <strong className="text-slate-900 font-bold">
                              {counter.currentStaffName || 'لا يوجد (متاح)'}
                            </strong>
                          </div>
                          {counter.claimedAt && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">وقت بدء العمل:</span>
                              <span className="font-mono text-slate-600">
                                {new Date(counter.claimedAt).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Administrative Desk Actions */}
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        {isOccupied && staffObj && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                setMoveStaffModal({
                                  staff: staffObj,
                                  currentCounterName: counter.name
                                });
                                setTargetMoveCounterId('');
                              }}
                              className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" /> نقل المندوب
                            </button>
                            <button
                              onClick={() => handleForceReleaseCounter(counter)}
                              className="py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                            >
                              <UserX className="w-3.5 h-3.5" /> إنهاء الحجز
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingCounter(counter);
                              setCounterFormName(counter.name);
                              setCounterFormOpen(counter.isOpen);
                              setShowAddCounterModal(true);
                            }}
                            className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> تعديل الاسم
                          </button>
                          <button
                            onClick={() => handleDeleteCounter(counter)}
                            className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl transition-colors"
                            title="حذف الشباك"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUBTAB: TICKETS MANAGEMENT */}
          {dataSubTab === 'tickets' && (
            <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6">
              
              {/* Table Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    value={ticketSearch}
                    onChange={e => setTicketSearch(e.target.value)}
                    placeholder="بحث برقم الدور، الفئة، الشباك، الموظف..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 pr-9"
                  />
                  <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                  <span className="text-xs text-slate-500 whitespace-nowrap">الحالة:</span>
                  {(['all', 'waiting', 'serving', 'completed', 'skipped', 'cancelled'] as const).map(statusKey => {
                    const labels: Record<string, string> = {
                      all: 'الكل',
                      waiting: 'بالانتظار',
                      serving: 'قيد الخدمة',
                      completed: 'مكتملة',
                      skipped: 'متجاوزة',
                      cancelled: 'ملغاة'
                    };
                    return (
                      <button
                        key={statusKey}
                        onClick={() => setTicketStatusFilter(statusKey)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                          ticketStatusFilter === statusKey ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {labels[statusKey]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tickets Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">رقم الدور</th>
                      <th className="py-3 px-4">نوع المعاملة</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">الشباك والموظف</th>
                      <th className="py-3 px-4">التوقيت</th>
                      <th className="py-3 px-4">ملاحظات</th>
                      <th className="py-3 px-4 text-center">إجراءات المدير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          لا توجد تذاكر تطابق معايير البحث
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map(ticket => {
                        const statusBadgeClass = {
                          waiting: 'bg-amber-100 text-amber-800',
                          serving: 'bg-blue-100 text-blue-800 animate-pulse',
                          completed: 'bg-emerald-100 text-emerald-800',
                          skipped: 'bg-slate-200 text-slate-700',
                          cancelled: 'bg-red-100 text-red-800'
                        }[ticket.status];

                        const statusLabel = {
                          waiting: 'بالانتظار',
                          serving: 'قيد الخدمة',
                          completed: 'مكتملة',
                          skipped: 'متجاوزة',
                          cancelled: 'ملغاة'
                        }[ticket.status];

                        return (
                          <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono font-black text-sm text-slate-900">
                              {ticket.displayNumber}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              {ticket.categoryNameArabic}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${statusBadgeClass}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {ticket.counterName || '-'}
                              {ticket.staffName && <span className="text-[10px] text-slate-400 block">{ticket.staffName}</span>}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                              {new Date(ticket.createdAt).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={ticket.notes}>
                              {ticket.notes || '-'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => handleRecallTicket(ticket.id)}
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                  title="إعادة نداء فوري على شاشة العرض"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => openEditTicketModal(ticket)}
                                  className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors"
                                  title="تعديل بيانات التذكرة ورقمها"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {ticket.status !== 'waiting' && (
                                  <button
                                    onClick={() => handleTicketAction(ticket.id, 'return_queue')}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                                    title="إعادة إلى قائمة الانتظار"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {ticket.status !== 'cancelled' && (
                                  <button
                                    onClick={() => handleTicketAction(ticket.id, 'cancel')}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                                    title="إلغاء التذكرة"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteTicket(ticket)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
                                  title="حذف نهائي للتذكرة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* SUBTAB: STAFF & PERMISSIONS */}
          {dataSubTab === 'staff' && (
            <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">إدارة حسابات الموظفين ومندوبي الوكالات</h3>
                  <p className="text-xs text-slate-500">إضافة الموظفين، تحديد الشبابيك المصرح لهم باستخدامها، وتفعيل أو إيقاف الحسابات</p>
                </div>
                <button
                  onClick={() => {
                    setEditingStaff(null);
                    setStaffFormName('');
                    setStaffFormPin('');
                    setStaffFormCounter('');
                    setStaffFormActive(true);
                    setStaffFormAllowedCounters([]);
                    setShowAddStaffModal(true);
                  }}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> إضافة موظف جديد
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffList.map(staff => {
                  const assignedCounter = counters.find(c => c.id === staff.counterId);
                  const allowedCounterNames = (staff.allowedCounterIds && staff.allowedCounterIds.length > 0)
                    ? staff.allowedCounterIds.map(id => counters.find(c => c.id === id)?.name || id).join('، ')
                    : 'جميع الشبابيك متاحة';

                  return (
                    <div key={staff.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            {staff.name}
                            {staff.role === 'admin' && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-md font-bold">مسؤول</span>}
                          </h4>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            staff.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {staff.active ? 'مفعل' : 'موقف'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          <div>الشباك الحالي: <strong className="text-slate-800">{assignedCounter ? assignedCounter.name : 'غير محجوز'}</strong></div>
                          <div>الشبابيك المسموحة: <span className="text-slate-700 font-medium">{allowedCounterNames}</span></div>
                          <div className="font-mono text-slate-500">الرمز السري (PIN): <strong className="text-amber-800 tracking-wider">{staff.pin}</strong></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => {
                            setEditingStaff(staff);
                            setStaffFormName(staff.name);
                            setStaffFormPin(staff.pin);
                            setStaffFormCounter(staff.counterId || '');
                            setStaffFormActive(staff.active);
                            setStaffFormAllowedCounters(staff.allowedCounterIds || []);
                            setShowAddStaffModal(true);
                          }}
                          className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> تعديل / صلاحيات الشبابيك
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(staff)}
                          className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-colors"
                          title="حذف الحساب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUBTAB: SHIFT SESSIONS LOG */}
          {dataSubTab === 'shifts' && (
            <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">سجل مناوبات العمل على الشبابيك</h3>
                  <p className="text-xs text-slate-500">يوثق أوقات استلام وتسليم الشبابيك من قبل مندوبي الوكالات</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={shiftSearch}
                    onChange={e => setShiftSearch(e.target.value)}
                    placeholder="بحث باسم المندوب أو الشباك..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-amber-500 pr-9"
                  />
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">اسم المندوب</th>
                      <th className="py-3 px-4">الشباك</th>
                      <th className="py-3 px-4">وقت بدء العمل</th>
                      <th className="py-3 px-4">وقت الانتهاء</th>
                      <th className="py-3 px-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {counterSessions.filter(cs => 
                      cs.staffName.includes(shiftSearch) || cs.counterName.includes(shiftSearch)
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          لا توجد سجلات مناوبات مسجلة بعد
                        </td>
                      </tr>
                    ) : (
                      counterSessions.filter(cs => 
                        cs.staffName.includes(shiftSearch) || cs.counterName.includes(shiftSearch)
                      ).map(cs => (
                        <tr key={cs.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">{cs.staffName}</td>
                          <td className="py-3 px-4 text-slate-700">{cs.counterName}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {new Date(cs.startedAt).toLocaleTimeString('ar-SY')}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {cs.endedAt ? new Date(cs.endedAt).toLocaleTimeString('ar-SY') : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                              !cs.endedAt ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {!cs.endedAt ? 'نشط حالياً' : 'مكتملة'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: نظرة عامة والتقارير (OVERVIEW & REPORTS)     */}
      {/* ======================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-1">
              <div className="text-xs text-slate-500 font-bold">بانتظار النداء</div>
              <div className="text-3xl font-black font-mono text-amber-600">{waitingTickets.length}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-1">
              <div className="text-xs text-slate-500 font-bold">قيد الخدمة الآن</div>
              <div className="text-3xl font-black font-mono text-blue-600">{servingTickets.length}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-1">
              <div className="text-xs text-slate-500 font-bold">معاملات مكتملة</div>
              <div className="text-3xl font-black font-mono text-emerald-600">{completedTickets.length}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-1">
              <div className="text-xs text-slate-500 font-bold">تجاوز الدور</div>
              <div className="text-3xl font-black font-mono text-slate-600">{skippedTickets.length}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-1">
              <div className="text-xs text-slate-500 font-bold">معاملات ملغاة</div>
              <div className="text-3xl font-black font-mono text-red-600">{cancelledTickets.length}</div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-800">تصدير التقارير والنسخ الاحتياطي</h3>
            <p className="text-xs text-slate-500">تصدير جميع معاملات اليوم إلى ملف Excel / CSV أو حفظ واستعادة نسخة احتياطية من قاعدة البيانات المحلية.</p>
            
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleExportCSV}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" /> تصدير تقرير اليوم إلى Excel / CSV
              </button>

              <button
                onClick={handleBackup}
                className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" /> تحميل نسخة احتياطية كاملة (JSON)
              </button>

              <label className="px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer">
                <Upload className="w-4 h-4" /> استعادة قاعدة البيانات من ملف
                <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: إعدادات الشاشة والتطبيق (SETTINGS & DISPLAY)   */}
      {/* ======================================================== */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Tv className="w-5 h-5 text-amber-600" />
              إعدادات شاشة العرض وصالة الانتظار
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">عنوان الدائرة (الترويسة الرئيسية):</label>
                <input
                  type="text"
                  value={formSettings.departmentTitle}
                  onChange={e => setFormSettings({ ...formSettings, departmentTitle: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">الترويسة الفرعية:</label>
                <input
                  type="text"
                  value={formSettings.departmentSubtitle}
                  onChange={e => setFormSettings({ ...formSettings, departmentSubtitle: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">شريط الأخبار والتعليمات المتحرك (الأسفل):</label>
                <textarea
                  rows={2}
                  value={formSettings.tickerMessage}
                  onChange={e => setFormSettings({ ...formSettings, tickerMessage: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-slate-800">التنبيهات الصوتية ونطق الأرقام</div>
                  <div className="text-[11px] text-slate-500">تشغيل نغمة تنبيه صوتي عند استدعاء أو إعادة نداء أي دور</div>
                </div>
                <input
                  type="checkbox"
                  checked={formSettings.soundAlertsEnabled}
                  onChange={e => setFormSettings({ ...formSettings, soundAlertsEnabled: e.target.checked })}
                  className="w-5 h-5 accent-amber-600 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">بداية الدوام:</label>
                  <input
                    type="time"
                    value={formSettings.workingHoursStart}
                    onChange={e => setFormSettings({ ...formSettings, workingHoursStart: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">نهاية الدوام:</label>
                  <input
                    type="time"
                    value={formSettings.workingHoursEnd}
                    onChange={e => setFormSettings({ ...formSettings, workingHoursEnd: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">تسلسل الترقيم الحالي (رقم آخر تذكرة صدرت اليوم):</label>
                <input
                  type="number"
                  min="0"
                  value={formSettings.ticketSequence}
                  onChange={e => setFormSettings({ ...formSettings, ticketSequence: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md transition-all"
              >
                حفظ إعدادات النظام والشاشة
              </button>
            </form>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              تغيير رمز الدخول السري للمدير العام
            </h3>

            {pinChangeMsg && (
              <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                pinChangeMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {pinChangeMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{pinChangeMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">رمز المدير الحالي:</label>
                <input
                  type="password"
                  value={currentAdminPin}
                  onChange={e => setCurrentAdminPin(e.target.value)}
                  placeholder="أدخل الرمز الحالي"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">رمز المدير الجديد:</label>
                <input
                  type="password"
                  value={newAdminPin}
                  onChange={e => setNewAdminPin(e.target.value)}
                  placeholder="أدخل الرمز الجديد (4 - 8 أرقام)"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition-all"
              >
                تحديث رمز المدير العام
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 4: سجل التدقيق والرقابة (AUDIT TRAIL)            */}
      {/* ======================================================== */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">سجل التدقيق والعمليات الدائم</h3>
              <p className="text-xs text-slate-500">سجل محمي ومؤرشف لجميع الأنشطة الإدارية وحركات التذاكر لمنع التلاعب وتوفير الشفافية الكاملة</p>
            </div>
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                placeholder="بحث في سجل العمليات..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-amber-500 pr-9"
              />
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">الوقت والتاريخ</th>
                  <th className="py-3 px-4">نوع الإجراء</th>
                  <th className="py-3 px-4">تفاصيل العملية</th>
                  <th className="py-3 px-4">المستخدم المسؤول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.filter(l => 
                  l.action.includes(logSearch) || 
                  l.details.includes(logSearch) || 
                  l.user.includes(logSearch)
                ).map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('ar-SY')} · {new Date(log.timestamp).toLocaleDateString('ar-SY')}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-700">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {log.details}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {log.user}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT TICKET                                       */}
      {/* ======================================================== */}
      {editingTicket && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">تعديل بيانات تذكرة الدور إدارياً</h3>
              <button onClick={() => setEditingTicket(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveTicket} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">رقم التذكرة الظاهر (مع البادئة):</label>
                <input
                  type="text"
                  value={ticketFormNumber}
                  onChange={e => setTicketFormNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">حالة التذكرة:</label>
                <select
                  value={ticketFormStatus}
                  onChange={e => setTicketFormStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-semibold"
                >
                  <option value="waiting">قيد الانتظار (waiting)</option>
                  <option value="serving">قيد الخدمة على الشباك (serving)</option>
                  <option value="completed">مكتملة الخدمة (completed)</option>
                  <option value="skipped">متجاوزة لعدم الحضور (skipped)</option>
                  <option value="cancelled">ملغاة بأمر إداري (cancelled)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">إسناد إلى الشباك:</label>
                <select
                  value={ticketFormCounter}
                  onChange={e => setTicketFormCounter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs"
                >
                  <option value="">-- بدون شباك محدد --</option>
                  {counters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ملاحظات إدارية:</label>
                <input
                  type="text"
                  value={ticketFormNotes}
                  onChange={e => setTicketFormNotes(e.target.value)}
                  placeholder="سبب التعديل أو ملاحظة..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTicket(null)}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT COUNTER                                */}
      {/* ======================================================== */}
      {showAddCounterModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCounter ? 'تعديل بيانات الشباك' : 'إضافة شباك جديد'}
              </h3>
              <button onClick={() => setShowAddCounterModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveCounter} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">اسم الشباك:</label>
                <input
                  type="text"
                  value={counterFormName}
                  onChange={e => setCounterFormName(e.target.value)}
                  placeholder="مثال: الشباك 5 (وكالات عامة)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-semibold"
                  required
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs font-bold text-slate-700">حالة الشباك (مفتوح ومتاح لاختيار المندوبين):</span>
                <input
                  type="checkbox"
                  checked={counterFormOpen}
                  onChange={e => setCounterFormOpen(e.target.checked)}
                  className="w-5 h-5 accent-amber-600 rounded"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  حفظ الشباك
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCounterModal(false)}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MOVE STAFF COUNTER                                */}
      {/* ======================================================== */}
      {moveStaffModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">نقل المندوب إلى شباك آخر</h3>
              <button onClick={() => setMoveStaffModal(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleMoveStaffSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                <div>المندوب: <strong className="text-slate-900">{moveStaffModal.staff.name}</strong></div>
                <div>الشباك الحالي: <strong className="text-amber-800">{moveStaffModal.currentCounterName}</strong></div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">اختر الشباك الجديد للنقل إليه:</label>
                <select
                  value={targetMoveCounterId}
                  onChange={e => setTargetMoveCounterId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-semibold"
                  required
                >
                  <option value="">-- اضغط لاختيار شباك متاح --</option>
                  {counters.filter(c => c.isOpen && !c.currentStaffId).map(c => (
                    <option key={c.id} value={c.id}>{c.name} (متاح)</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!targetMoveCounterId}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  تأكيد نقل المندوب
                </button>
                <button
                  type="button"
                  onClick={() => setMoveStaffModal(null)}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT STAFF                                  */}
      {/* ======================================================== */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingStaff ? 'تعديل بيانات الموظف والصلاحيات' : 'إضافة موظف / مندوب جديد'}
              </h3>
              <button onClick={() => setShowAddStaffModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">اسم الموظف الكامل:</label>
                <input
                  type="text"
                  value={staffFormName}
                  onChange={e => setStaffFormName(e.target.value)}
                  placeholder="مثال: يوسف الحلبي"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">رمز الدخول الشخصي (PIN):</label>
                <input
                  type="text"
                  maxLength={6}
                  value={staffFormPin}
                  onChange={e => setStaffFormPin(e.target.value)}
                  placeholder="مثال: 4567"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-center tracking-widest"
                  required
                />
              </div>

              {/* Allowed Counters Selection */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                <div className="text-xs font-bold text-slate-800">الشبابيك المسموح للمندوب باختيارها:</div>
                <div className="text-[11px] text-slate-500 pb-1">
                  إذا لم يتم تحديد أي شباك، سيكون مسموحاً له بالعمل على جميع الشبابيك.
                </div>
                <div className="space-y-1.5">
                  {counters.map(counter => {
                    const isChecked = staffFormAllowedCounters.includes(counter.id);
                    return (
                      <label key={counter.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setStaffFormAllowedCounters([...staffFormAllowedCounters, counter.id]);
                            } else {
                              setStaffFormAllowedCounters(staffFormAllowedCounters.filter(id => id !== counter.id));
                            }
                          }}
                          className="w-4 h-4 accent-amber-600 rounded"
                        />
                        <span>{counter.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs font-bold text-slate-700">تفعيل الحساب (يسمح له بتسجيل الدخول):</span>
                <input
                  type="checkbox"
                  checked={staffFormActive}
                  onChange={e => setStaffFormActive(e.target.checked)}
                  className="w-5 h-5 accent-amber-600 rounded"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  حفظ بيانات الموظف
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIRM ACTION (CRITICAL OPERATIONS)             */}
      {/* ======================================================== */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">{confirmModal.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-md transition-all"
              >
                تأكيد الإجراء
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-all"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
