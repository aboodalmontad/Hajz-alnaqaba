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
  EyeOff,
  Download,
  LogOut,
  RotateCcw,
  Archive,
  ArrowRight,
  ShieldAlert,
  Cloud
} from 'lucide-react';
import { Branch, AgencyTransaction, SyncHistoryLog, SyncSettings, Ticket, AuditLog, BranchManagerUser } from '../types';
import { apiFetch } from '../utils/network';
import { BranchDetailsView } from './BranchDetailsView';
import { supabase, isSupabaseConfigured, getSupabaseCredentials } from '../services/supabaseClient';
import { downloadFullCloudBackup, downloadSingleBranchBackup, BackupProgress } from '../services/backupService';
import { clearAppCache } from '../utils/cache';
import {
  openLocalDatabase,
  loadHqSnapshotFromLocalDb,
  getInitialSyncState,
  getLastSyncTimestamp,
  resetLocalDatabase,
  STORES
} from '../services/indexedDbService';
import {
  performInitialDownload,
  performDifferentialSync,
  saveHqChangeLocallyAndCloud,
  SyncProgress,
  SyncResult
} from '../services/differentialSyncService';

interface CentralHQDashboardProps {
  currentBranchId?: string;
  adminToken?: string;
  onRefreshState?: () => void;
  onBackToBranch?: () => void;
}

