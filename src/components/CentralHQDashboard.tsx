/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Send,
  Database,
  Search,
  Plus,
  Paperclip,
  Check,
  X,
  ExternalLink,
  Users,
  Ticket as TicketIcon,
  ShieldCheck,
  Lock,
  UserCheck,
  Key,
  Edit,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Branch, AgencyTransaction, SyncHistoryLog, SyncSettings, Ticket, AuditLog, BranchManagerUser } from '../types';
import { apiFetch } from '../utils/network';

interface CentralHQDashboardProps {
  currentBranchId?: string;
  adminToken?: string;
  onRefreshState?: () => void;
}

export function CentralHQDashboard({ currentBranchId, adminToken, onRefreshState }: CentralHQDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'agencies' | 'managers' | 'sync_status' | 'settings'>('overview');
  
  // Branch Managers state
  const [branchManagers, setBranchManagers] = useState<BranchManagerUser[]>([]);
  const [showManagerModal, setShowManagerModal] = useState<boolean>(false);
  const [editingManager, setEditingManager] = useState<BranchManagerUser | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [managerForm, setManagerForm] = useState({
    branchId: 'branch-aleppo-main',
    branchName: 'المقر الرئيسي - القصر العدلي بحلب',
    fullName: '',
    username: '',
    password: '',
    active: true
  });

  // HQ Data state
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [summary, setSummary] = useState<any>({
    totalBranches: 5,
    activeBranches: 5,
    totalTodayTickets: 0,
    totalCompletedTickets: 0,
    totalAgenciesCount: 0
  });

  const [ticketsByBranch, setTicketsByBranch] = useState<Record<string, Ticket[]>>({});
  const [auditLogsByBranch, setAuditLogsByBranch] = useState<Record<string, AuditLog[]>>({});
  const [agenciesList, setAgenciesList] = useState<AgencyTransaction[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryLog[]>([]);
  const [syncQueueCount, setSyncQueueCount] = useState<number>(0);
  const [isFromLocalCache, setIsFromLocalCache] = useState<boolean>(false);
  const [lastFetchedTime, setLastFetchedTime] = useState<string>('');

  // Selected Branch Details Modal state
  const [selectedBranchModal, setSelectedBranchModal] = useState<Branch | null>(null);
  const [branchModalTab, setBranchModalTab] = useState<'tickets' | 'agencies' | 'audits' | 'info'>('tickets');

  // Sync Settings form state
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    branchId: 'branch-aleppo-main',
    branchName: 'المقر الرئيسي - القصر العدلي بحلب',
    branchCode: 'ALP-MAIN',
    isHeadquarters: true,
    supabaseUrl: '',
    supabaseKey: '',
    syncIntervalMinutes: 2,
    autoSyncEnabled: false,
    lastSyncStatus: 'idle'
  });
  const [testResult, setTestResult] = useState<{ testing: boolean; message?: string; success?: boolean }>({ testing: false });

  // New Agency Modal state
  const [showAddAgencyModal, setShowAddAgencyModal] = useState<boolean>(false);
  const [newAgency, setNewAgency] = useState<Partial<AgencyTransaction>>({
    agencyNumber: '',
    agencyYear: new Date().getFullYear(),
    agencyType: 'توثيق وكالة عامة',
    principalsNames: '',
    lawyersNames: '',
    nationalId: '',
    feesPaid: 0,
    receiptNumber: '',
    notaryDelegateName: 'مندوب رئيس الفرع',
    status: 'approved',
    notes: ''
  });
  const [attachedFileName, setAttachedFileName] = useState<string>('');
  const [attachedFileBase64, setAttachedFileBase64] = useState<string>('');
  const [agencySearchQuery, setAgencySearchQuery] = useState<string>('');

  // Fetch HQ branches data
  const loadHQData = async (forcePull: boolean = false) => {
    setLoading(true);
    setActionMessage(null);
    try {
      if (forcePull) {
        // Trigger pull from Supabase
        await apiFetch('/api/sync/pull-hq', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { 'x-admin-token': adminToken } : {})
          }
        });
      }

      const res = await apiFetch('/api/hq/branches-data');
      if (res && res.data) {
        setBranches(res.data.branches || []);
        setSummary(res.data.summary || {});
        setTicketsByBranch(res.data.ticketsByBranch || {});
        setAuditLogsByBranch(res.data.auditLogsByBranch || {});
        setIsFromLocalCache(Boolean(res.fromLocalCache));
        setLastFetchedTime(new Date(res.data.lastUpdated || Date.now()).toLocaleTimeString('ar-SY'));
      }

      // Fetch agencies
      const agenciesRes = await apiFetch('/api/agencies');
      if (Array.isArray(agenciesRes)) {
        setAgenciesList(agenciesRes);
      }

      // Fetch sync settings
      const syncRes = await apiFetch('/api/sync/settings');
      if (syncRes && syncRes.settings) {
        setSyncSettings(syncRes.settings);
        setSyncQueueCount(syncRes.pendingCount || 0);
        setSyncHistory(syncRes.history || []);
      }

      // Fetch branch managers
      try {
        const bmRes = await apiFetch('/api/admin/branch-managers');
        if (bmRes && bmRes.success && Array.isArray(bmRes.data)) {
          setBranchManagers(bmRes.data);
          try {
            localStorage.setItem('agency_branch_managers', JSON.stringify(bmRes.data));
          } catch {}
        }
      } catch {
        try {
          const raw = localStorage.getItem('agency_branch_managers');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setBranchManagers(parsed);
          }
        } catch {}
      }
    } catch (err: any) {
      console.warn('Error loading HQ branches data:', err);
      setActionMessage({ text: 'تم تحميل البيانات المخزنة محلياً في المقر (وضع أوفلاين).', type: 'info' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManager = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedBranch = branches.find(b => b.id === managerForm.branchId);
      const payload = {
        id: editingManager ? editingManager.id : undefined,
        branchId: managerForm.branchId,
        branchName: selectedBranch?.name || managerForm.branchName,
        fullName: managerForm.fullName,
        username: managerForm.username,
        password: managerForm.password,
        active: managerForm.active
      };

      const res = await apiFetch('/api/admin/branch-managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setActionMessage({ text: res.message || 'تم حفظ وتعيين بيانات مدير الفرع بنجاح.', type: 'success' });
        setShowManagerModal(false);
        setEditingManager(null);
        loadHQData(false);
      }
    } catch (err: any) {
      alert(err.message || 'فشل حفظ بيانات مدير الفرع.');
    }
  };

  const handleDeleteManager = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب المدير "${name}" نهائياً؟`)) return;
    try {
      const res = await apiFetch(`/api/admin/branch-managers/${id}`, {
        method: 'DELETE',
        headers: {
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        }
      });
      if (res && res.success) {
        setActionMessage({ text: res.message || 'تم حذف حساب المدير بنجاح.', type: 'success' });
        loadHQData(false);
      }
    } catch (err: any) {
      alert(err.message || 'فشل حذف حساب المدير.');
    }
  };

  useEffect(() => {
    loadHQData();
    const interval = setInterval(() => loadHQData(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // Trigger Sync Push
  const handleTriggerPush = async () => {
    setSyncing(true);
    setActionMessage(null);
    try {
      const res = await apiFetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        }
      });
      if (res && res.success) {
        setActionMessage({ text: res.message || 'تمت المزامنة بنجاح!', type: 'success' });
      } else {
        setActionMessage({ text: res.message || 'فشلت المزامنة، تم الحفظ في قائمة الانتظار.', type: 'error' });
      }
      loadHQData(false);
    } catch (err: any) {
      setActionMessage({ text: `تعذر الاتصال بالسحابة: ${err.message || 'انقطاع النت'} (البيانات محفوظة محلياً)`, type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  // Trigger Pull to HQ
  const handleTriggerPullHQ = async () => {
    setSyncing(true);
    setActionMessage(null);
    try {
      const res = await apiFetch('/api/sync/pull-hq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        }
      });
      if (res && res.success) {
        setActionMessage({ text: res.message || 'تم تحديث وجلب بيانات كافة الفروع بنجاح!', type: 'success' });
      } else {
        setActionMessage({ text: res.message || 'تعذر جلب التحديثات الجديدة من السحابة.', type: 'error' });
      }
      loadHQData(false);
    } catch (err: any) {
      setActionMessage({ text: `تعذر الاتصال بالسحابة: ${err.message || 'انقطاع النت'} (تعمل اللوحة من الكاش المحلي)`, type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  // Test Supabase connection
  const handleTestConnection = async () => {
    setTestResult({ testing: true });
    try {
      const res = await apiFetch('/api/sync/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl: syncSettings.supabaseUrl,
          supabaseKey: syncSettings.supabaseKey
        })
      });
      setTestResult({
        testing: false,
        success: res.success,
        message: res.message
      });
    } catch (err: any) {
      setTestResult({
        testing: false,
        success: false,
        message: err.message || 'تعذر الاتصال بالسحابة.'
      });
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    try {
      const res = await apiFetch('/api/sync/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify(syncSettings)
      });
      if (res && res.success) {
        setActionMessage({ text: 'تم حفظ إعدادات المزامنة السحابية بنجاح!', type: 'success' });
        if (onRefreshState) onRefreshState();
      }
    } catch (err: any) {
      setActionMessage({ text: `خطأ في الحفظ: ${err.message}`, type: 'error' });
    }
  };

  // Handle Attachment File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit New Agency
  const handleSaveAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgency)
      });

      if (res && res.success) {
        // If file attached, upload it
        if (attachedFileName && attachedFileBase64) {
          await apiFetch('/api/attachments/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              localTicketId: newAgency.localTicketId || '',
              fileName: attachedFileName,
              fileBase64: attachedFileBase64,
              fileType: 'image/jpeg'
            })
          });
        }

        setShowAddAgencyModal(false);
        setAttachedFileName('');
        setAttachedFileBase64('');
        setActionMessage({ text: `تم حفظ وتوثيق الوكالة رقم ${newAgency.agencyNumber} بنجاح!`, type: 'success' });
        loadHQData(false);
      }
    } catch (err: any) {
      alert(`خطأ: ${err.message || 'تعذر حفظ المعاملة'}`);
    }
  };

  // Filter agencies
  const filteredAgencies = agenciesList.filter(a => {
    const matchesBranch = selectedBranchId === 'all' || a.branchId === selectedBranchId;
    const matchesSearch =
      !agencySearchQuery.trim() ||
      a.agencyNumber.includes(agencySearchQuery) ||
      a.principalsNames.includes(agencySearchQuery) ||
      a.lawyersNames.includes(agencySearchQuery) ||
      a.agencyType.includes(agencySearchQuery);
    return matchesBranch && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-100" dir="rtl">
      {/* Top Banner / Mode Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  الرقابة المركزية وإدارة الفروع
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    {syncSettings.isHeadquarters ? 'كمبيوتر المقر الرئيسي' : 'خادم الفرع المحلي'}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  منظومة الربط السحابي ومزامنة 5 إلى 10 مكاتب فرعية مع الحفاظ على العمل أوفلاين دون إنترنت
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions & Status Badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Offline Cache Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-slate-800/80 border-slate-700">
              <span className={`w-2.5 h-2.5 rounded-full ${isFromLocalCache ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-slate-300">
                {isFromLocalCache ? 'مخزن محلياً (أوفلاين)' : 'متزامن مع السحابة'}
              </span>
              {lastFetchedTime && <span className="text-[10px] text-slate-400 mr-1">({lastFetchedTime})</span>}
            </div>

            {/* Pending queue badge */}
            {syncQueueCount > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                <span>{syncQueueCount} في طابور الرفع</span>
              </div>
            )}

            {/* Sync Button */}
            <button
              onClick={syncSettings.isHeadquarters ? handleTriggerPullHQ : handleTriggerPush}
              disabled={syncing}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'جارِ المزامنة...' : syncSettings.isHeadquarters ? 'جلب بيانات كافة الفروع' : 'مزامنة بيانات الفرع'}</span>
            </button>
          </div>
        </div>

        {/* Action message */}
        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : actionMessage.type === 'error'
                ? 'bg-red-950/60 border-red-500/40 text-red-300'
                : 'bg-blue-950/60 border-blue-500/40 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {actionMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
              {actionMessage.type === 'info' && <Database className="w-4 h-4 text-blue-400" />}
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>مكاتب الفروع ({branches.length || 5})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('agencies')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'agencies'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>سجل الوكالات والمعاملات ({agenciesList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sync_status')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'sync_status'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>سجل المزامنة والطابور ({syncHistory.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('managers')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'managers'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>مدراء الفروع والصلاحيات ({branchManagers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'settings'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>إعدادات الربط مع Supabase</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* SUBTAB 1: OVERVIEW OF ALL BRANCHES */}
      {/* ================================================================= */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Aggregated KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                الفروع النشطة
              </div>
              <div className="text-2xl font-black text-white">{branches.filter(b => b.isActive).length || 5} <span className="text-xs text-slate-500 font-normal">من أصل {branches.length || 5}</span></div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                <TicketIcon className="w-3.5 h-3.5 text-blue-400" />
                إجمالي التذاكر اليوم
              </div>
              <div className="text-2xl font-black text-blue-400">{summary.totalTodayTickets || 0}</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                المعاملات المنجزة
              </div>
              <div className="text-2xl font-black text-emerald-400">{summary.totalCompletedTickets || 0}</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                سجلات الوكالات الموثقة
              </div>
              <div className="text-2xl font-black text-purple-400">{summary.totalAgenciesCount || agenciesList.length}</div>
            </div>
          </div>

          {/* Branches Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>المكاتب والفروع الجغرافية لنقابة المحامين</span>
                <span className="text-xs text-slate-400">({branches.length} مكاتب متصلة)</span>
              </h2>

              <button
                onClick={() => loadHQData(true)}
                disabled={loading}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>تحديث البيانات من السحابة</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map(branch => {
                const isSelected = selectedBranchId === branch.id;
                const branchTickets = ticketsByBranch[branch.id] || [];
                const completedCount = branchTickets.filter(t => t.status === 'completed').length;

                return (
                  <div
                    key={branch.id}
                    onClick={() => setSelectedBranchModal(branch)}
                    className={`bg-slate-900 border rounded-2xl p-4 transition-all shadow-md relative overflow-hidden cursor-pointer hover:border-amber-500/80 hover:shadow-amber-500/10 ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-500/20'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm">{branch.name}</h3>
                          {branch.isHeadquarters && (
                            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-500/30">
                              المقر
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{branch.city}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">{branch.code}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          branch.isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-700 text-slate-400 border-slate-600'
                        }`}
                      >
                        {branch.isActive ? 'نشط' : 'متوقف'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-950/60 rounded-xl p-2.5 text-center my-3 border border-slate-800/60">
                      <div>
                        <div className="text-[10px] text-slate-400">تذاكر اليوم</div>
                        <div className="text-base font-black text-white">{branchTickets.length || branch.todayTicketsCount || 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">منجز</div>
                        <div className="text-base font-black text-emerald-400">{completedCount || branch.todayCompletedCount || 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">المندوبين</div>
                        <div className="text-base font-black text-amber-400">{branch.activeStaffCount || 1}</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2.5 mt-2">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>آخر مزامنة:</span>
                        <span className="text-slate-300 font-mono text-[10px]">
                          {branch.lastSyncAt ? new Date(branch.lastSyncAt).toLocaleTimeString('ar-SY') : 'اليوم'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedBranchModal(branch)}
                          className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <span>عرض كافة البيانات</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUBTAB 2: AGENCIES & LEGAL TRANSACTIONS */}
      {/* ================================================================= */}
      {activeSubTab === 'agencies' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث برقم الوكالة أو اسم الموكل أو المحامي..."
                  value={agencySearchQuery}
                  onChange={e => setAgencySearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64 sm:w-80"
                />
              </div>

              {/* Branch filter dropdown */}
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">جميع الفروع والمكاتب</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowAddAgencyModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل معاملة وكالة جديدة</span>
            </button>
          </div>

          {/* Agencies Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                  <tr>
                    <th className="p-3.5">رقم الوكالة</th>
                    <th className="p-3.5">نوع المعاملة</th>
                    <th className="p-3.5">أسماء الموكلين</th>
                    <th className="p-3.5">المحامون الوكلاء</th>
                    <th className="p-3.5">الفرع</th>
                    <th className="p-3.5">الرسوم</th>
                    <th className="p-3.5">مندوب التوثيق</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAgencies.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        لا توجد معاملات وكالات مسجلة تطابق البحث حالياً. يمكنك النقر على "تسجيل معاملة وكالة جديدة" لإضافة سجل جديد.
                      </td>
                    </tr>
                  ) : (
                    filteredAgencies.map((agency) => {
                      const branchInfo = branches.find(b => b.id === agency.branchId);

                      return (
                        <tr key={agency.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-amber-400">
                            {agency.agencyNumber} <span className="text-slate-500 text-[10px]">/{agency.agencyYear || 2026}</span>
                          </td>
                          <td className="p-3.5 font-bold text-white">{agency.agencyType}</td>
                          <td className="p-3.5 font-bold text-slate-200">{agency.principalsNames}</td>
                          <td className="p-3.5 text-slate-300">{agency.lawyersNames}</td>
                          <td className="p-3.5 text-slate-400">
                            <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                              {branchInfo ? branchInfo.name : agency.branchId}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-emerald-400 font-bold">
                            {agency.feesPaid ? `${agency.feesPaid.toLocaleString('ar-SY')} ل.س` : '-'}
                          </td>
                          <td className="p-3.5 text-slate-400">{agency.notaryDelegateName || '-'}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                agency.isRevoked
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {agency.isRevoked ? 'معزولة' : 'موثقة سارية'}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-500 text-[10px]">
                            {new Date(agency.createdAt).toLocaleDateString('ar-SY')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUBTAB 3: SYNC QUEUE & HISTORY LOGS */}
      {/* ================================================================= */}
      {activeSubTab === 'sync_status' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-bold mb-1">المعاملات المعلقة في طابور الرفع</div>
              <div className="text-3xl font-black text-amber-400">{syncQueueCount}</div>
              <div className="text-[11px] text-slate-500 mt-1">تُرفع تلقائياً عند استشعار توفر الإنترنت</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-bold mb-1">آخر توقيت مزامنة</div>
              <div className="text-base font-black text-white font-mono mt-1">
                {syncSettings.lastSyncTimestamp ? new Date(syncSettings.lastSyncTimestamp).toLocaleString('ar-SY') : 'لم تتم بعد'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">{syncSettings.lastSyncMessage || 'في انتظار التنفيذ'}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-bold mb-1">المزامنة الدورية الخلفية</div>
              <div className="text-base font-bold text-white mt-1 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${syncSettings.autoSyncEnabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span>{syncSettings.autoSyncEnabled ? `مفعلة (كل ${syncSettings.syncIntervalMinutes} دقيقة)` : 'معطلة (تشغيل يدوي)'}</span>
              </div>
            </div>
          </div>

          {/* History table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">سجل العمليات والمزامنات المركزية الأحدث</h3>
              <span className="text-xs text-slate-500">آخر 20 حركة</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                  <tr>
                    <th className="p-3">الاتجاه</th>
                    <th className="p-3">الفرع</th>
                    <th className="p-3">عدد السجلات</th>
                    <th className="p-3">النتيجة</th>
                    <th className="p-3">تفاصيل المزامنة</th>
                    <th className="p-3">الوقت والتاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {syncHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        لا توجد سجلات مزامنة سابقة حتى الآن. يمكنك النقر على زر "مزامنة الآن" لإجراء أول عملية.
                      </td>
                    </tr>
                  ) : (
                    syncHistory.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3 font-bold">
                          {item.syncDirection === 'branch_to_cloud' ? (
                            <span className="text-blue-400 flex items-center gap-1">
                              <span>الفرع</span> <span>←</span> <span>السحابة</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <span>السحابة</span> <span>←</span> <span>المقر</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-white">{item.branchName || item.branchId}</td>
                        <td className="p-3 font-mono font-bold text-amber-400">{item.recordsPushed}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.status === 'success'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}
                          >
                            {item.status === 'success' ? 'ناجحة' : 'خطأ'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{item.details}</td>
                        <td className="p-3 font-mono text-slate-500 text-[10px]">
                          {new Date(item.timestamp).toLocaleString('ar-SY')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUBTAB 4: BRANCH MANAGERS MANAGEMENT (تعريف مدراء الفروع)           */}
      {/* ================================================================= */}
      {activeSubTab === 'managers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <span>إدارة وتعريف مدراء الفروع المستقلين</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تمنح الإدارة المركزية كل مدير فرع اسم مستخدم وكلمة مرور مستقلة تماماً للدخول إلى فرعه الخاص، ولا يمكن الدخول برمز موظف أو مندوب.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingManager(null);
                setManagerForm({
                  branchId: branches[0]?.id || 'branch-aleppo-main',
                  branchName: branches[0]?.name || 'المقر الرئيسي - القصر العدلي بحلب',
                  fullName: '',
                  username: '',
                  password: '',
                  active: true
                });
                setShowManagerModal(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة وتعيين مدير فرع جديد</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                  <tr>
                    <th className="p-3.5">الفرع والمكتب</th>
                    <th className="p-3.5">اسم مدير الفرع</th>
                    <th className="p-3.5">اسم المستخدم (Username)</th>
                    <th className="p-3.5">كلمة المرور السرية</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">آخر تسجيل دخول</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {branchManagers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        لا يوجد مدراء فروع مسجلين حالياً. اضغط على زر "إضافة وتعيين مدير فرع جديد" للبدء.
                      </td>
                    </tr>
                  ) : (
                    branchManagers.map((mgr) => (
                      <tr key={mgr.id} className="hover:bg-slate-800/30">
                        <td className="p-3.5 font-bold text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>{mgr.branchName}</span>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-200">{mgr.fullName}</td>
                        <td className="p-3.5 font-mono font-bold text-amber-400 bg-slate-950/40 rounded px-2">{mgr.username}</td>
                        <td className="p-3.5 font-mono text-slate-300">
                          <div className="flex items-center gap-2">
                            <span>{revealedPasswords[mgr.id] ? mgr.password : '••••••••'}</span>
                            <button
                              type="button"
                              onClick={() => setRevealedPasswords(prev => ({ ...prev, [mgr.id]: !prev[mgr.id] }))}
                              className="text-slate-500 hover:text-slate-300"
                              title={revealedPasswords[mgr.id] ? 'إخفاء' : 'إظهار كلمة المرور'}
                            >
                              {revealedPasswords[mgr.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${mgr.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                            {mgr.active ? 'مفعل' : 'معطل'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                          {mgr.lastLoginAt ? new Date(mgr.lastLoginAt).toLocaleString('ar-SY') : 'لم يدخل بعد'}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingManager(mgr);
                                setManagerForm({
                                  branchId: mgr.branchId,
                                  branchName: mgr.branchName,
                                  fullName: mgr.fullName,
                                  username: mgr.username,
                                  password: mgr.password || '',
                                  active: mgr.active
                                });
                                setShowManagerModal(true);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors cursor-pointer"
                              title="تعديل الحساب أو تغيير كلمة المرور"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteManager(mgr.id, mgr.fullName)}
                              className="p-1.5 bg-slate-800 hover:bg-red-950 text-red-400 rounded-lg transition-colors cursor-pointer"
                              title="حذف الحساب"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUBTAB 5: SUPABASE & MULTI-BRANCH SETTINGS */}
      {/* ================================================================= */}
      {activeSubTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSaveSettings} className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-lg">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              <span>إعدادات قاعدة البيانات المركزية Supabase لهذا الجهاز</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">معرف الفرع (Branch ID)</label>
                <input
                  type="text"
                  value={syncSettings.branchId}
                  onChange={e => setSyncSettings({ ...syncSettings, branchId: e.target.value })}
                  placeholder="branch-aleppo-main"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المكتب / الفرع</label>
                <input
                  type="text"
                  value={syncSettings.branchName}
                  onChange={e => setSyncSettings({ ...syncSettings, branchName: e.target.value })}
                  placeholder="المقر الرئيسي - القصر العدلي بحلب"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">كود الفرع المختصر</label>
                <input
                  type="text"
                  value={syncSettings.branchCode}
                  onChange={e => setSyncSettings({ ...syncSettings, branchCode: e.target.value })}
                  placeholder="ALP-MAIN"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono uppercase"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="isHqCheck"
                  checked={syncSettings.isHeadquarters}
                  onChange={e => setSyncSettings({ ...syncSettings, isHeadquarters: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="isHqCheck" className="text-xs font-bold text-slate-200 cursor-pointer">
                  هذا الجهاز هو كمبيوتر المقر الرئيسي (لوحة الرقابة المركزية)
                </label>
              </div>
            </div>

            {/* Environment Secrets Notice */}
            <div className={`p-4 rounded-2xl border text-xs ${
              syncSettings.isKeyFromEnv
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-950/60 border-slate-700/60 text-slate-300'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${
                  syncSettings.isKeyFromEnv
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span>حماية المفاتيح والأسرار السحابية (Environment Secrets)</span>
                    {syncSettings.isKeyFromEnv && (
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                        مفعل ومحمي في بيئة الخادم
                      </span>
                    )}
                  </div>
                  {syncSettings.isKeyFromEnv ? (
                    <p className="text-emerald-300/90 leading-relaxed text-[11px]">
                      مفتاح Supabase مضبوط بأمان تام ضمن أسرار بيئة التشغيل (<code>SUPABASE_KEY</code>). لا يتم إرسال المفتاح للمتصفح مطلقاً ويقوم الخادم بالاتصال المباشر بالسحابة.
                    </p>
                  ) : (
                    <p className="text-slate-400 leading-relaxed text-[11px]">
                      <strong>الأكثر أماناً:</strong> يمكنك وضع المفتاح السحابي مباشرة في ملف <code>.env</code> تحت المتغير <code>SUPABASE_KEY</code> أو لوحة أسرار السيرفر، وسيلتقطه النظام تلقائياً دون الحاجة لكتابته يدوياً في المتصفح.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    رابط مشروع Supabase (Project URL)
                  </label>
                  {syncSettings.isUrlFromEnv && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                      مضبوط من أسرار الخادم
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  value={syncSettings.supabaseUrl}
                  onChange={e => setSyncSettings({ ...syncSettings, supabaseUrl: e.target.value })}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">يتم الحصول عليه من لوحة Supabase &gt; Project Settings &gt; API</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>مفتاح Supabase (service_role key أو anon key)</span>
                  </label>
                  {syncSettings.isKeyFromEnv ? (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>محمي عبر بيئة التشغيل (SUPABASE_KEY)</span>
                    </span>
                  ) : syncSettings.isKeyConfigured ? (
                    <span className="text-[10px] text-blue-400 font-bold bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded">
                      محفوظ ومحمي
                    </span>
                  ) : null}
                </div>

                <div className="relative">
                  <input
                    type="password"
                    disabled={syncSettings.isKeyFromEnv}
                    value={syncSettings.isKeyFromEnv ? '•••••••••••••••• (محمي بأمان عبر أسرار بيئة التشغيل)' : syncSettings.supabaseKey}
                    onChange={e => setSyncSettings({ ...syncSettings, supabaseKey: e.target.value })}
                    placeholder={syncSettings.isKeyConfigured ? '••••••••••••••••' : 'eyJh......'}
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono ${
                      syncSettings.isKeyFromEnv
                        ? 'border-emerald-500/40 text-emerald-300 cursor-not-allowed opacity-90'
                        : 'border-slate-700'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {syncSettings.isKeyFromEnv
                    ? 'تم حجب المفتاح لأسباب أمنية؛ الخادم يستخدمه مباشرة للتواصل مع Supabase.'
                    : 'يتم تشفيره وحجبه تلقائياً لمنع ظهوره على شاشات المتصفح.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">دورية المزامنة التلقائية (بالدقائق)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={syncSettings.syncIntervalMinutes}
                    onChange={e => setSyncSettings({ ...syncSettings, syncIntervalMinutes: parseInt(e.target.value) || 2 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="autoSyncCheck"
                    checked={syncSettings.autoSyncEnabled}
                    onChange={e => setSyncSettings({ ...syncSettings, autoSyncEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-slate-950 border-slate-700 cursor-pointer"
                  />
                  <label htmlFor="autoSyncCheck" className="text-xs font-bold text-slate-200 cursor-pointer">
                    تفعيل المزامنة التلقائية الدورية في الخلفية
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testResult.testing || !syncSettings.supabaseUrl || (!syncSettings.isKeyConfigured && !syncSettings.supabaseKey && !syncSettings.isKeyFromEnv)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testResult.testing ? 'animate-spin' : ''}`} />
                <span>{testResult.testing ? 'جارِ فحص الاتصال...' : 'اختبار الاتصال بالسحابة'}</span>
              </button>

              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                حفظ الإعدادات
              </button>
            </div>

            {testResult.message && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                  testResult.success
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/60 border-red-500/40 text-red-300'
                }`}
              >
                {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </form>

          {/* Quick Guidance Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg text-xs">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>مزايا منظومة المزامنة المركزية</span>
            </h4>

            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>استمرارية أوفلاين 100%:</strong> يعمل كل مكتب فرعي دون أي توقف حتى مع انقطاع الإنترنت لأيام.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>رفع آلي عند توفر النت:</strong> فور عودة الاتصال، تُرفع التذاكر والمعاملات تلقائياً إلى Supabase.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>رقابة المقر الدائمة:</strong> كمبيوتر المقر الرئيسي يحتفظ بنسخة محلية من بيانات كل الفروع ويسمح بمشاهدتها حتى عند انقطاع النت في المقر.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>سكربت SQL الجاهز:</strong> تم توليد وحفظ ملف <code>supabase_schema.sql</code> في مجلد المشروع الرئيسي لتشغيله في Supabase SQL Editor مباشرة.</span>
              </li>
            </ul>

            <div className="pt-4 border-t border-slate-800">
              <a
                href="/supabase_schema.sql"
                download="supabase_schema.sql"
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all block text-center"
              >
                <Database className="w-4 h-4" />
                <span>تحميل ملف سكربت SQL المركزي</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: ADD NEW AGENCY RECORD */}
      {/* ================================================================= */}
      {showAddAgencyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>تسجيل وتوثيق معاملة وكالة جديدة</span>
              </h3>
              <button onClick={() => setShowAddAgencyModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAgency} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">رقم الوكالة في السجل *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 1402 / عام"
                    value={newAgency.agencyNumber}
                    onChange={e => setNewAgency({ ...newAgency, agencyNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">نوع الوكالة *</label>
                  <select
                    value={newAgency.agencyType}
                    onChange={e => setNewAgency({ ...newAgency, agencyType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="توثيق وكالة عامة">توثيق وكالة عامة</option>
                    <option value="توثيق وكالة خاصة">توثيق وكالة خاصة</option>
                    <option value="صورة مصدقة عن وكالة">صورة مصدقة عن وكالة</option>
                    <option value="عزل وكالة محامي">عزل وكالة محامي</option>
                    <option value="تصديق عقد">تصديق عقد</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">أسماء الموكلين (أطراف الوكالة) *</label>
                <input
                  type="text"
                  required
                  placeholder="الاسم الثلاثي للموكل أو الموكلين"
                  value={newAgency.principalsNames}
                  onChange={e => setNewAgency({ ...newAgency, principalsNames: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">أسماء المحامين الوكلاء *</label>
                <input
                  type="text"
                  required
                  placeholder="أسماء الأساتذة المحامين الموكلين"
                  value={newAgency.lawyersNames}
                  onChange={e => setNewAgency({ ...newAgency, lawyersNames: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">الرقم الوطني / جواز السفر</label>
                  <input
                    type="text"
                    placeholder="الرقم الوطني للموكل"
                    value={newAgency.nationalId}
                    onChange={e => setNewAgency({ ...newAgency, nationalId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">الرسوم المستوفاة (ل.س)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newAgency.feesPaid || ''}
                    onChange={e => setNewAgency({ ...newAgency, feesPaid: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Attachment Picker */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">إرفاق صورة الوكالة / الهوية (ممسوحة ضوئياً)</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 cursor-pointer transition-all">
                    <Paperclip className="w-4 h-4 text-amber-400" />
                    <span>{attachedFileName ? 'تغيير الملف' : 'اختيار صورة أو ملف PDF'}</span>
                    <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                  </label>
                  {attachedFileName && <span className="text-amber-300 font-mono text-[11px] truncate max-w-xs">{attachedFileName}</span>}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  value={newAgency.notes}
                  onChange={e => setNewAgency({ ...newAgency, notes: e.target.value })}
                  placeholder="أي ملاحظات حول الوثائق أو الرسوم..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAgencyModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl font-bold shadow-md cursor-pointer"
                >
                  حفظ وتوثيق المعاملة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* MODAL: FULL BRANCH PULLED DATA DETAILS                   */}
      {/* ======================================================== */}
      {selectedBranchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100" dir="rtl">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    {selectedBranchModal.name}
                    {selectedBranchModal.isHeadquarters && (
                      <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full border border-amber-500/30">المقر الرئيسي</span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-400">
                    المدينة: {selectedBranchModal.city} | الكود: {selectedBranchModal.code} | المعرف: {selectedBranchModal.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBranchModal(null)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 px-6 py-3 bg-slate-950 border-b border-slate-800 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setBranchModalTab('tickets')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  branchModalTab === 'tickets' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <TicketIcon className="w-4 h-4" />
                <span>التذاكر المسجلة ({(ticketsByBranch[selectedBranchModal.id] || []).length})</span>
              </button>

              <button
                onClick={() => setBranchModalTab('agencies')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  branchModalTab === 'agencies' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>معاملات الوكالات ({agenciesList.filter(a => a.branchId === selectedBranchModal.id).length})</span>
              </button>

              <button
                onClick={() => setBranchModalTab('audits')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  branchModalTab === 'audits' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>سجل التدقيق والنشاط ({(auditLogsByBranch[selectedBranchModal.id] || []).length})</span>
              </button>

              <button
                onClick={() => setBranchModalTab('info')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  branchModalTab === 'info' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>بيانات ومعلومات الفرع</span>
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              {branchModalTab === 'tickets' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 mb-2">قائمة التذاكر المسجلة والمجلوبة لهذا الفرع:</div>
                  {(ticketsByBranch[selectedBranchModal.id] || []).length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">لا توجد تذاكر مسجلة لهذا الفرع في السجلات الحالية.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                            <th className="p-3">رقم التذكرة</th>
                            <th className="p-3">الخدمة / القسم</th>
                            <th className="p-3">الحالة</th>
                            <th className="p-3">الشباك</th>
                            <th className="p-3">الموظف المسؤول</th>
                            <th className="p-3">وقت الإصدار</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {(ticketsByBranch[selectedBranchModal.id] || []).map(t => (
                            <tr key={t.id} className="hover:bg-slate-800/50">
                              <td className="p-3 font-black text-white font-mono">{t.displayNumber || t.number}</td>
                              <td className="p-3 text-slate-300">{t.categoryNameArabic || t.category}</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  t.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                  t.status === 'serving' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                  'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}>
                                  {t.status === 'completed' ? 'منجزة' : t.status === 'serving' ? 'قيد الخدمة' : 'انتظار'}
                                </span>
                              </td>
                              <td className="p-3 text-slate-300">{t.counterName || '-'}</td>
                              <td className="p-3 text-slate-300">{t.staffName || '-'}</td>
                              <td className="p-3 font-mono text-slate-400">{new Date(t.createdAt).toLocaleTimeString('ar-SY')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {branchModalTab === 'agencies' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 mb-2">معاملات الوكالات والتوثيق المجلوبة لهذا الفرع:</div>
                  {agenciesList.filter(a => a.branchId === selectedBranchModal.id).length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">لا توجد معاملات وكالات مسجلة لهذا الفرع.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                            <th className="p-3">رقم الوكالة</th>
                            <th className="p-3">نوع الوكالة</th>
                            <th className="p-3">الموكلون</th>
                            <th className="p-3">المحامون</th>
                            <th className="p-3">الرسوم المدفوعة</th>
                            <th className="p-3">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {agenciesList.filter(a => a.branchId === selectedBranchModal.id).map(a => (
                            <tr key={a.id} className="hover:bg-slate-800/50">
                              <td className="p-3 font-mono font-bold text-amber-400">{a.agencyNumber} / {a.agencyYear || 2026}</td>
                              <td className="p-3 text-slate-300">{a.agencyType}</td>
                              <td className="p-3 text-slate-300">{a.principalsNames}</td>
                              <td className="p-3 text-slate-300">{a.lawyersNames}</td>
                              <td className="p-3 font-mono text-emerald-400">{a.feesPaid || 0} ل.س</td>
                              <td className="p-3">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  {a.status === 'approved' ? 'معتمدة' : 'قيد المراجعة'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {branchModalTab === 'audits' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 mb-2">سجل التدقيق والأحداث (Audit Logs) لهذا الفرع:</div>
                  {(auditLogsByBranch[selectedBranchModal.id] || []).length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">لا توجد سجلات تدقيق مسجلة لهذا الفرع.</div>
                  ) : (
                    <div className="space-y-2">
                      {(auditLogsByBranch[selectedBranchModal.id] || []).map(au => (
                        <div key={au.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="font-bold text-white text-xs">{au.action}</div>
                            <div className="text-slate-400 text-[11px]">{au.details}</div>
                            <div className="text-[10px] text-amber-400/80">المستخدم: {au.user}</div>
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 shrink-0">
                            {new Date(au.timestamp).toLocaleTimeString('ar-SY')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {branchModalTab === 'info' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="text-xs font-bold text-amber-400">معلومات الاتصال والتعريف</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-400">اسم الفرع:</span><span className="font-bold text-white">{selectedBranchModal.name}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">الرمز:</span><span className="font-mono text-amber-300">{selectedBranchModal.code}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">المدينة:</span><span className="text-slate-200">{selectedBranchModal.city}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">العنوان:</span><span className="text-slate-200">{selectedBranchModal.address || 'القصر العدلي الرئيسي'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">الهاتف:</span><span className="font-mono text-slate-200">{selectedBranchModal.phone || '021-000000'}</span></div>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="text-xs font-bold text-emerald-400">حالة المزامنة السحابية</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-400">حالة الفرع:</span><span className="text-emerald-400 font-bold">{selectedBranchModal.isActive ? 'نشط ومتصل' : 'متوقف مؤقتاً'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">آخر مزامنة ناجحة:</span><span className="font-mono text-slate-300">{selectedBranchModal.lastSyncAt ? new Date(selectedBranchModal.lastSyncAt).toLocaleString('ar-SY') : 'اليوم'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">عنوان الآيبي الأخير:</span><span className="font-mono text-slate-300">{selectedBranchModal.lastKnownIp || '127.0.0.1'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">تذاكر اليوم:</span><span className="font-bold text-blue-400">{(ticketsByBranch[selectedBranchModal.id] || []).length}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">معاملات الوكالات:</span><span className="font-bold text-purple-400">{agenciesList.filter(a => a.branchId === selectedBranchModal.id).length}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                جميع البيانات أعلاه تم جلبها ومزامنتها بنجاح من قاعدة البيانات المركزية ومحفوظة في الكاش المحلي.
              </div>
              <button
                onClick={() => setSelectedBranchModal(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
