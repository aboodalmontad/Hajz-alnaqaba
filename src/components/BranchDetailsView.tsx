/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  ArrowRight,
  RefreshCw,
  Edit,
  Save,
  X,
  UserCheck,
  Users,
  Layers,
  FileText,
  Ticket as TicketIcon,
  ShieldCheck,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  MapPin,
  Calendar,
  Download,
  Printer,
  Search,
  Plus,
  Key,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRightLeft,
  Lock,
  Pause,
  Play,
  Check,
  AlertCircle,
  FileCheck2,
  DollarSign,
  TrendingUp,
  Inbox,
  Paperclip
} from 'lucide-react';
import {
  Branch,
  BranchManagerUser,
  ManagerHistoryRecord,
  Staff,
  Counter,
  CategoryConfig,
  Ticket,
  AgencyTransaction,
  AuditLog,
  BranchComprehensiveDetails
} from '../types';
import { apiFetch } from '../utils/network';

interface BranchDetailsViewProps {
  branchId: string;
  adminToken?: string;
  onBackToBranches: () => void;
  onBranchUpdated?: () => void;
}

export function BranchDetailsView({
  branchId,
  adminToken,
  onBackToBranches,
  onBranchUpdated
}: BranchDetailsViewProps) {
  // Navigation active tab inside branch details
  const [activeTab, setActiveTab] = useState<
    'overview' | 'admin_data' | 'manager' | 'delegates' | 'counters' | 'services' | 'records' | 'performance'
  >('overview');

  // Loading & Action states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Core Comprehensive Data
  const [details, setDetails] = useState<BranchComprehensiveDetails | null>(null);
  const [allBranchesList, setAllBranchesList] = useState<Branch[]>([]);

  // Period filter for statistics & records
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Edit Administrative Data state
  const [isEditingAdmin, setIsEditingAdmin] = useState<boolean>(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    code: '',
    city: '',
    address: '',
    phone: '',
    isActive: true,
    notes: ''
  });
  const [adminSaving, setAdminSaving] = useState<boolean>(false);

  // Manager Management Form state
  const [isEditingManager, setIsEditingManager] = useState<boolean>(false);
  const [isReplacingManager, setIsReplacingManager] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [managerForm, setManagerForm] = useState({
    fullName: '',
    username: '',
    password: '',
    active: true,
    previousManagerNotes: ''
  });
  const [managerSaving, setManagerSaving] = useState<boolean>(false);

  // Delegate Management Modal state
  const [showDelegateModal, setShowDelegateModal] = useState<boolean>(false);
  const [editingDelegate, setEditingDelegate] = useState<Staff | null>(null);
  const [transferringDelegate, setTransferringDelegate] = useState<Staff | null>(null);
  const [targetBranchId, setTargetBranchId] = useState<string>('');
  const [delegateForm, setDelegateForm] = useState({
    name: '',
    pin: '',
    jobTitle: 'مندوب وكالات',
    active: true
  });
  const [delegateSaving, setDelegateSaving] = useState<boolean>(false);

  // Counter Management Modal state
  const [showCounterModal, setShowCounterModal] = useState<boolean>(false);
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [counterForm, setCounterForm] = useState({
    name: '',
    isOpen: true,
    assignedServiceId: '',
    currentStaffId: ''
  });
  const [counterSaving, setCounterSaving] = useState<boolean>(false);

  // Service Management Modal state
  const [showServiceModal, setShowServiceModal] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<CategoryConfig | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    prefix: '',
    desc: '',
    assignedCounterId: '',
    active: true
  });
  const [serviceSaving, setServiceSaving] = useState<boolean>(false);

  // Records Search & Filters
  const [recordCategory, setRecordCategory] = useState<'agencies' | 'tickets' | 'audits'>('agencies');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAgencyDetail, setSelectedAgencyDetail] = useState<AgencyTransaction | null>(null);

  // Load Branch Details from Server
  const loadBranchDetails = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);
    setActionMessage(null);

    try {
      const res = await apiFetch(`/api/hq/branch/${branchId}/details`, {
        headers: {
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        }
      });

      if (res && res.success && res.data) {
        setDetails(res.data);
        const b = res.data.branch;
        setAdminForm({
          name: b.name || '',
          code: b.code || '',
          city: b.city || '',
          address: b.address || '',
          phone: b.phone || '',
          isActive: b.isActive ?? true,
          notes: b.notes || ''
        });

        if (res.data.manager) {
          setManagerForm({
            fullName: res.data.manager.fullName || '',
            username: res.data.manager.username || '',
            password: '',
            active: res.data.manager.active ?? true,
            previousManagerNotes: ''
          });
        }
      }

      // Fetch list of all branches for transfer dropdown
      try {
        const hqRes = await apiFetch('/api/hq/branches-data');
        if (hqRes && hqRes.data && Array.isArray(hqRes.data.branches)) {
          setAllBranchesList(hqRes.data.branches);
        }
      } catch {}
    } catch (err: any) {
      console.error('Error loading branch details:', err);
      setActionMessage({
        text: err.message || 'حدث خطأ أثناء تحميل بيانات الفرع من الخادم.',
        type: 'error'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBranchDetails();
  }, [branchId]);

  // Handle Save Administrative Data
  const handleSaveAdminData = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSaving(true);
    setActionMessage(null);

    try {
      const res = await apiFetch(`/api/hq/branch/${branchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify(adminForm)
      });

      if (res && res.success) {
        setActionMessage({
          text: res.message || 'تم حفظ وتحديث بيانات الفرع الإدارية في قاعدة البيانات بنجاح.',
          type: 'success'
        });
        setIsEditingAdmin(false);
        await loadBranchDetails(true);
        if (onBranchUpdated) onBranchUpdated();
      }
    } catch (err: any) {
      setActionMessage({
        text: err.message || 'فشل حفظ وتحديث بيانات الفرع.',
        type: 'error'
      });
    } finally {
      setAdminSaving(false);
    }
  };

  // Handle Save Manager
  const handleSaveManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setManagerSaving(true);
    setActionMessage(null);

    try {
      const payload = {
        fullName: managerForm.fullName,
        username: managerForm.username,
        password: managerForm.password,
        active: managerForm.active,
        isReplacement: isReplacingManager,
        previousManagerNotes: managerForm.previousManagerNotes
      };

      const res = await apiFetch(`/api/hq/branch/${branchId}/manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setActionMessage({
          text: res.message || 'تم حفظ بيانات مدير الفرع بنجاح.',
          type: 'success'
        });
        setIsEditingManager(false);
        setIsReplacingManager(false);
        await loadBranchDetails(true);
        if (onBranchUpdated) onBranchUpdated();
      }
    } catch (err: any) {
      setActionMessage({
        text: err.message || 'فشل حفظ بيانات مدير الفرع.',
        type: 'error'
      });
    } finally {
      setManagerSaving(false);
    }
  };

  // Handle Save Delegate
  const handleSaveDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    setDelegateSaving(true);
    setActionMessage(null);

    try {
      const payload = {
        id: editingDelegate ? editingDelegate.id : undefined,
        name: delegateForm.name,
        pin: delegateForm.pin,
        jobTitle: delegateForm.jobTitle,
        active: delegateForm.active
      };

      const res = await apiFetch(`/api/hq/branch/${branchId}/delegates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setActionMessage({
          text: res.message || 'تم حفظ بيانات المندوب بنجاح.',
          type: 'success'
        });
        setShowDelegateModal(false);
        setEditingDelegate(null);
        await loadBranchDetails(true);
      }
    } catch (err: any) {
      alert(err.message || 'فشل حفظ بيانات المندوب.');
    } finally {
      setDelegateSaving(false);
    }
  };

  // Handle Delegate Transfer
  const handleTransferDelegate = async () => {
    if (!transferringDelegate || !targetBranchId) return;
    setDelegateSaving(true);
    setActionMessage(null);

    try {
      const res = await apiFetch(`/api/hq/branch/${branchId}/delegates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify({
          id: transferringDelegate.id,
          targetBranchId
        })
      });

      if (res && res.success) {
        setActionMessage({
          text: res.message || 'تم نقل المندوب بنجاح.',
          type: 'success'
        });
        setTransferringDelegate(null);
        setTargetBranchId('');
        await loadBranchDetails(true);
      }
    } catch (err: any) {
      alert(err.message || 'فشل نقل المندوب.');
    } finally {
      setDelegateSaving(false);
    }
  };

  // Handle Soft-Delete / Archive Delegate
  const handleDeleteDelegate = async (delegateId: string, name: string) => {
    if (
      !confirm(
        `تأكيد الإجراء الإداري:\nهل أنت متأكد من تعطيل وأرشفة حساب المندوب (${name})؟\n\nتنبيه أمان: لن يتم حذف أي معاملة أو وكالة قام المندوب بتسجيلها سابقاً، وسيتم الاحتفاظ بكافة سجلاته التاريخية.`
      )
    ) {
      return;
    }

    try {
      const res = await apiFetch(`/api/hq/branch/${branchId}/delegates/${delegateId}`, {
        method: 'DELETE',
        headers: {
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        }
      });

      if (res && res.success) {
        setActionMessage({
          text: res.message || 'تم تعطيل حساب المندوب وأرشفته بنجاح.',
          type: 'success'
        });
        await loadBranchDetails(true);
      }
    } catch (err: any) {
      alert(err.message || 'فشل تعطيل حساب المندوب.');
    }
  };

  // Handle Save Counter
  const handleSaveCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    setCounterSaving(true);
    setActionMessage(null);

    try {
      const payload = {
        id: editingCounter ? editingCounter.id : undefined,
        name: counterForm.name,
        isOpen: counterForm.isOpen,
        assignedServiceId: counterForm.assignedServiceId || undefined,
        currentStaffId: counterForm.currentStaffId || undefined
      };

      const res = await apiFetch(`/api/hq/branch/${branchId}/counters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setActionMessage({
          text: res.message || 'تم حفظ بيانات الشباك بنجاح.',
          type: 'success'
        });
        setShowCounterModal(false);
        setEditingCounter(null);
        await loadBranchDetails(true);
      }
    } catch (err: any) {
      alert(err.message || 'فشل حفظ بيانات الشباك.');
    } finally {
      setCounterSaving(false);
    }
  };

  // Handle Soft-Disable Counter
  const handleDisableCounter = async (counterId: string, counterName: string) => {
    if (!confirm(`هل أنت متأكد من إغلاق وتعطيل (${counterName})؟ ستبقى كافة سجلات عمله السابقة محفوظة.`)) return;

    try {
      const res = await apiFetch(`/api/hq/branch/${branchId}/counters/${counterId}`, {
        method: 'DELETE',
        headers: {
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        }
      });

      if (res && res.success) {
        setActionMessage({
          text: res.message || 'تم إغلاق وتعطيل الشباك بنجاح.',
          type: 'success'
        });
        await loadBranchDetails(true);
      }
    } catch (err: any) {
      alert(err.message || 'فشل إغلاق الشباك.');
    }
  };

  // Handle Save Service
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceSaving(true);
    setActionMessage(null);

    try {
      const payload = {
        id: editingService ? editingService.id : undefined,
        name: serviceForm.name,
        prefix: serviceForm.prefix,
        desc: serviceForm.desc,
        assignedCounterId: serviceForm.assignedCounterId || undefined,
        active: serviceForm.active
      };

      const res = await apiFetch(`/api/hq/branch/${branchId}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setActionMessage({
          text: res.message || 'تم حفظ الخدمة بنجاح.',
          type: 'success'
        });
        setShowServiceModal(false);
        setEditingService(null);
        await loadBranchDetails(true);
      }
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الخدمة.');
    } finally {
      setServiceSaving(false);
    }
  };

  // Handle Soft-Disable Service
  const handleDisableService = async (serviceId: string, serviceName: string) => {
    if (!confirm(`هل تريد تعطيل خدمة (${serviceName})؟ ستبقى كافة تذاكرها وسجلاتها القديمة محفوظة بالكامل.`)) return;

    try {
      const res = await apiFetch(`/api/hq/branch/${branchId}/services/${serviceId}`, {
        method: 'DELETE',
        headers: {
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        }
      });

      if (res && res.success) {
        setActionMessage({
          text: res.message || 'تم إيقاف الخدمة بنجاح.',
          type: 'success'
        });
        await loadBranchDetails(true);
      }
    } catch (err: any) {
      alert(err.message || 'فشل إيقاف الخدمة.');
    }
  };

  // Download CSV Report
  const handleDownloadCsv = () => {
    const url = `/api/hq/branch/${branchId}/export-report${adminToken ? `?token=${encodeURIComponent(adminToken)}` : ''}`;
    window.open(url, '_blank');
  };

  // Filter records by date and query
  const filteredAgencies = useMemo(() => {
    if (!details) return [];
    return details.agencies.filter(a => {
      // Date filter
      const aDate = a.createdAt ? a.createdAt.split('T')[0] : '';
      if (periodFilter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        if (aDate && aDate !== today) return false;
      } else if (periodFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (a.createdAt && new Date(a.createdAt) < weekAgo) return false;
      } else if (periodFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (a.createdAt && new Date(a.createdAt) < monthAgo) return false;
      } else if (periodFilter === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        if (a.createdAt && new Date(a.createdAt) < yearAgo) return false;
      } else if (periodFilter === 'custom') {
        if (aDate && (aDate < customStartDate || aDate > customEndDate)) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = a.agencyNumber?.toLowerCase().includes(q);
        const matchesType = a.agencyType?.toLowerCase().includes(q);
        const matchesPrinc = a.principalsNames?.toLowerCase().includes(q);
        const matchesLaw = a.lawyersNames?.toLowerCase().includes(q);
        const matchesDelegate = a.notaryDelegateName?.toLowerCase().includes(q);
        const matchesReceipt = a.receiptNumber?.toLowerCase().includes(q);
        if (!matchesNum && !matchesType && !matchesPrinc && !matchesLaw && !matchesDelegate && !matchesReceipt) {
          return false;
        }
      }

      return true;
    });
  }, [details, periodFilter, customStartDate, customEndDate, statusFilter, searchQuery]);

  const filteredTickets = useMemo(() => {
    if (!details) return [];
    return details.tickets.filter(t => {
      const tDate = t.createdAt ? t.createdAt.split('T')[0] : '';
      if (periodFilter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        if (tDate && tDate !== today) return false;
      } else if (periodFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (t.createdAt && new Date(t.createdAt) < weekAgo) return false;
      } else if (periodFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (t.createdAt && new Date(t.createdAt) < monthAgo) return false;
      } else if (periodFilter === 'custom') {
        if (tDate && (tDate < customStartDate || tDate > customEndDate)) return false;
      }

      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDisplay = t.displayNumber?.toLowerCase().includes(q);
        const matchesCategory = t.categoryNameArabic?.toLowerCase().includes(q);
        const matchesStaff = t.staffName?.toLowerCase().includes(q);
        const matchesCounter = t.counterName?.toLowerCase().includes(q);
        if (!matchesDisplay && !matchesCategory && !matchesStaff && !matchesCounter) {
          return false;
        }
      }

      return true;
    });
  }, [details, periodFilter, customStartDate, customEndDate, statusFilter, searchQuery]);

  // Dynamic Performance Metrics based on filtered data
  const performanceStats = useMemo(() => {
    if (!details) {
      return {
        totalAgencies: 0,
        completedAgencies: 0,
        pendingAgencies: 0,
        totalFees: 0,
        totalTickets: 0,
        completedTickets: 0,
        waitingTickets: 0,
        avgWaitSeconds: 0,
        avgServiceSeconds: 0,
        completionRate: 100
      };
    }

    const ags = filteredAgencies;
    const tks = filteredTickets;

    const completedAgencies = ags.filter(a => a.status === 'approved').length;
    const pendingAgencies = ags.filter(a => a.status === 'pending_review').length;
    const totalFees = ags.reduce((acc, a) => acc + (Number(a.feesPaid) || 0), 0);

    const completedTickets = tks.filter(t => t.status === 'completed').length;
    const waitingTickets = tks.filter(t => t.status === 'waiting').length;

    let totalWait = 0;
    let waitCount = 0;
    let totalService = 0;
    let serviceCount = 0;

    tks.forEach(t => {
      if (t.calledAt && t.createdAt) {
        const diff = (new Date(t.calledAt).getTime() - new Date(t.createdAt).getTime()) / 1000;
        if (diff >= 0 && diff < 86400) {
          totalWait += diff;
          waitCount++;
        }
      }
      if (t.completedAt && t.calledAt) {
        const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 1000;
        if (diff >= 0 && diff < 86400) {
          totalService += diff;
          serviceCount++;
        }
      }
    });

    const avgWaitSeconds = waitCount > 0 ? Math.round(totalWait / waitCount) : 0;
    const avgServiceSeconds = serviceCount > 0 ? Math.round(totalService / serviceCount) : 0;
    const totalCount = ags.length || tks.length;
    const completionRate =
      totalCount > 0
        ? Math.round(((completedAgencies || completedTickets) / totalCount) * 100)
        : 100;

    return {
      totalAgencies: ags.length,
      completedAgencies,
      pendingAgencies,
      totalFees,
      totalTickets: tks.length,
      completedTickets,
      waitingTickets,
      avgWaitSeconds,
      avgServiceSeconds,
      completionRate
    };
  }, [details, filteredAgencies, filteredTickets]);

  const formatSecondsToMinutes = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0 دقيقة';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} ثانية`;
    return secs > 0 ? `${mins} دقيقة و ${secs} ثانية` : `${mins} دقيقة`;
  };

  if (loading && !details) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-100" dir="rtl">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm font-bold text-slate-300">جارِ تحميل بيانات وسجلات الفرع من الخادم المركزي...</div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto my-12 text-slate-100" dir="rtl">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-black text-white">تعذر العثور على الفرع المطلوب</h2>
        <p className="text-xs text-slate-400">
          لم يتم العثور على سجلات تطابق المعرف ({branchId}) في قاعدة البيانات المركزية.
        </p>
        <button
          onClick={onBackToBranches}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة الفروع</span>
        </button>
      </div>
    );
  }

  const { branch, manager, managerHistory, staff, counters, services, auditLogs, syncStatus } = details;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 text-slate-100" dir="rtl">
      {/* ================================================================= */}
      {/* 1. TOP BREADCRUMB & BRANCH HEADER                                 */}
      {/* ================================================================= */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800/80 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={onBackToBranches}
              className="text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors font-bold cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>لوحة الإدارة المركزية</span>
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">فروع نقابة المحامين</span>
            <span className="text-slate-600">/</span>
            <span className="text-amber-400 font-bold">{branch.name}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => loadBranchDetails(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="تحديث البيانات من السيرفر"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{refreshing ? 'جارِ التحديث...' : 'تحديث'}</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="تصدير تقرير أداء الفرع كملف CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>تصدير CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="طباعة التقرير"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>طباعة</span>
            </button>

            <button
              onClick={onBackToBranches}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
            >
              <span>قائمة الفروع</span>
            </button>
          </div>
        </div>

        {/* Branch Identity Card */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
              <Building2 className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">{branch.name}</h1>
                {branch.isHeadquarters && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    المقر الرئيسي
                  </span>
                )}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    branch.isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}
                >
                  {branch.isActive ? 'الفرع فعال' : 'الفرع معطل'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="text-slate-500 font-bold">الرمز:</span>
                  <span className="font-mono text-amber-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {branch.code}
                  </span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{branch.city}</span>
                  {branch.address && <span className="text-slate-500">({branch.address})</span>}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono">{branch.phone || '021-000000'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>آخر مزامنة:</span>
                  <span className="text-slate-300 font-mono">
                    {branch.lastSyncAt ? new Date(branch.lastSyncAt).toLocaleString('ar-SY') : 'اليوم'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Manager & Status Box */}
          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl shrink-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">مدير الفرع الحالي:</div>
              <div className="text-xs font-black text-white">{manager ? manager.fullName : 'لم يتم تعيين مدير'}</div>
              <div className="text-[10px] text-slate-500 font-mono">
                {manager ? `@${manager.username} (${manager.active ? 'نشط' : 'معطل'})` : 'غير معرف'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div
            className={`mt-4 p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : actionMessage.type === 'error'
                ? 'bg-red-950/70 border-red-500/40 text-red-300'
                : 'bg-blue-950/70 border-blue-500/40 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {actionMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {actionMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
              {actionMessage.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* 2. SUB-SECTION NAVIGATION BAR                                     */}
      {/* ================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>نظرة عامة والملخص</span>
        </button>

        <button
          onClick={() => setActiveTab('admin_data')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'admin_data'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Edit className="w-4 h-4" />
          <span>تعديل بيانات الفرع</span>
        </button>

        <button
          onClick={() => setActiveTab('manager')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'manager'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>مدير الفرع وحسابه</span>
        </button>

        <button
          onClick={() => setActiveTab('delegates')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'delegates'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>مندوبو الوكالات ({staff.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('counters')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'counters'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>الشبابيك والموظفون ({counters.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'services'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>الخدمات والمهام ({services.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'records'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>سجل المعاملات والبيانات ({details.agencies.length + details.tickets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'performance'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>الإحصائيات وتقييم الأداء</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* PERIOD SELECTOR FILTER BAR (Used across tabs)                     */}
      {/* ================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 font-bold flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-400" />
            الفترة الزمنية للمؤشرات والتقارير:
          </span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setPeriodFilter('today')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                periodFilter === 'today' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setPeriodFilter('week')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                periodFilter === 'week' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              هذا الأسبوع
            </button>
            <button
              onClick={() => setPeriodFilter('month')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                periodFilter === 'month' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setPeriodFilter('year')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                periodFilter === 'year' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              هذا العام
            </button>
            <button
              onClick={() => setPeriodFilter('custom')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                periodFilter === 'custom' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              فترة مخصصة
            </button>
          </div>
        </div>

        {periodFilter === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">من:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white px-2.5 py-1 rounded-lg font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">إلى:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white px-2.5 py-1 rounded-lg font-mono text-xs"
              />
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 font-mono">
          سجلات الفترة: {filteredAgencies.length} معاملة | {filteredTickets.length} تذكرة دور
        </div>
      </div>

      {/* ================================================================= */}
      {/* SUB-SECTION 1: OVERVIEW & OPERATIONAL SUMMARY                     */}
      {/* ================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-xs text-slate-400 font-bold flex items-center justify-between">
                <span>إجمالي المعاملات والوكالات</span>
                <FileText className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400">{performanceStats.totalAgencies}</div>
              <div className="text-[10px] text-slate-500 font-mono">
                {performanceStats.completedAgencies} منجزة • {performanceStats.pendingAgencies} معلقة
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-xs text-slate-400 font-bold flex items-center justify-between">
                <span>تذاكر وأدوار المراجعين</span>
                <TicketIcon className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-blue-400">{performanceStats.totalTickets}</div>
              <div className="text-[10px] text-slate-500 font-mono">
                {performanceStats.completedTickets} تم خدمتهم • {performanceStats.waitingTickets} بالانتظار
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-xs text-slate-400 font-bold flex items-center justify-between">
                <span>معدل الإنجاز العام</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400">{performanceStats.completionRate}%</div>
              <div className="text-[10px] text-slate-500 font-mono">
                محسوب مباشرة من قيود الإنجاز
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-xs text-slate-400 font-bold flex items-center justify-between">
                <span>الرسوم المستوفاة (ل.س)</span>
                <DollarSign className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-400">
                {performanceStats.totalFees.toLocaleString('ar-SY')}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">رسوم الصندوق والنقابة</div>
            </div>
          </div>

          {/* Operational Metrics Cards (Wait and Service Duration) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-bold">متوسط وقت الانتظار</div>
                <div className="text-sm font-black text-white">{formatSecondsToMinutes(performanceStats.avgWaitSeconds)}</div>
                <div className="text-[10px] text-slate-500">من سحب التذكرة حتى النداء</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-bold">متوسط وقت إنجاز المعاملة</div>
                <div className="text-sm font-black text-white">{formatSecondsToMinutes(performanceStats.avgServiceSeconds)}</div>
                <div className="text-[10px] text-slate-500">أمام مندوب التوثيق على الشباك</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-bold">الكادر والشبابيك المشغولة</div>
                <div className="text-sm font-black text-white">
                  {counters.filter(c => c.currentStaffId).length} شباك نشط حالياً
                </div>
                <div className="text-[10px] text-slate-500">من أصل {counters.length} شبابيك معرفة</div>
              </div>
            </div>
          </div>

          {/* Quick Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Admin Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>البيانات الإدارية والتشغيلية</span>
                </h3>
                <button
                  onClick={() => setActiveTab('admin_data')}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>تعديل البيانات</span>
                </button>
              </div>

              <div className="divide-y divide-slate-800/80 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">اسم الفرع الرسمي:</span>
                  <span className="font-bold text-white">{branch.name}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">رمز الفرع الفريد (Code):</span>
                  <span className="font-mono font-bold text-amber-400">{branch.code}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">المدينة / المنطقة:</span>
                  <span className="text-slate-200">{branch.city}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">العنوان التفصيلي:</span>
                  <span className="text-slate-200">{branch.address || 'القصر العدلي'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">هاتف التواصل:</span>
                  <span className="font-mono text-slate-200">{branch.phone || '021-000000'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">حالة الفرع في المنظومة:</span>
                  <span className={branch.isActive ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {branch.isActive ? 'نشط ويعمل أصولاً' : 'معطل وموقوف'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">حالة الربط السحابي:</span>
                  <span className="font-mono text-slate-300 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${syncStatus.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    {syncStatus.isOnline ? 'متصل بالسحابة' : 'وضع محلي أوفلاين'}
                    {syncStatus.pendingQueueCount > 0 && (
                      <span className="text-amber-400 font-bold">({syncStatus.pendingQueueCount} معلق)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Staff & Counters Preview */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>مندوبو الوكالات وكادر التوثيق ({staff.length})</span>
                </h3>
                <button
                  onClick={() => setActiveTab('delegates')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                >
                  إدارة المندوبين
                </button>
              </div>

              {staff.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  لا يوجد مندوبون مسجلون في هذا الفرع حالياً.
                </div>
              ) : (
                <div className="space-y-2">
                  {staff.slice(0, 4).map(s => (
                    <div
                      key={s.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white">{s.name}</div>
                          <div className="text-[10px] text-slate-400">{s.jobTitle || 'مندوب وكالات'}</div>
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        <div className="text-[11px] font-bold text-emerald-400">
                          {s.completedAgenciesCount || 0} معاملة منجزة
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {s.active ? 'حساب مفعّل' : 'حساب معطل'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Actions Footer */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    setEditingDelegate(null);
                    setDelegateForm({ name: '', pin: '', jobTitle: 'مندوب وكالات', active: true });
                    setShowDelegateModal(true);
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة مندوب جديد</span>
                </button>

                <button
                  onClick={() => {
                    setEditingCounter(null);
                    setCounterForm({ name: '', isOpen: true, assignedServiceId: '', currentStaffId: '' });
                    setShowCounterModal(true);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة شباك جديد</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-SECTION 2: EDIT ADMINISTRATIVE DATA                           */}
      {/* ================================================================= */}
      {activeTab === 'admin_data' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-400" />
                <span>تعديل البيانات الإدارية للفرع وحفظها في قاعدة البيانات</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                تُحفظ كافة التعديلات مباشرة في قاعدة البيانات المركزية ويتم ترحيلها إلى المكتب المعني عند المزامنة
              </p>
            </div>

            {!isEditingAdmin ? (
              <button
                onClick={() => setIsEditingAdmin(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" />
                <span>تفعيل وضع التعديل</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditingAdmin(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>إلغاء التعديل</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSaveAdminData} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  اسم الفرع الرسمي <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditingAdmin}
                  value={adminForm.name}
                  onChange={e => setAdminForm({ ...adminForm, name: e.target.value })}
                  placeholder="مثلاً: مكتب نقابة المحامين - فرع عفرين"
                  className="w-full bg-slate-950 border border-slate-700 disabled:opacity-60 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  رمز الفرع الفريد (Unique Code) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditingAdmin}
                  value={adminForm.code}
                  onChange={e => setAdminForm({ ...adminForm, code: e.target.value.toUpperCase() })}
                  placeholder="مثلاً: ALP-AFR"
                  className="w-full bg-slate-950 border border-slate-700 disabled:opacity-60 text-white rounded-xl p-3 font-mono uppercase focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">يُشترط أن يكون الرمز فريداً وغير متكرر</span>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">المدينة أو المنطقة</label>
                <input
                  type="text"
                  disabled={!isEditingAdmin}
                  value={adminForm.city}
                  onChange={e => setAdminForm({ ...adminForm, city: e.target.value })}
                  placeholder="مثلاً: عفرين، إعزاز، حلب"
                  className="w-full bg-slate-950 border border-slate-700 disabled:opacity-60 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-bold mb-1.5">العنوان التفصيلي وموقع المكتب</label>
                <input
                  type="text"
                  disabled={!isEditingAdmin}
                  value={adminForm.address}
                  onChange={e => setAdminForm({ ...adminForm, address: e.target.value })}
                  placeholder="مبنى المجمع القضائي، جانب المحكمة"
                  className="w-full bg-slate-950 border border-slate-700 disabled:opacity-60 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">رقم هاتف التواصل والفاكس</label>
                <input
                  type="text"
                  disabled={!isEditingAdmin}
                  value={adminForm.phone}
                  onChange={e => setAdminForm({ ...adminForm, phone: e.target.value })}
                  placeholder="021-000000"
                  className="w-full bg-slate-950 border border-slate-700 disabled:opacity-60 text-white rounded-xl p-3 font-mono focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-300 font-bold mb-1.5">ملاحظات وتعليمات إدارية</label>
                <textarea
                  rows={3}
                  disabled={!isEditingAdmin}
                  value={adminForm.notes}
                  onChange={e => setAdminForm({ ...adminForm, notes: e.target.value })}
                  placeholder="ملاحظات توثيقية حول الفرع أو مواعيد العمل الخاصة..."
                  className="w-full bg-slate-950 border border-slate-700 disabled:opacity-60 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              <div className="sm:col-span-3 flex items-center gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <input
                  type="checkbox"
                  id="isActiveBranch"
                  disabled={!isEditingAdmin}
                  checked={adminForm.isActive}
                  onChange={e => setAdminForm({ ...adminForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                />
                <label htmlFor="isActiveBranch" className="text-xs font-bold text-white cursor-pointer">
                  حالة الفرع: مفعل ونشط لاستقبال المعاملات وإصدار التذاكر
                </label>
                <span className="text-[11px] text-slate-500 mr-auto">
                  (عند إلغاء التفعيل يتم إيقاف الخدمة في الصالة مؤقتاً دون حذف أي سجلات)
                </span>
              </div>
            </div>

            {isEditingAdmin && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingAdmin(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء التعديل
                </button>
                <button
                  type="submit"
                  disabled={adminSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className={`w-4 h-4 ${adminSaving ? 'animate-spin' : ''}`} />
                  <span>{adminSaving ? 'جارِ الحفظ الفعلي...' : 'حفظ التعديلات في قاعدة البيانات'}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-SECTION 3: BRANCH MANAGER MANAGEMENT                         */}
      {/* ================================================================= */}
      {activeTab === 'manager' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-400" />
                  <span>إدارة حساب مدير الفرع والصلاحيات</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  لكل مدير فرع حساب مستقل مرتبط بفرعه، وعند استبدال المدير يتم الاحتفاظ بالسجل الإداري السابق
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isEditingManager && !isReplacingManager && (
                  <>
                    <button
                      onClick={() => {
                        setIsEditingManager(true);
                        setIsReplacingManager(false);
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit className="w-4 h-4" />
                      <span>تعديل بيانات المدير الحالي</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsReplacingManager(true);
                        setIsEditingManager(false);
                        setManagerForm({
                          fullName: '',
                          username: '',
                          password: '',
                          active: true,
                          previousManagerNotes: `تم تعيين مدير جديد لفرع ${branch.name} بأمر الإدارة المركزية`
                        });
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>تعيين مدير بديل للفرع</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Current Manager Profile Box */}
            {!isEditingManager && !isReplacingManager && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="text-xs font-bold text-amber-400 mb-2">بيانات الحساب الشخصي للمدير الحالي</div>
                  {manager ? (
                    <div className="divide-y divide-slate-850 text-xs">
                      <div className="py-2 flex justify-between">
                        <span className="text-slate-400">الاسم الثلاثي:</span>
                        <span className="font-bold text-white">{manager.fullName}</span>
                      </div>
                      <div className="py-2 flex justify-between">
                        <span className="text-slate-400">اسم المستخدم (Username):</span>
                        <span className="font-mono font-bold text-amber-400">@{manager.username}</span>
                      </div>
                      <div className="py-2 flex justify-between">
                        <span className="text-slate-400">حالة الحساب:</span>
                        <span className={manager.active ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                          {manager.active ? 'نشط ومصرح له بالدخول' : 'معطل وموقوف'}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between">
                        <span className="text-slate-400">تاريخ التعيين والإنشاء:</span>
                        <span className="text-slate-300 font-mono">
                          {manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('ar-SY') : '2026-01-01'}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between">
                        <span className="text-slate-400">آخر تسجيل دخول ناجح:</span>
                        <span className="text-slate-300 font-mono">
                          {manager.lastLoginAt ? new Date(manager.lastLoginAt).toLocaleString('ar-SY') : 'لم يسجل دخول بعد'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500">
                      لم يتم تعيين مدير لهذا الفرع بعد. يرجى الضغط على زر تعيين مدير للفرع أعلاه.
                    </div>
                  )}
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold text-blue-400 mb-2">ضوابط أمان إدارة الفروع</div>
                    <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                      <li>تُمنح صلاحية إدارة الفرع حصراً لمدير المكتب المخول من النقابة.</li>
                      <li>لا يجوز استخدام رمز PIN الخاص بالموظفين للدخول كمدير فرع.</li>
                      <li>عند استبدال المدير، تبقى كافة المعاملات القديمة منسوبة للشخص الذي وثقها فعلياً.</li>
                      <li>يتم توثيق كل تغيير في سجل الإدارة وأرشيف النقابة.</li>
                    </ul>
                  </div>

                  {manager && (
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setIsEditingManager(true);
                          setManagerForm({
                            fullName: manager.fullName,
                            username: manager.username,
                            password: '',
                            active: !manager.active,
                            previousManagerNotes: ''
                          });
                        }}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer ${
                          manager.active
                            ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {manager.active ? 'تعطيل حساب المدير' : 'إعادة تفعيل حساب المدير'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Manager Form (Edit or Replace) */}
            {(isEditingManager || isReplacingManager) && (
              <form onSubmit={handleSaveManager} className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white text-xs flex items-center gap-2">
                    {isReplacingManager ? (
                      <>
                        <UserPlus className="w-4 h-4 text-amber-400" />
                        <span>تعيين مدير بديل ونقل الإدارة السابقة للأرشيف</span>
                      </>
                    ) : (
                      <>
                        <Edit className="w-4 h-4 text-amber-400" />
                        <span>تعديل بيانات وحساب المدير الحالي</span>
                      </>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingManager(false);
                      setIsReplacingManager(false);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">
                      اسم المدير الجديد / المعدل <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={managerForm.fullName}
                      onChange={e => setManagerForm({ ...managerForm, fullName: e.target.value })}
                      placeholder="مثلاً: الأستاذ محمد الحلبي"
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">
                      اسم المستخدم لحساب المدير <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={managerForm.username}
                      onChange={e => setManagerForm({ ...managerForm, username: e.target.value })}
                      placeholder="مثلاً: manager_afrin"
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 font-mono focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">
                      كلمة المرور {isReplacingManager ? <span className="text-red-400">*</span> : '(اتركها فارغة إذا لم ترغب بالتغيير)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={managerForm.password}
                        onChange={e => setManagerForm({ ...managerForm, password: e.target.value })}
                        placeholder={isReplacingManager ? 'أدخل كلمة مرور قوية للمدير الجديد' : '••••••••'}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 font-mono pl-10 focus:outline-none focus:border-amber-500"
                        required={isReplacingManager}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-3 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isReplacingManager && (
                    <div>
                      <label className="block text-slate-300 font-bold mb-1.5">ملاحظات وقرار الاستبدال</label>
                      <input
                        type="text"
                        value={managerForm.previousManagerNotes}
                        onChange={e => setManagerForm({ ...managerForm, previousManagerNotes: e.target.value })}
                        placeholder="سبب استبدال المدير (مثلاً: انتهاء مدة التكليف الإداري)"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isManagerActive"
                      checked={managerForm.active}
                      onChange={e => setManagerForm({ ...managerForm, active: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-slate-900 border-slate-700"
                    />
                    <label htmlFor="isManagerActive" className="text-xs font-bold text-white cursor-pointer">
                      تفعيل الحساب وإتاحة تسجيل الدخول للمدير
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingManager(false);
                      setIsReplacingManager(false);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={managerSaving}
                    className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-2"
                  >
                    <Save className={`w-4 h-4 ${managerSaving ? 'animate-spin' : ''}`} />
                    <span>{managerSaving ? 'جارِ الحفظ...' : isReplacingManager ? 'تثبيت وتعيين المدير البديل' : 'حفظ التعديلات'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Historical Managerial Appointments Table */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="font-bold text-white text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>سجل الإدارة السابق وتاريخ التعيينات في هذا الفرع</span>
              </h3>

              {managerHistory.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-slate-950 rounded-2xl border border-slate-800">
                  لا توجد سجلات استبدال سابقة لهذا الفرع، والمدير الحالي هو المعين الأول.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <th className="p-3">اسم المدير السابق</th>
                        <th className="p-3">تاريخ بدء التكليف</th>
                        <th className="p-3">تاريخ انتهاء التكليف</th>
                        <th className="p-3">الملاحظات والقرارات</th>
                        <th className="p-3">المسؤول عن التكليف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {managerHistory.map(mh => (
                        <tr key={mh.id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-white">{mh.managerName}</td>
                          <td className="p-3 font-mono text-slate-400">
                            {mh.appointedAt ? new Date(mh.appointedAt).toLocaleDateString('ar-SY') : '-'}
                          </td>
                          <td className="p-3 font-mono text-slate-400">
                            {mh.endedAt ? new Date(mh.endedAt).toLocaleDateString('ar-SY') : '-'}
                          </td>
                          <td className="p-3 text-slate-300">{mh.notes || 'استبدال إداري'}</td>
                          <td className="p-3 text-amber-400 font-bold">{mh.assignedBy || 'المدير العام'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-SECTION 4: DELEGATES MANAGEMENT                               */}
      {/* ================================================================= */}
      {activeTab === 'delegates' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <span>مندوبو الوكالات وكادر التوثيق بالفرع ({staff.length})</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  إدارة مندوبي رئيس الفرع، نقلهم بين الفروع، وتعيينهم مع الحفاظ الكامل على كافة الوكالات المسجلة
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingDelegate(null);
                  setDelegateForm({ name: '', pin: '', jobTitle: 'مندوب وكالات', active: true });
                  setShowDelegateModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مندوب جديد</span>
              </button>
            </div>

            {/* Delegates Table */}
            {staff.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                لا يوجد أي مندوبين مسجلين لهذا الفرع حالياً. انقر على زر إضافة مندوب جديد لإضافة أول حساب.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="p-3">اسم المندوب</th>
                      <th className="p-3">المسمى الوظيفي</th>
                      <th className="p-3">رمز الدخول PIN</th>
                      <th className="p-3">المعاملات المسجلة</th>
                      <th className="p-3">المنجزة / المعلقة</th>
                      <th className="p-3">آخر نشاط</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 text-center">الإجراءات الإدارية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {staff.map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                            {s.name.charAt(0)}
                          </div>
                          <span>{s.name}</span>
                        </td>
                        <td className="p-3 text-slate-300">{s.jobTitle || 'مندوب وكالات'}</td>
                        <td className="p-3 font-mono text-slate-400">••••</td>
                        <td className="p-3 font-mono font-bold text-amber-400">{s.registeredAgenciesCount || 0}</td>
                        <td className="p-3 font-mono text-slate-300">
                          <span className="text-emerald-400 font-bold">{s.completedAgenciesCount || 0}</span> /{' '}
                          <span className="text-amber-400">{s.pendingAgenciesCount || 0}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">
                          {s.lastActive ? new Date(s.lastActive).toLocaleDateString('ar-SY') : 'اليوم'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              s.active
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}
                          >
                            {s.active ? 'نشط' : 'معطل'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => {
                                setEditingDelegate(s);
                                setDelegateForm({
                                  name: s.name,
                                  pin: '',
                                  jobTitle: s.jobTitle || 'مندوب وكالات',
                                  active: s.active
                                });
                                setShowDelegateModal(true);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg cursor-pointer"
                              title="تعديل بيانات المندوب والـ PIN"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setTransferringDelegate(s);
                                setTargetBranchId('');
                              }}
                              className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg cursor-pointer"
                              title="نقل المندوب لفرع آخر"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteDelegate(s.id, s.name)}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg cursor-pointer"
                              title="تعطيل وأرشفة الحساب بأمان"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-SECTION 5: COUNTERS & STAFF MANAGEMENT                       */}
      {/* ================================================================= */}
      {activeTab === 'counters' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span>الشبابيك ونقاط التوثيق في الفرع ({counters.length})</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  إدارة نقاط الخدمة والشاشات، إسناد الخدمات، وتعيين الموظفين المسؤولين عن كل شباك
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingCounter(null);
                  setCounterForm({ name: '', isOpen: true, assignedServiceId: '', currentStaffId: '' });
                  setShowCounterModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة شباك جديد</span>
              </button>
            </div>

            {/* Counters Grid */}
            {counters.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                لا توجد شبابيك مسجلة لهذا الفرع حالياً. انقر على إضافة شباك جديد لتعريف الشباك الأول.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {counters.map(c => {
                  const currentStaff = staff.find(s => s.id === c.currentStaffId);

                  return (
                    <div
                      key={c.id}
                      className={`bg-slate-950 border rounded-2xl p-4 space-y-3 transition-all ${
                        c.isOpen ? 'border-slate-800 hover:border-slate-700' : 'border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                            {c.name.replace(/\D/g, '') || '#'}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-xs">{c.name}</h3>
                            <div className="text-[10px] text-slate-400">
                              {c.assignedServiceName || 'متاح لكافة الخدمات'}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.isOpen
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }`}
                        >
                          {c.isOpen ? (c.isPaused ? 'استراحة' : 'مفتوح') : 'مغلق'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-850 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">الموظف المسؤول:</span>
                          <span className="font-bold text-white">
                            {c.currentStaffName || currentStaff?.name || 'غير محجوز'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center font-mono">
                          <span className="text-slate-400">الأدوار المستدعاة:</span>
                          <span className="font-bold text-blue-400">{c.ticketsCalledCount || 0}</span>
                        </div>
                        <div className="flex justify-between items-center font-mono">
                          <span className="text-slate-400">المعاملات المنجزة:</span>
                          <span className="font-bold text-emerald-400">{c.ticketsCompletedCount || 0}</span>
                        </div>
                        <div className="flex justify-between items-center font-mono text-[11px]">
                          <span className="text-slate-400">متوسط الإنجاز:</span>
                          <span className="text-slate-300">{formatSecondsToMinutes(c.avgServiceTimeSeconds || 0)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
                        <button
                          onClick={() => {
                            setEditingCounter(c);
                            setCounterForm({
                              name: c.name,
                              isOpen: c.isOpen,
                              assignedServiceId: c.assignedServiceId || '',
                              currentStaffId: c.currentStaffId || ''
                            });
                            setShowCounterModal(true);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDisableCounter(c.id, c.name)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold border border-red-500/20 cursor-pointer"
                        >
                          إغلاق الشباك
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-SECTION 6: SERVICES & TASKS MANAGEMENT                       */}
      {/* ================================================================= */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-amber-400" />
                  <span>الخدمات والمعاملات المقدمة في الفرع ({services.length})</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  تحديد أنواع المعاملات، بادئات التذاكر (Prefix)، وإسنادها إلى الشبابيك المعنية
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingService(null);
                  setServiceForm({ name: '', prefix: '', desc: '', assignedCounterId: '', active: true });
                  setShowServiceModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة خدمة جديدة</span>
              </button>
            </div>

            {/* Services Table */}
            {services.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                لا توجد خدمات محددة لهذا الفرع حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="p-3">بادئة الدور</th>
                      <th className="p-3">اسم الخدمة / المعاملة</th>
                      <th className="p-3">الشباك المخصص</th>
                      <th className="p-3">إجمالي التذاكر</th>
                      <th className="p-3">المنجزة</th>
                      <th className="p-3">متوسط زمن الإنجاز</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {services.map(srv => (
                      <tr key={srv.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-black text-amber-400">
                          <span className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                            {srv.prefix}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-white">{srv.name}</div>
                          {srv.desc && <div className="text-[10px] text-slate-500 line-clamp-1">{srv.desc}</div>}
                        </td>
                        <td className="p-3 text-slate-300 font-medium">
                          {srv.assignedCounterName || 'متاحة لجميع الشبابيك'}
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-400">{srv.ticketsCount || 0}</td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{srv.completedCount || 0}</td>
                        <td className="p-3 font-mono text-slate-300">{formatSecondsToMinutes(srv.avgServiceTimeSeconds || 0)}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              srv.active !== false
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}
                          >
                            {srv.active !== false ? 'مفعلة' : 'معطلة'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingService(srv);
                                setServiceForm({
                                  name: srv.name,
                                  prefix: srv.prefix,
                                  desc: srv.desc || '',
                                  assignedCounterId: srv.assignedCounterId || '',
                                  active: srv.active !== false
                                });
                                setShowServiceModal(true);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                              title="تعديل الخدمة"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDisableService(srv.id, srv.name)}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg cursor-pointer"
                              title="تعطيل الخدمة بأمان"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-SECTION 7: ALL BRANCH DATA & SEARCHABLE RECORDS               */}
      {/* ================================================================= */}
      {activeTab === 'records' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>سجل المعاملات والتذاكر المحفوظة في قاعدة بيانات الفرع</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  البحث الشامل والمطابق لقاعدة البيانات الحقيقية مع إمكانية عرض تفاصيل كل معاملة ومرفقاتها
                </p>
              </div>

              {/* Category Filter Buttons */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto text-xs font-bold">
                <button
                  onClick={() => setRecordCategory('agencies')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    recordCategory === 'agencies' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الوكالات والمعاملات ({filteredAgencies.length})
                </button>
                <button
                  onClick={() => setRecordCategory('tickets')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    recordCategory === 'tickets' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  تذاكر الدور ({filteredTickets.length})
                </button>
                <button
                  onClick={() => setRecordCategory('audits')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    recordCategory === 'audits' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  سجل التدقيق ({auditLogs.length})
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم الوكالة، اسم الموكل، المحامي، المندوب، رقم التذكرة..."
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pr-10 pl-4 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="approved">معتمدة وموثقة</option>
                  <option value="pending_review">قيد المراجعة</option>
                  <option value="completed">منجزة (تذكرة)</option>
                  <option value="waiting">انتظار</option>
                  <option value="serving">قيد الخدمة</option>
                  <option value="skipped">متجاوزة</option>
                </select>
              </div>
            </div>

            {/* Content Display: Agencies */}
            {recordCategory === 'agencies' && (
              <div className="space-y-3">
                {filteredAgencies.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    لا توجد معاملات وكالات تطابق خيارات التصفية والبحث المحددة.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <th className="p-3">رقم الوكالة</th>
                          <th className="p-3">نوع الوكالة</th>
                          <th className="p-3">الموكلون (الأطراف)</th>
                          <th className="p-3">المحامون الوكلاء</th>
                          <th className="p-3">الرسوم المستوفاة</th>
                          <th className="p-3">المندوب الموثق</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3">تاريخ التنظيم</th>
                          <th className="p-3 text-center">التفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {filteredAgencies.map(a => (
                          <tr key={a.id} className="hover:bg-slate-800/40">
                            <td className="p-3 font-mono font-bold text-amber-400">
                              {a.agencyNumber} / {a.agencyYear || 2026}
                            </td>
                            <td className="p-3 text-slate-300 font-medium">{a.agencyType}</td>
                            <td className="p-3 text-slate-300">{a.principalsNames}</td>
                            <td className="p-3 text-slate-300">{a.lawyersNames}</td>
                            <td className="p-3 font-mono text-emerald-400 font-bold">
                              {(Number(a.feesPaid) || 0).toLocaleString('ar-SY')} ل.س
                            </td>
                            <td className="p-3 text-slate-300">{a.notaryDelegateName || '-'}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  a.status === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                }`}
                              >
                                {a.status === 'approved' ? 'معتمدة' : 'قيد المراجعة'}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-400">
                              {new Date(a.createdAt).toLocaleDateString('ar-SY')}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => setSelectedAgencyDetail(a)}
                                className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold cursor-pointer"
                              >
                                فتح
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Content Display: Tickets */}
            {recordCategory === 'tickets' && (
              <div className="space-y-3">
                {filteredTickets.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    لا توجد تذاكر دور مسجلة تطابق التصفية.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <th className="p-3">رقم التذكرة</th>
                          <th className="p-3">الخدمة</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3">الشباك</th>
                          <th className="p-3">الموظف</th>
                          <th className="p-3">وقت الإصدار</th>
                          <th className="p-3">وقت الاستدعاء</th>
                          <th className="p-3">وقت الإنجاز</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {filteredTickets.map(t => (
                          <tr key={t.id} className="hover:bg-slate-800/40">
                            <td className="p-3 font-mono font-black text-white">{t.displayNumber}</td>
                            <td className="p-3 text-slate-300">{t.categoryNameArabic}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  t.status === 'completed'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : t.status === 'serving'
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {t.status === 'completed'
                                  ? 'منجزة'
                                  : t.status === 'serving'
                                  ? 'قيد الخدمة'
                                  : t.status === 'skipped'
                                  ? 'متجاوزة'
                                  : 'انتظار'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-300">{t.counterName || '-'}</td>
                            <td className="p-3 text-slate-300">{t.staffName || '-'}</td>
                            <td className="p-3 font-mono text-slate-400">
                              {new Date(t.createdAt).toLocaleTimeString('ar-SY')}
                            </td>
                            <td className="p-3 font-mono text-slate-400">
                              {t.calledAt ? new Date(t.calledAt).toLocaleTimeString('ar-SY') : '-'}
                            </td>
                            <td className="p-3 font-mono text-slate-400">
                              {t.completedAt ? new Date(t.completedAt).toLocaleTimeString('ar-SY') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Content Display: Audit Logs */}
            {recordCategory === 'audits' && (
              <div className="space-y-2">
                {auditLogs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    لا توجد سجلات تدقيق مسجلة لهذا الفرع.
                  </div>
                ) : (
                  auditLogs.slice(0, 30).map(au => (
                    <div
                      key={au.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{au.action}</span>
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {au.category || 'عام'}
                          </span>
                        </div>
                        <div className="text-slate-400 text-xs">{au.details}</div>
                        <div className="text-[10px] text-slate-500">المستخدم المنفذ: {au.user}</div>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 shrink-0">
                        {new Date(au.timestamp).toLocaleString('ar-SY')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-SECTION 8: COMPREHENSIVE PERFORMANCE EVALUATION               */}
      {/* ================================================================= */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  <span>التقييم الشامل لأداء الفرع والمندوبين والشبابيك</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  مؤشرات دقيقة ومحسوبة 100% من السجلات الفعلية المخزنة في قاعدة البيانات
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadCsv}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير تقرير التقييم (CSV)</span>
                </button>
              </div>
            </div>

            {/* Performance Notice Box */}
            <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 text-xs text-blue-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-blue-300">
                <ShieldCheck className="w-4 h-4" />
                <span>ضوابط التقييم العادل والموضوعي:</span>
              </div>
              <p className="text-[11px] text-blue-200/80 leading-relaxed">
                يتم استخراج جميع المؤشرات التالية حصراً من قيود المعاملات والتذاكر الفعلية في قاعدة البيانات. انخفاض عدد
                المعاملات لا يُعد دليلاً منفرداً على ضعف الأداء، بل يُراعى حجم العمل المتاح ونوع الخدمة المسندة لكل شباك.
              </p>
            </div>

            {/* Delegate Performance Table */}
            <div className="space-y-3">
              <h3 className="font-bold text-white text-xs flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>تقييم أداء مندوبي الوكالات والتوثيق خلال الفترة المختارة</span>
              </h3>

              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="p-3">المندوب</th>
                      <th className="p-3">المسمى الوظيفي</th>
                      <th className="p-3">المعاملات المسجلة</th>
                      <th className="p-3">المنجزة</th>
                      <th className="p-3">المعلقة</th>
                      <th className="p-3">نسبة الإنجاز</th>
                      <th className="p-3">الأدوار المخدومة</th>
                      <th className="p-3">التقييم التشغيلي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {staff.map(s => {
                      const totalM = s.registeredAgenciesCount || 0;
                      const compM = s.completedAgenciesCount || 0;
                      const rate = totalM > 0 ? Math.round((compM / totalM) * 100) : 100;

                      return (
                        <tr key={s.id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-white">{s.name}</td>
                          <td className="p-3 text-slate-300">{s.jobTitle || 'مندوب وكالات'}</td>
                          <td className="p-3 font-mono font-bold text-amber-400">{totalM}</td>
                          <td className="p-3 font-mono font-bold text-emerald-400">{compM}</td>
                          <td className="p-3 font-mono text-amber-400">{s.pendingAgenciesCount || 0}</td>
                          <td className="p-3 font-mono font-bold text-blue-400">{rate}%</td>
                          <td className="p-3 font-mono text-slate-300">{s.ticketsHandledCount || 0}</td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                rate >= 90
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : rate >= 70
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                              }`}
                            >
                              {rate >= 90 ? 'ممتاز' : rate >= 70 ? 'جيد جداً' : 'يحتاج متابعة'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Counters Performance Table */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="font-bold text-white text-xs flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>تقييم أداء الشبابيك ونقاط الخدمة</span>
              </h3>

              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="p-3">الشباك</th>
                      <th className="p-3">الخدمة المسندة</th>
                      <th className="p-3">الموظف الحالي</th>
                      <th className="p-3">الأدوار المستدعاة</th>
                      <th className="p-3">المعاملات المنجزة</th>
                      <th className="p-3">متوسط وقت الانتظار</th>
                      <th className="p-3">متوسط وقت الخدمة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {counters.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-white">{c.name}</td>
                        <td className="p-3 text-slate-300">{c.assignedServiceName || 'عامة'}</td>
                        <td className="p-3 text-slate-300">{c.currentStaffName || 'غير محجوز'}</td>
                        <td className="p-3 font-mono font-bold text-blue-400">{c.ticketsCalledCount || 0}</td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{c.ticketsCompletedCount || 0}</td>
                        <td className="p-3 font-mono text-slate-300">
                          {formatSecondsToMinutes(c.avgWaitTimeSeconds || 0)}
                        </td>
                        <td className="p-3 font-mono text-slate-300">
                          {formatSecondsToMinutes(c.avgServiceTimeSeconds || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 1: ADD / EDIT DELEGATE                                      */}
      {/* ================================================================= */}
      {showDelegateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-slate-100" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>{editingDelegate ? 'تعديل بيانات المندوب' : 'إضافة مندوب جديد للفرع'}</span>
              </h3>
              <button onClick={() => setShowDelegateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDelegate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">اسم المندوب الثلاثي *</label>
                <input
                  type="text"
                  value={delegateForm.name}
                  onChange={e => setDelegateForm({ ...delegateForm, name: e.target.value })}
                  placeholder="مثلاً: حسان مرشحة"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  الرمز السري للدخول PIN {editingDelegate ? '(اتركه فارغاً للإبقاء على الرمز الحالي)' : '*'}
                </label>
                <input
                  type="password"
                  value={delegateForm.pin}
                  onChange={e => setDelegateForm({ ...delegateForm, pin: e.target.value })}
                  placeholder={editingDelegate ? '••••••' : 'رمز من 4 إلى 6 أرقام'}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 font-mono focus:outline-none focus:border-amber-500"
                  required={!editingDelegate}
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">المسمى الوظيفي</label>
                <input
                  type="text"
                  value={delegateForm.jobTitle}
                  onChange={e => setDelegateForm({ ...delegateForm, jobTitle: e.target.value })}
                  placeholder="مندوب رئيس الفرع / مندوب توثيق"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="delegateActive"
                  checked={delegateForm.active}
                  onChange={e => setDelegateForm({ ...delegateForm, active: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-slate-900 border-slate-700"
                />
                <label htmlFor="delegateActive" className="font-bold text-white cursor-pointer">
                  تفعيل حساب المندوب للعمل على الشبابيك
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDelegateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={delegateSaving}
                  className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl font-bold shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Save className={`w-4 h-4 ${delegateSaving ? 'animate-spin' : ''}`} />
                  <span>{delegateSaving ? 'جارِ الحفظ...' : 'حفظ المندوب'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: TRANSFER DELEGATE TO ANOTHER BRANCH                      */}
      {/* ================================================================= */}
      {transferringDelegate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 text-slate-100" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                <span>نقل المندوب إلى فرع آخر</span>
              </h3>
              <button onClick={() => setTransferringDelegate(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-300">
                أنت على وشك نقل المندوب <strong className="text-amber-400">{transferringDelegate.name}</strong> من الفرع الحالي إلى فرع آخر.
              </p>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">اختر الفرع الهدف للنقل:</label>
                <select
                  value={targetBranchId}
                  onChange={e => setTargetBranchId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">-- اضغط لاختيار الفرع --</option>
                  {allBranchesList
                    .filter(b => b.id !== branchId)
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px]">
                سيتم فك ارتباط المندوب بالشباك الحالي ونقله فوراً للفرع الجديد مع الحفاظ على جميع المعاملات التي أنجزها في هذا الفرع دون أي تغيير.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferringDelegate(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleTransferDelegate}
                  disabled={!targetBranchId || delegateSaving}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md cursor-pointer flex items-center gap-2"
                >
                  <ArrowRightLeft className={`w-4 h-4 ${delegateSaving ? 'animate-spin' : ''}`} />
                  <span>{delegateSaving ? 'جارِ النقل...' : 'تأكيد النقل الإداري'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: ADD / EDIT COUNTER                                       */}
      {/* ================================================================= */}
      {showCounterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-slate-100" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>{editingCounter ? 'تعديل بيانات الشباك' : 'إضافة شباك جديد بالفرع'}</span>
              </h3>
              <button onClick={() => setShowCounterModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCounter} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">اسم أو رقم الشباك *</label>
                <input
                  type="text"
                  value={counterForm.name}
                  onChange={e => setCounterForm({ ...counterForm, name: e.target.value })}
                  placeholder="مثلاً: الشباك 1 أو شباك التوثيق 2"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">الخدمة المسندة للشباك</label>
                <select
                  value={counterForm.assignedServiceId}
                  onChange={e => setCounterForm({ ...counterForm, assignedServiceId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">متاح لكافة الخدمات</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      ({s.prefix}) {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">الموظف / المندوب المسؤول حالياً</label>
                <select
                  value={counterForm.currentStaffId}
                  onChange={e => setCounterForm({ ...counterForm, currentStaffId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">غير محجوز (متاح للاختيار من التطبيق)</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.jobTitle || 'مندوب'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="counterIsOpen"
                  checked={counterForm.isOpen}
                  onChange={e => setCounterForm({ ...counterForm, isOpen: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-slate-900 border-slate-700"
                />
                <label htmlFor="counterIsOpen" className="font-bold text-white cursor-pointer">
                  الشباك مفتوح في الصالة وجاهز للنداء
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCounterModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={counterSaving}
                  className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl font-bold shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Save className={`w-4 h-4 ${counterSaving ? 'animate-spin' : ''}`} />
                  <span>{counterSaving ? 'جارِ الحفظ...' : 'حفظ الشباك'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 4: ADD / EDIT SERVICE                                       */}
      {/* ================================================================= */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-slate-100" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-amber-400" />
                <span>{editingService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة بالفرع'}</span>
              </h3>
              <button onClick={() => setShowServiceModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">اسم الخدمة والمعاملة *</label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="مثلاً: توثيق وكالة خاصة أو عامة"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">بادئة حرف التذكرة (Prefix) *</label>
                <input
                  type="text"
                  value={serviceForm.prefix}
                  onChange={e => setServiceForm({ ...serviceForm, prefix: e.target.value.toUpperCase().slice(0, 3) })}
                  placeholder="A أو B أو C"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 font-mono font-bold uppercase focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">وصف وشروط الخدمة</label>
                <textarea
                  rows={2}
                  value={serviceForm.desc}
                  onChange={e => setServiceForm({ ...serviceForm, desc: e.target.value })}
                  placeholder="الشروط والمستندات المطلوبة لإنجاز المعاملة..."
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">الشباك المخصص افتراضياً</label>
                <select
                  value={serviceForm.assignedCounterId}
                  onChange={e => setServiceForm({ ...serviceForm, assignedCounterId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">متاحة لأي شباك</option>
                  {counters.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="serviceActive"
                  checked={serviceForm.active}
                  onChange={e => setServiceForm({ ...serviceForm, active: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-slate-900 border-slate-700"
                />
                <label htmlFor="serviceActive" className="font-bold text-white cursor-pointer">
                  تفعيل الخدمة وإتاحة سحب تذاكر لها من الكشك
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={serviceSaving}
                  className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl font-bold shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Save className={`w-4 h-4 ${serviceSaving ? 'animate-spin' : ''}`} />
                  <span>{serviceSaving ? 'جارِ الحفظ...' : 'حفظ الخدمة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 5: AGENCY TRANSACTION DETAILS & ATTACHMENTS                 */}
      {/* ================================================================= */}
      {selectedAgencyDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100" dir="rtl">
            <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>تفاصيل الوكالة رقم: {selectedAgencyDetail.agencyNumber} / {selectedAgencyDetail.agencyYear || 2026}</span>
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  النوع: {selectedAgencyDetail.agencyType} | الفرع: {branch.name}
                </div>
              </div>
              <button
                onClick={() => setSelectedAgencyDetail(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-slate-500 font-bold block mb-1">أسماء الموكلين (الأطراف):</span>
                  <div className="font-bold text-white text-sm">{selectedAgencyDetail.principalsNames}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-1">المحامون الوكلاء:</span>
                  <div className="font-bold text-amber-300 text-sm">{selectedAgencyDetail.lawyersNames}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">الرقم الوطني / الهوية:</span>
                  <span className="font-mono font-bold text-slate-200">{selectedAgencyDetail.nationalId || '-'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">الرسوم المستوفاة:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {(Number(selectedAgencyDetail.feesPaid) || 0).toLocaleString('ar-SY')} ل.س
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">رقم إيصال الصندوق:</span>
                  <span className="font-mono font-bold text-slate-200">{selectedAgencyDetail.receiptNumber || '-'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">مندوب رئيس الفرع الموثق:</span>
                  <span className="font-bold text-white">{selectedAgencyDetail.notaryDelegateName || '-'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">حالة المعاملة:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedAgencyDetail.status === 'approved' ? 'معتمدة وموثقة أصولاً' : 'قيد المراجعة'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">تاريخ ووقت التنظيم:</span>
                  <span className="font-mono text-slate-300">
                    {new Date(selectedAgencyDetail.createdAt).toLocaleString('ar-SY')}
                  </span>
                </div>
              </div>

              {selectedAgencyDetail.notes && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block mb-1">الملاحظات:</span>
                  <div className="text-slate-300">{selectedAgencyDetail.notes}</div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedAgencyDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
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