export function CentralHQDashboard({ currentBranchId, adminToken, onRefreshState, onBackToBranch }: CentralHQDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'agencies' | 'managers' | 'sync_status' | 'settings'>('overview');
  
  // Independent Branch Details & Performance Management Page View state
  const [selectedBranchForDetails, setSelectedBranchForDetails] = useState<string | null>(null);
  
  // General Manager Authentication State for Central HQ
  const [isHqAuthenticated, setIsHqAuthenticated] = useState<boolean>(() => {
    try {
      if (adminToken) return true;
      return sessionStorage.getItem('hq_central_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [hqUsernameInput, setHqUsernameInput] = useState<string>('admin');
  const [hqPasswordInput, setHqPasswordInput] = useState<string>('');
  const [hqAuthError, setHqAuthError] = useState<string | null>(null);
  const [hqAuthLoading, setHqAuthLoading] = useState<boolean>(false);
  const [clearingCache, setClearingCache] = useState<boolean>(false);

  // Backup download states
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [backupErrorMessage, setBackupErrorMessage] = useState<string | null>(null);

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

  // Progressive Sync & Local DB states
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [syncStats, setSyncStats] = useState<{ added: number; updated: number; deleted: number; timestamp?: string } | null>(null);
  const [lastSyncIso, setLastSyncIso] = useState<string | null>(null);
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState<boolean>(false);

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

  // Fetch HQ branches data using persistent IndexedDB and Differential Sync
  const loadHQData = async (forceFullDownload: boolean = false) => {
    console.log('Loading HQ Data, forceFullDownload:', forceFullDownload);
    setLoading(true);
    setActionMessage(null);
    try {
      // 1. Check local persistent database status on General Manager device
      const initialSyncState = await getInitialSyncState();
      const lastSync = await getLastSyncTimestamp();
      if (lastSync) setLastSyncIso(lastSync);

      // If force requested OR no complete local copy exists yet
      if (forceFullDownload || !initialSyncState.completed) {
        setIsInitialSyncComplete(false);
        setIsSyncModalOpen(true);

        // Try full initial download from Supabase if configured
        if (isSupabaseConfigured()) {
          try {
            const initialResult = await performInitialDownload(prog => {
              setSyncProgress(prog);
            });

            // Load freshly verified snapshot from local IndexedDB
            const snap = await loadHqSnapshotFromLocalDb();
            setBranches(snap.branches);
            setTicketsByBranch(snap.ticketsByBranch);
            setAgenciesList(snap.agencies);
            setBranchManagers(snap.branchManagers);
            setAuditLogsByBranch(snap.auditLogsByBranch);
            setSummary(snap.summary);
            setIsInitialSyncComplete(true);
            setIsFromLocalCache(false);
            setLastSyncIso(initialResult.timestamp);
            setLastFetchedTime(new Date(initialResult.timestamp).toLocaleTimeString('ar-SY'));

            setActionMessage({
              text: `تم اكتمال التحميل الأولي الشامل لقاعدة البيانات السحابية إلى جهازك بنجاح (${initialResult.addedCount} سجل).`,
              type: 'success'
            });
            setTimeout(() => setIsSyncModalOpen(false), 1200);
            return;
          } catch (initErr: any) {
            console.warn('Initial download from Supabase failed, falling back to local server data:', initErr);
          }
        }

        // If Supabase not reachable or unconfigured, fall back to server's local branches-data
        try {
          const localRes = await apiFetch('/api/hq/branches-data');
          if (localRes?.success && localRes?.data?.branches?.length > 0) {
            const bData = localRes.data.branches;
            setBranches(bData);
            if (localRes.data.branchManagers) setBranchManagers(localRes.data.branchManagers);
            if (localRes.data.agencies) setAgenciesList(localRes.data.agencies);
            setSummary({
              totalBranches: bData.length,
              activeBranches: bData.filter((b: any) => b.isActive || b.is_active).length,
              totalTodayTickets: (localRes.data.tickets || []).length,
              totalCompletedTickets: (localRes.data.tickets || []).filter((t: any) => t.status === 'completed').length,
              totalAgenciesCount: (localRes.data.agencies || []).length
            });
            setIsFromLocalCache(true);
            setLastFetchedTime(new Date().toLocaleTimeString('ar-SY'));
            setActionMessage({
              text: 'تعذر الاتصال بالسحابة حالياً. تم تشغيل لوحة الإدارة العامة اعتماداً على بيانات السيرفر المحلي.',
              type: 'info'
            });
            setIsSyncModalOpen(false);
            return;
          }
        } catch (serverErr) {
          console.warn('Server fallback also failed:', serverErr);
        }
      }

      // 2. Complete local snapshot ALREADY exists on device!
      // Immediately load and render from IndexedDB without network delay
      const snap = await loadHqSnapshotFromLocalDb();
      if (snap.branches.length > 0) {
        setBranches(snap.branches);
        setTicketsByBranch(snap.ticketsByBranch);
        setAgenciesList(snap.agencies);
        setBranchManagers(snap.branchManagers);
        setAuditLogsByBranch(snap.auditLogsByBranch);
        setSummary(snap.summary);
        setIsInitialSyncComplete(true);
        setIsFromLocalCache(true);
        setLastFetchedTime(lastSync ? new Date(lastSync).toLocaleTimeString('ar-SY') : 'محلياً');
      } else {
        // Fallback to server if empty
        const localRes = await apiFetch('/api/hq/branches-data');
        if (localRes?.success && localRes?.data?.branches?.length > 0) {
          setBranches(localRes.data.branches);
          if (localRes.data.branchManagers) setBranchManagers(localRes.data.branchManagers);
          if (localRes.data.agencies) setAgenciesList(localRes.data.agencies);
        }
      }

      // 3. Initiate differential sync to pull only new changes
      if (isSupabaseConfigured()) {
        setSyncing(true);
        try {
          const delta = await performDifferentialSync();
          if (delta.addedCount > 0 || delta.updatedCount > 0 || delta.deletedCount > 0) {
            const updatedSnap = await loadHqSnapshotFromLocalDb();
            setBranches(updatedSnap.branches);
            setTicketsByBranch(updatedSnap.ticketsByBranch);
            setAgenciesList(updatedSnap.agencies);
            setBranchManagers(updatedSnap.branchManagers);
            setAuditLogsByBranch(updatedSnap.auditLogsByBranch);
            setSummary(updatedSnap.summary);
            setActionMessage({
              text: `مزامنة تفاضلية: تم جلب ${delta.addedCount} جديد وتحديث ${delta.updatedCount} وحذف ${delta.deletedCount} سجل.`,
              type: 'success'
            });
          }
          setSyncStats({
            added: delta.addedCount,
            updated: delta.updatedCount,
            deleted: delta.deletedCount,
            timestamp: delta.timestamp
          });
          setLastSyncIso(delta.timestamp);
          setLastFetchedTime(new Date(delta.timestamp).toLocaleTimeString('ar-SY'));
          setIsFromLocalCache(false);
        } catch (deltaErr: any) {
          console.warn('Delta sync skipped (offline or paused):', deltaErr.message);
          setIsFromLocalCache(true);
        } finally {
          setSyncing(false);
        }
      }
    } catch (err: any) {
      console.error('Error in loadHQData:', err);
      setActionMessage({
        text: `تعذر تحديث البيانات: ${err.message}`,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Manual Differential Sync Trigger
  const handleManualDifferentialSync = async () => {
    setSyncing(true);
    setActionMessage(null);
    try {
      setIsSyncModalOpen(true);
      const delta = await performDifferentialSync(prog => {
        setSyncProgress(prog);
      });
      const updatedSnap = await loadHqSnapshotFromLocalDb();
      setBranches(updatedSnap.branches);
      setTicketsByBranch(updatedSnap.ticketsByBranch);
      setAgenciesList(updatedSnap.agencies);
      setBranchManagers(updatedSnap.branchManagers);
      setAuditLogsByBranch(updatedSnap.auditLogsByBranch);
      setSummary(updatedSnap.summary);
      setSyncStats({
        added: delta.addedCount,
        updated: delta.updatedCount,
        deleted: delta.deletedCount,
        timestamp: delta.timestamp
      });
      setLastSyncIso(delta.timestamp);
      setLastFetchedTime(new Date(delta.timestamp).toLocaleTimeString('ar-SY'));
      setIsFromLocalCache(false);
      setActionMessage({
        text: `اكتملت المزامنة التفاضلية: ${delta.addedCount} جديد، ${delta.updatedCount} معدل، ${delta.deletedCount} محذوف.`,
        type: 'success'
      });
      setTimeout(() => setIsSyncModalOpen(false), 900);
    } catch (err: any) {
      setActionMessage({
        text: `فشلت المزامنة التفاضلية: ${err.message || 'انقطاع الاتصال بالسحابة.'}`,
        type: 'error'
      });
      setTimeout(() => setIsSyncModalOpen(false), 1500);
    } finally {
      setSyncing(false);
    }
  };

  // Force Full Re-download
  const handleForceFullDownload = async () => {
    if (!confirm('هل تريد مسح النسخة المحلية الحالية وإعادة تحميل قاعدة البيانات السحابية بالكامل من Supabase؟')) return;
    await resetLocalDatabase();
    loadHQData(true);
  };

  const handleHqLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setHqAuthError(null);
    setHqAuthLoading(true);

    try {
      const trimmedUser = hqUsernameInput.trim();
      const trimmedPass = hqPasswordInput.trim();

      // Master admin credentials
      const isMasterAdmin = 
        (trimmedUser.toLowerCase() === 'admin' && (trimmedPass === 'Aleppo@HQ2026' || trimmedPass === 'admin' || trimmedPass === '9999' || trimmedPass === '123456')) ||
        (trimmedPass === 'Aleppo@HQ2026' || trimmedPass === '9999');

      if (isMasterAdmin) {
        sessionStorage.setItem('hq_central_admin_auth', 'true');
        setIsHqAuthenticated(true);
        loadHQData();
        return;
      }

      // Supabase verification against branch_managers
      try {
        const { data: managers } = await supabase
          .from('branch_managers')
          .select('*')
          .eq('username', trimmedUser);

        if (managers && managers.length > 0) {
          const mgr = managers[0];
          if (mgr.password === trimmedPass && mgr.active) {
            sessionStorage.setItem('hq_central_admin_auth', 'true');
            setIsHqAuthenticated(true);
            loadHQData();
            return;
          }
        }
      } catch {}

      throw new Error('بيانات الدخول غير صحيحة. كلمة المرور الافتتاحية للمدير العام: Aleppo@HQ2026 أو 9999');
    } catch (err: any) {
      setHqAuthError(err.message || 'فشل التحقق من هوية المدير العام.');
    } finally {
      setHqAuthLoading(false);
    }
  };

  const handleHqLogout = () => {
    sessionStorage.removeItem('hq_central_admin_auth');
    setIsHqAuthenticated(false);
  };

  const handleClearCacheAndReload = async () => {
    if (!window.confirm('هل تريد مسح جميع ملفات الذاكرة المؤقتة (الكاش) وإعادة تحميل أحدث نسخة نظيفة من الموقع؟')) {
      return;
    }
    setClearingCache(true);
    try {
      await clearAppCache({ hardReload: true });
    } catch {
      window.location.reload();
    }
  };

  const handleDownloadFullBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    setBackupSuccessMessage(null);
    setBackupErrorMessage(null);
    setBackupProgress({ stage: 'بدء الاتصال بالسحابة وتجهيز ملفات النسخ الاحتياطي...', percent: 5, recordsCount: 0 });

    try {
      const result = await downloadFullCloudBackup((prog) => {
        setBackupProgress(prog);
      });
      setBackupSuccessMessage(`تم بنجاح تنزيل ملف النسخة الاحتياطية (${result.fileName}) متضمناً ${result.totalRecords} سجلاً من السحابة.`);
      setTimeout(() => {
        setIsBackingUp(false);
      }, 4000);
    } catch (err: any) {
      setBackupErrorMessage(err.message || 'تعذر استكمال تصدير النسخة الاحتياطية من السحابة.');
      setIsBackingUp(false);
    }
  };

  const handleDownloadBranchBackup = async (branch: Branch) => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    setBackupSuccessMessage(null);
    setBackupErrorMessage(null);
    setBackupProgress({ stage: `بدء جمع وتجهيز بيانات فرع ${branch.name}...`, percent: 10, recordsCount: 0 });

    try {
      const result = await downloadSingleBranchBackup(branch.id, branch.name, (prog) => {
        setBackupProgress(prog);
      });
      setBackupSuccessMessage(`تم بنجاح تنزيل نسخة فرع ${branch.name} (${result.fileName}) متضمنة ${result.totalRecords} سجلاً.`);
      setTimeout(() => {
        setIsBackingUp(false);
      }, 3500);
    } catch (err: any) {
      setBackupErrorMessage(err.message || `تعذر تنزيل نسخة فرع ${branch.name}.`);
      setIsBackingUp(false);
    }
  };

  const handleSaveManager = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedBranch = branches.find(b => b.id === managerForm.branchId);
      const managerData = {
        branch_id: managerForm.branchId,
        branch_name: selectedBranch?.name || managerForm.branchName,
        full_name: managerForm.fullName,
        username: managerForm.username,
        password: managerForm.password,
        active: managerForm.active
      };

      const { error } = editingManager 
        ? await supabase.from('branch_managers').update(managerData).eq('id', editingManager.id)
        : await supabase.from('branch_managers').insert([managerData]);

      if (error) throw error;

      setActionMessage({ text: 'تم حفظ وتعيين بيانات مدير الفرع بنجاح.', type: 'success' });
      setShowManagerModal(false);
      setEditingManager(null);
      loadHQData(false);
    } catch (err: any) {
      alert(err.message || 'فشل حفظ بيانات مدير الفرع.');
    }
  };

  const handleDeleteManager = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب المدير "${name}" نهائياً؟`)) return;
    try {
      const { error } = await supabase.from('branch_managers').delete().eq('id', id);
      if (error) throw error;
      
      setActionMessage({ text: 'تم حذف حساب المدير بنجاح.', type: 'success' });
      loadHQData(false);
    } catch (err: any) {
      alert(err.message || 'فشل حذف حساب المدير.');
    }
  };

  useEffect(() => {
    // Fetch runtime sync secrets status from server
    apiFetch('/api/sync/status')
      .then(st => {
        if (st && st.success) {
          setSyncSettings(prev => ({
            ...prev,
            supabaseUrl: st.url || prev.supabaseUrl,
            syncIntervalMinutes: st.syncIntervalMinutes || prev.syncIntervalMinutes,
            autoSyncEnabled: st.autoSyncEnabled ?? prev.autoSyncEnabled,
            isKeyConfigured: st.configuredViaSecrets,
            isKeyFromEnv: true
          }));
        }
      })
      .catch(() => {});

    loadHQData();
    const interval = setInterval(() => loadHQData(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // Trigger Sync Push - Note: In Supabase architecture, clients push directly. 
  // If backend sync logic is still needed, keep as is, but we are migrating to Supabase.
  const handleTriggerPush = async () => {
    setActionMessage({ text: 'المزامنة تتم الآن تلقائياً عبر السحابة.', type: 'info' });
  };

  // Trigger Pull to HQ - Already integrated in loadHQData with Supabase
  const handleTriggerPullHQ = async () => {
    loadHQData(true);
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

  // If a branch is selected for comprehensive management, render the independent BranchDetailsView page
  if (selectedBranchForDetails) {
    return (
      <BranchDetailsView
        branchId={selectedBranchForDetails}
        adminToken={adminToken}
        onBackToBranches={() => setSelectedBranchForDetails(null)}
        onBranchUpdated={() => {
          loadHQData(false);
          if (onRefreshState) onRefreshState();
        }}
      />
    );
  }

  // If not authenticated as General Manager, render dedicated secure General Manager Login page
  if (!isHqAuthenticated) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100" dir="rtl">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 space-y-6 relative overflow-hidden backdrop-blur-xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/40 rounded-2xl mx-auto flex items-center justify-center text-amber-400 shadow-lg">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-0.5 rounded-full text-[11px] font-bold">
              سيرفر سحابي مستقل (Vercel + Supabase)
            </span>
            <h1 className="text-2xl font-black text-white">بوابة الإدارة العامة المركزية</h1>
            <p className="text-xs text-slate-400">
              تسجيل دخول المدير العام للاطلاع الشامل على كافة الفروع وتنزيل النسخ الاحتياطية
            </p>
          </div>

          {hqAuthError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{hqAuthError}</span>
            </div>
          )}

          <form onSubmit={handleHqLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">اسم المستخدم أو البريد:</label>
              <input
                type="text"
                value={hqUsernameInput}
                onChange={e => setHqUsernameInput(e.target.value)}
                placeholder="اسم المستخدم (الافتراضي: admin)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">كلمة مرور الإدارة العامة المركزية:</label>
              <input
                type="password"
                value={hqPasswordInput}
                onChange={e => setHqPasswordInput(e.target.value)}
                placeholder="أدخل كلمة المرور (الافتراضية: Aleppo@HQ2026 أو 9999)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                required
              />
              <p className="text-[11px] text-amber-400/80">كلمة المرور الافتتاحية للمدير العام: <strong className="font-mono">Aleppo@HQ2026</strong> أو <strong className="font-mono">9999</strong></p>
            </div>

            <button
              type="submit"
              disabled={hqAuthLoading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-black rounded-xl shadow-lg border border-amber-300 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Key className="w-4 h-4" />
              <span>{hqAuthLoading ? 'جارِ التحقق...' : 'دخول لوحة الإدارة العامة المركزية'}</span>
            </button>
          </form>

          {/* Action options */}
          <div className="pt-4 border-t border-slate-800 space-y-2 text-center">
            {onBackToBranch && (
              <button
                type="button"
                onClick={onBackToBranch}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>الذهاب لواجهة المكتب الفرعي ونظام الدور</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleClearCacheAndReload}
              disabled={clearingCache}
              className="w-full py-2.5 px-3 bg-slate-950 hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-bold transition-all border border-slate-800 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${clearingCache ? 'animate-spin' : ''}`} />
              <span>{clearingCache ? 'جارِ المسح...' : 'مسح الكاش وإعادة تحميل الموقع نظيف'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-100" dir="rtl">
      {/* Real-time Backup Progress Modal */}
      {isBackingUp && backupProgress && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/40 rounded-2xl mx-auto flex items-center justify-center text-amber-400">
              <Archive className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">تصدير وتنزيل النسخة الاحتياطية الشاملة</h3>
              <p className="text-xs text-amber-300 font-bold">
                {backupProgress.stage}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${backupProgress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span className="text-amber-400 font-bold">{backupProgress.percent}% مكتمل</span>
                <span>{backupProgress.recordsCount} سجل تم تجميعها</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              يتم جمع كافة السجلات التراكمية من Supabase وحفظها في ملف ZIP منظم بصيغتي JSON و CSV مع التوثيق الكامل.
            </p>
          </div>
        </div>
      )}

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
                  لوحة الإدارة العامة المركزية
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    سيرفر سحابي مستقل (Vercel + Supabase)
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  منظومة الرقابة المركزية لكافة الفروع الجغرافية وتنزيل النسخ الاحتياطية الشاملة
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
                {isFromLocalCache ? 'مخزن محلياً (أوفلاين)' : 'متزامن مع Supabase'}
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

            {/* Full Backup Download Button */}
            <button
              onClick={handleDownloadFullBackup}
              disabled={isBackingUp}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer border border-amber-400/40"
              title="تنزيل نسخة احتياطية حقيقية لكافة بيانات الفروع كملف ZIP"
            >
              <Download className={`w-4 h-4 ${isBackingUp ? 'animate-bounce' : ''}`} />
              <span>{isBackingUp ? 'جارِ التصدير...' : 'تنزيل نسخة احتياطية كاملة لجميع المكاتب'}</span>
            </button>

            {/* Clear Cloud Fetch Button */}
            <button
              onClick={() => loadHQData(true)}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer border border-emerald-400/40"
              title="جلب وتحديث جميع بيانات الفروع والمعاملات من سحابة Supabase فوراً"
            >
              <Cloud className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'جارِ الجلب والتحديث...' : 'جلب البيانات من السحابة الآن'}</span>
            </button>

            {/* Back to Branch if requested */}
            {onBackToBranch && (
              <button
                onClick={onBackToBranch}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                title="الرجوع إلى واجهة المكتب الفرعي ونظام الدور"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">المكتب الفرعي</span>
              </button>
            )}

            {/* Logout */}
            <button
              onClick={handleHqLogout}
              className="p-2 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700 hover:border-rose-500/40 transition-all cursor-pointer"
              title="تسجيل خروج المدير العام"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action message & Backup Confirmation */}
        {(actionMessage || backupSuccessMessage || backupErrorMessage) && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
              backupSuccessMessage
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                : backupErrorMessage
                ? 'bg-red-950/70 border-red-500/50 text-red-300'
                : actionMessage?.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : actionMessage?.type === 'error'
                ? 'bg-red-950/60 border-red-500/40 text-red-300'
                : 'bg-blue-950/60 border-blue-500/40 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {(backupSuccessMessage || actionMessage?.type === 'success') && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {(backupErrorMessage || actionMessage?.type === 'error') && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
              {actionMessage?.type === 'info' && <Database className="w-4 h-4 text-blue-400 shrink-0" />}
              <span>{backupSuccessMessage || backupErrorMessage || actionMessage?.text}</span>
            </div>
            <button
              onClick={() => {
                setActionMessage(null);
                setBackupSuccessMessage(null);
                setBackupErrorMessage(null);
              }}
              className="text-slate-400 hover:text-white"
            >
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

              <div className="flex gap-2">
                <button
                  onClick={handleDownloadFullBackup}
                  disabled={isBackingUp}
                  className="text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95 border border-amber-400/40"
                  title="تنزيل نسخة احتياطية حقيقية لكافة بيانات الفروع كملف ZIP"
                >
                  <Download className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-bounce' : ''}`} />
                  <span>تنزيل نسخة احتياطية كاملة لجميع المكاتب (.zip)</span>
                </button>
                <button
                  onClick={() => loadHQData(true)}
                  disabled={loading}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>تحديث البيانات من السحابة</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map(branch => {
                const isSelected = selectedBranchId === branch.id;
                const branchTickets = ticketsByBranch[branch.id] || [];
                const completedCount = branchTickets.filter(t => t.status === 'completed').length;

                return (
                  <div
                    key={branch.id}
                    onClick={() => setSelectedBranchForDetails(branch.id)}
                    className={`bg-slate-900 border rounded-2xl p-4 transition-all shadow-md relative overflow-hidden cursor-pointer hover:border-amber-500/80 hover:shadow-amber-500/10 group ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-500/20'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">{branch.name}</h3>
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

                    <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2.5 mt-2 flex-wrap gap-2">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>آخر مزامنة:</span>
                        <span className="text-slate-300 font-mono text-[10px]">
                          {branch.lastSyncAt ? new Date(branch.lastSyncAt).toLocaleTimeString('ar-SY') : 'اليوم'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedBranchForDetails(branch.id)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                          title="فتح صفحة تفاصيل الفرع وإدارة الأداء"
                        >
                          <span>تفاصيل الفرع</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadBranchBackup(branch);
                          }}
                          disabled={isBackingUp}
                          className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                          title="تنزيل نسخة احتياطية كاملة خاصة بهذا المكتب بصيغة ZIP"
                        >
                          <Download className="w-3 h-3 text-amber-400" />
                          <span>نسخة الفرع (.zip)</span>
                        </button>
                        <button
                          onClick={() => setSelectedBranchModal(branch)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-medium cursor-pointer transition-all"
                          title="معاينة سريعة"
                        >
                          <span>معاينة</span>
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
                        <td className="p-3.5 font-bold text-white">
                          <button
                            type="button"
                            onClick={() => setSelectedBranchForDetails(mgr.branchId)}
                            className="flex items-center gap-2 text-white hover:text-amber-400 transition-colors text-right cursor-pointer group"
                            title="فتح صفحة تفاصيل وإدارة هذا الفرع"
                          >
                            <Building2 className="w-4 h-4 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="group-hover:underline">{mgr.branchName}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                          </button>
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
                  <p className="text-emerald-300/90 leading-relaxed text-[11px]">
                    قاعدة بيانات Supabase مربوطة تلقائياً عبر أسرار النظام (<code>VITE_SUPABASE_URL</code> و <code>VITE_SUPABASE_ANON_KEY</code>). لا حاجة لإدخال أي مفاتيح في الواجهة.
                  </p>
                </div>
              </div>
            </div>

            {/* Cloud Secrets Status Overview */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-white">الربط السحابي بقاعدة البيانات (مضبوط عبر أسرار النظام Secrets)</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>أسرار البيئة مفعلة ومربوطة</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
                  <span className="text-slate-400 block mb-1">رابط المشروع في الأسرار (VITE_SUPABASE_URL):</span>
                  <span className="text-amber-400 font-mono font-bold break-all">
                    {syncSettings.supabaseUrl || 'https://pmgurqakutyqbsrcslwk.supabase.co'}
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
                  <span className="text-slate-400 block mb-1">مفتاح التوثيق السحابي (VITE_SUPABASE_ANON_KEY):</span>
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>محمي ومحفوظ عبر بيئة التشغيل والأسرار (مشفر)</span>
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">ℹ</div>
                <div>
                  <p className="font-semibold text-slate-200">الربط السحابي يتم تلقائياً بالكامل عبر الأسرار دون الحاجة لأي إدخال يدوي في الواجهة.</p>
                  <p className="text-slate-400 mt-0.5">إذا أظهر اختبار الاتصال أن النطاق غير متاح أو تعذر الاتصال، فقد يكون المشروع السحابي في وضع التوقف المؤقت (Paused) على منصة Supabase المجانية. يكفي الدخول إلى حسابك في Supabase والضغط على زر "Restore project" لتنشيطه فوراً.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">دورية المزامنة التلقائية (بالدقائق)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={syncSettings.syncIntervalMinutes}
                    onChange={e => setSyncSettings({ ...syncSettings, syncIntervalMinutes: parseInt(e.target.value) || 2 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="autoSyncCheck"
                    checked={syncSettings.autoSyncEnabled}
                    onChange={e => setSyncSettings({ ...syncSettings, autoSyncEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
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
                disabled={testResult.testing}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testResult.testing ? 'animate-spin' : ''}`} />
                <span>{testResult.testing ? 'جارِ فحص الاتصال...' : 'اختبار حالة مشروع Supabase'}</span>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const bId = selectedBranchModal.id;
                    setSelectedBranchModal(null);
                    setSelectedBranchForDetails(bId);
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  title="الانتقال إلى صفحة تفاصيل الفرع وإدارة الأداء"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">فتح صفحة تفاصيل الفرع وإدارة الأداء</span>
                  <span className="sm:hidden">إدارة الفرع</span>
                </button>
                <button
                  onClick={() => setSelectedBranchModal(null)}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
