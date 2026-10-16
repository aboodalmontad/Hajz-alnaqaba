/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Ticket, Staff, Counter, AuditLog, SystemSettings, CounterSession } from './types';
import { apiFetch } from './utils/network';
import { Navbar } from './components/Navbar';
import { NetworkGuide } from './components/NetworkGuide';
import { Kiosk } from './components/Kiosk';
import { MainDisplay } from './components/MainDisplay';
import { StaffPortal } from './components/StaffPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { CentralHQDashboard } from './components/CentralHQDashboard';
import { LoginHome } from './components/LoginHome';

const defaultSettings: SystemSettings = {
  departmentTitle: 'دائرة الوكالات – نقابة المحامين بحلب',
  departmentSubtitle: 'شاشة عرض أدواري المراجعين في صالة الانتظار',
  tickerMessage: 'يرجى الانتباه إلى أرقام الدور وظهورها على شاشة الشبابيك عند النداء الصوتي. أهلاً بكم في نقابة المحامين بحلب.',
  soundAlertsEnabled: true,
  workingHoursStart: '08:30',
  workingHoursEnd: '15:00',
  ticketSequence: 0,
  categories: [
    {
      id: 'special',
      prefix: 'A',
      name: 'توثيق وكالة',
      desc: 'تنجز هذه المعاملة أمام مندوب رئيس الفرع للتثبت من الهوية و محتويات الوكالة',
      assignedCounterId: 'counter-1791640234085',
      assignedCounterName: 'الشباك 1'
    },
    {
      id: 'cat_1791641888137',
      name: 'الحصول على صورة عن وكالة',
      prefix: 'B',
      desc: ''
    },
    {
      id: 'cat_1791677992936',
      name: 'عزل وكالة',
      prefix: 'C',
      desc: 'لعزل وكالة محامي يتطلب وجود صورة عن الوكالة أو رقمها ودفع رسم العزل وتبليغ المحامي المعزول والتأشير بوقوع العزل على الوكالة المعزولة .'
    }
  ]
};

const defaultInitialStaff: Staff[] = [
  {
    id: 'staff-1791572701221',
    name: 'حسان مرشحة',
    pin: '123456',
    counterId: 'counter-1791640239853',
    active: true,
    role: 'staff',
    jobTitle: 'مندوب وكالات',
    allowedCounterIds: []
  },
  {
    id: 'staff-1791572724537',
    name: 'زكريا ننه',
    pin: '123456',
    counterId: '',
    active: true,
    role: 'staff',
    jobTitle: 'مندوب وكالات',
    allowedCounterIds: []
  },
  {
    id: 'staff-1791657691085',
    name: 'محمود ويس',
    pin: '123456',
    counterId: 'counter-1791640234085',
    active: true,
    role: 'staff',
    jobTitle: 'مندوب وكالات',
    allowedCounterIds: []
  }
];

const defaultInitialCounters: Counter[] = [
  { id: 'counter-1791640234085', name: 'الشباك 1', isOpen: true, isPaused: false },
  { id: 'counter-1791640239853', name: 'الشباك 2', isOpen: true, isPaused: false, assignedServiceId: 'special', assignedServiceName: 'توثيق وكالة' },
  { id: 'counter-1791640243217', name: 'الشباك 3', isOpen: true, isPaused: false, assignedServiceId: 'special', assignedServiceName: 'توثيق وكالة' },
  { id: 'counter-1791640932058', name: 'الشباك 5', isOpen: true, isPaused: false, assignedServiceId: 'cat_1791677992936', assignedServiceName: 'عزل وكالة' },
  { id: 'counter-1791642058000', name: 'الشباك 6', isOpen: true, isPaused: false, assignedServiceId: 'cat_1791641888137', assignedServiceName: 'الحصول على صورة عن وكالة' }
];

interface PersistedClientState {
  settings?: SystemSettings;
  staff?: Staff[];
  counters?: Counter[];
  tickets?: Ticket[];
  date?: string;
  counterSessions?: CounterSession[];
  issuancePaused?: boolean;
}

function loadPersistedClientState(): PersistedClientState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('agency_persisted_state');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function savePersistedClientState(data: Partial<PersistedClientState>) {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadPersistedClientState() || {};
    const updated = { ...prev, ...data };
    localStorage.setItem('agency_persisted_state', JSON.stringify(updated));
  } catch {}
}

// URL Router resolver
function getInitialTab(): 'home' | 'kiosk' | 'display' | 'staff' | 'admin' | 'hq' {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase();
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash.toLowerCase();

  if (
    path.startsWith('/agent') || 
    path.startsWith('/staff') || 
    search.get('tab') === 'agent' || 
    search.get('tab') === 'staff' || 
    hash === '#agent' || 
    hash === '#staff'
  ) {
    return 'staff';
  }
  if (path.startsWith('/kiosk') || search.get('tab') === 'kiosk' || hash === '#kiosk') {
    return 'kiosk';
  }
  if (path.startsWith('/display') || search.get('tab') === 'display' || hash === '#display') {
    return 'display';
  }
  if (path.startsWith('/admin') || search.get('tab') === 'admin' || hash === '#admin') {
    return 'admin';
  }
  if (path.startsWith('/hq') || search.get('tab') === 'hq' || hash === '#hq') {
    return 'hq';
  }
  return 'home';
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'kiosk' | 'display' | 'staff' | 'admin' | 'hq'>(getInitialTab);
  const [connected, setConnected] = useState(false);

  const [auth, setAuth] = useState<{ role: 'hq_admin' | 'branch_manager' | 'counter_staff' | 'agency_delegate'; token: string; name: string; branchId?: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('agency_auth');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const handleLoginSuccess = (authData: { role: 'hq_admin' | 'branch_manager' | 'counter_staff' | 'agency_delegate'; token: string; name: string; branchId?: string }) => {
    setAuth(authData);
    try {
      sessionStorage.setItem('agency_auth', JSON.stringify(authData));
      if (authData.token) {
        sessionStorage.setItem('agency_admin_token', authData.token);
        localStorage.setItem('agency_admin_token', authData.token);
      }
    } catch {}
    if (authData.role === 'hq_admin') handleNavigate('hq');
    else if (authData.role === 'branch_manager') handleNavigate('admin');
    else if (authData.role === 'counter_staff' || authData.role === 'agency_delegate') handleNavigate('staff');
  };

  const handleLogout = () => {
    setAuth(null);
    try {
      sessionStorage.removeItem('agency_auth');
      sessionStorage.removeItem('agency_admin_token');
      localStorage.removeItem('agency_admin_token');
    } catch {}
    setCurrentTab('home');
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.pushState({ tab: 'home' }, '', '/');
    }
  };

  const initialCache = loadPersistedClientState();
  const [tickets, setTickets] = useState<Ticket[]>(() => initialCache?.tickets || []);
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    if (initialCache?.staff && initialCache.staff.length > 0) return initialCache.staff;
    try {
      const b = localStorage.getItem('agency_staff_backup');
      if (b) {
        const parsed = JSON.parse(b);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultInitialStaff;
  });
  const [counters, setCounters] = useState<Counter[]>(() => {
    if (initialCache?.counters && initialCache.counters.length > 0) return initialCache.counters;
    return defaultInitialCounters;
  });
  const [issuancePaused, setIssuancePaused] = useState<boolean>(() => initialCache?.issuancePaused || false);
  const [date, setDate] = useState(() => initialCache?.date || '');
  const [settings, setSettings] = useState<SystemSettings>(() => initialCache?.settings || defaultSettings);
  const [localIPs, setLocalIPs] = useState<string[]>(['127.0.0.1']);
  const [port, setPort] = useState<number>(3000);
  const [serverAppUrl, setServerAppUrl] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [counterSessions, setCounterSessions] = useState<CounterSession[]>(() => initialCache?.counterSessions || []);
  const [lastCalledTicket, setLastCalledTicket] = useState<{ ticket: Ticket; counter: string; isRecall?: boolean; recallCount?: number; timestamp?: string } | null>(null);

  // Sync with browser back/forward buttons & enforce role security
  useEffect(() => {
    const handlePopState = () => {
      const target = getInitialTab();
      if (auth) {
        if (auth.role === 'hq_admin' && target !== 'hq' && target !== 'admin' && target !== 'home') {
          setCurrentTab('hq');
          return;
        }
        if (auth.role === 'branch_manager' && target !== 'admin') {
          setCurrentTab('admin');
          return;
        }
        if ((auth.role === 'agency_delegate' || auth.role === 'counter_staff') && target !== 'staff' && target !== 'kiosk' && target !== 'display') {
          setCurrentTab('staff');
          return;
        }
      }
      setCurrentTab(target);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [auth]);

  // Enforce role-based initial routing on mount if auth exists
  useEffect(() => {
    if (auth) {
      const tab = getInitialTab();
      if (auth.role === 'hq_admin') {
        if (tab !== 'hq' && tab !== 'admin' && tab !== 'home') {
          setCurrentTab('hq');
        }
      } else if (auth.role === 'branch_manager') {
        if (tab !== 'admin') {
          setCurrentTab('admin');
        }
      } else if (auth.role === 'agency_delegate' || auth.role === 'counter_staff') {
        if (tab !== 'staff' && tab !== 'kiosk' && tab !== 'display') {
          setCurrentTab('staff');
        }
      }
    }
  }, [auth]);

  // Safe navigation that updates the address bar URL with strict role checks
  const handleNavigate = useCallback((tab: 'home' | 'kiosk' | 'display' | 'staff' | 'admin' | 'hq') => {
    if (auth) {
      if (auth.role === 'hq_admin' && tab !== 'hq' && tab !== 'admin' && tab !== 'home') {
        return;
      }
      if (auth.role === 'branch_manager' && tab !== 'admin') {
        return;
      }
      if ((auth.role === 'agency_delegate' || auth.role === 'counter_staff') && tab !== 'staff' && tab !== 'kiosk' && tab !== 'display') {
        return;
      }
    }
    setCurrentTab(tab);
    let targetPath = '/';
    if (tab === 'staff') targetPath = '/agent';
    else if (tab === 'kiosk') targetPath = '/kiosk';
    else if (tab === 'display') targetPath = '/display';
    else if (tab === 'admin') targetPath = '/admin';
    else if (tab === 'hq') targetPath = '/hq';

    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  }, [auth]);

  const fetchState = useCallback(() => {
    return apiFetch('/api/state')
      .then(data => {
        setConnected(true);
        if (data.tickets && Array.isArray(data.tickets)) setTickets(data.tickets);
        if (data.staff && Array.isArray(data.staff)) {
          setStaffList(data.staff);
          try { localStorage.setItem('agency_staff_backup', JSON.stringify(data.staff)); } catch {}
        }
        if (data.counters && Array.isArray(data.counters)) setCounters(data.counters);
        if (data.counterSessions) setCounterSessions(data.counterSessions);
        if (typeof data.issuancePaused === 'boolean') setIssuancePaused(data.issuancePaused);
        if (data.date) setDate(data.date);
        if (data.localIPs) setLocalIPs(data.localIPs);
        if (data.port) setPort(data.port);
        if (data.appUrl) setServerAppUrl(data.appUrl);
        if (data.settings) setSettings(data.settings);

        savePersistedClientState({
          tickets: data.tickets,
          staff: data.staff,
          counters: data.counters,
          counterSessions: data.counterSessions,
          issuancePaused: data.issuancePaused,
          date: data.date,
          settings: data.settings
        });
        return true;
      })
      .catch(() => {
        setConnected(false);
        return false;
      })
      .finally(() => {
        const token = sessionStorage.getItem('agency_admin_token') || localStorage.getItem('agency_admin_token');
        if (token) {
          apiFetch('/api/admin/logs', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-admin-token': token
            }
          })
            .then(logs => {
              if (Array.isArray(logs)) setAuditLogs(logs);
            })
            .catch(() => {});
        }
      });
  }, []);

  // Immediately connect and activate server whenever user navigates tabs, especially to the Home page
  useEffect(() => {
    fetchState();
  }, [currentTab, fetchState]);

  useEffect(() => {
    fetchState();

    // Periodic polling fallback for Vercel/serverless environments where WebSocket is unavailable
    const pollTimer = setInterval(() => {
      fetchState();
    }, 5000);

    // Socket.io real-time connection
    let socket: Socket | null = null;
    try {
      socket = io();

      socket.on('connect', () => {
        setConnected(true);
      });

      socket.on('disconnect', () => {
        setConnected(false);
      });

      socket.on('state_update', (state) => {
        if (state.tickets && Array.isArray(state.tickets)) setTickets(state.tickets);
        if (state.staff && Array.isArray(state.staff)) {
          setStaffList(state.staff);
          try { localStorage.setItem('agency_staff_backup', JSON.stringify(state.staff)); } catch {}
        }
        if (state.counters && Array.isArray(state.counters)) setCounters(state.counters);
        if (state.counterSessions) setCounterSessions(state.counterSessions);
        if (typeof state.issuancePaused === 'boolean') setIssuancePaused(state.issuancePaused);
        if (state.date) setDate(state.date);
        if (state.settings) setSettings(state.settings);

        savePersistedClientState({
          tickets: state.tickets,
          staff: state.staff,
          counters: state.counters,
          counterSessions: state.counterSessions,
          issuancePaused: state.issuancePaused,
          date: state.date,
          settings: state.settings
        });
      });

      socket.on('ticket_called', (callData) => {
        setLastCalledTicket({
          ...callData,
          timestamp: callData.timestamp || new Date().toISOString()
        });
      });

      socket.on('audit_log_added', (newLog: AuditLog) => {
        setAuditLogs(prev => [newLog, ...prev.slice(0, 1999)]);
      });
    } catch (e) {
      console.log('Socket.io connection not established, using polling fallback');
      setConnected(true);
    }

    return () => {
      clearInterval(pollTimer);
      if (socket) {
        socket.disconnect();
      }
    };
  }, [fetchState]);

  // Client Ticket Actions (With full offline-first fallback)
  const handleIssueTicket = async (category: string): Promise<Ticket | null> => {
    try {
      const data = await apiFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      return data;
    } catch {
      // Offline fallback: generate ticket locally and persist in local client state
      const catConfig = settings.categories?.find(c => c.id === category) || { prefix: 'A', name: 'توثيق وكالة' };
      const currentCatTickets = tickets.filter(t => t.category === category);
      const nextSeq = currentCatTickets.length + 1;
      const displayNumber = `${catConfig.prefix || 'A'}-${String(nextSeq).padStart(3, '0')}`;
      const localTicket: Ticket = {
        id: `ticket-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        categoryNameArabic: catConfig.name || 'معاملة وكالة',
        number: nextSeq,
        displayNumber,
        status: 'waiting',
        createdAt: new Date().toISOString()
      };
      setTickets(prev => {
        const updated = [...prev, localTicket];
        savePersistedClientState({ tickets: updated });
        return updated;
      });
      return localTicket;
    }
  };

  const handleCallNext = async (staffId: string, counterId: string) => {
    try {
      return await apiFetch('/api/staff/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, counterId })
      });
    } catch {
      // Offline fallback: find next waiting ticket and call it locally
      const counter = counters.find(c => c.id === counterId);
      const staff = staffList.find(s => s.id === staffId);
      const nextTicket = tickets.find(t => t.status === 'waiting' && (!counter?.assignedServiceId || t.category === counter.assignedServiceId))
        || tickets.find(t => t.status === 'waiting');
      
      if (!nextTicket) {
        throw new Error('لا توجد تذاكر انتظار حالياً في الطابور.');
      }

      const updatedTicket: Ticket = {
        ...nextTicket,
        status: 'serving',
        counterId,
        counterName: counter?.name || 'شباك',
        staffId,
        staffName: staff?.name || 'موظف',
        calledAt: new Date().toISOString()
      };

      setTickets(prev => {
        const updated = prev.map(t => t.id === updatedTicket.id ? updatedTicket : t);
        savePersistedClientState({ tickets: updated });
        return updated;
      });

      setLastCalledTicket({
        ticket: updatedTicket,
        counter: counter?.name || 'شباك',
        timestamp: new Date().toISOString()
      });

      return { success: true, ticket: updatedTicket };
    }
  };

  const handleRecall = async (ticketId: string, staffId: string) => {
    try {
      return await apiFetch('/api/staff/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, staffId })
      });
    } catch {
      const ticket = tickets.find(t => t.id === ticketId);
      const counter = counters.find(c => c.id === ticket?.counterId);
      if (ticket) {
        setLastCalledTicket({
          ticket,
          counter: counter?.name || ticket.counterName || 'شباك',
          isRecall: true,
          timestamp: new Date().toISOString()
        });
      }
      return { success: true };
    }
  };

  const handleComplete = async (ticketId: string, staffId: string) => {
    try {
      return await apiFetch('/api/staff/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, staffId })
      });
    } catch {
      setTickets(prev => {
        const updated = prev.map(t => t.id === ticketId ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() } : t);
        savePersistedClientState({ tickets: updated });
        return updated;
      });
      return { success: true };
    }
  };

  const handleSkip = async (ticketId: string, notes: string) => {
    try {
      return await apiFetch('/api/staff/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, notes })
      });
    } catch {
      setTickets(prev => {
        const updated = prev.map(t => t.id === ticketId ? { ...t, status: 'skipped' as const, notes } : t);
        savePersistedClientState({ tickets: updated });
        return updated;
      });
      return { success: true };
    }
  };

  const handleReturnQueue = async (ticketId: string) => {
    try {
      return await apiFetch('/api/staff/return-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
    } catch {
      setTickets(prev => {
        const updated = prev.map(t => t.id === ticketId ? { ...t, status: 'waiting' as const, counterId: undefined, counterName: undefined, staffId: undefined, staffName: undefined } : t);
        savePersistedClientState({ tickets: updated });
        return updated;
      });
      return { success: true };
    }
  };

  if (!auth) {
    return <LoginHome onLoginSuccess={handleLoginSuccess} staffList={staffList} counters={counters} />;
  }

  const waitingCount = tickets.filter(t => t.status === 'waiting').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Cairo',sans-serif] flex flex-col">
      {/* إخفاء الهيدر العلوي تماماً في صفحة شاشة عرض الدور للصالات */}
      {currentTab !== 'display' && (
        <Navbar
          currentTab={currentTab}
          setCurrentTab={handleNavigate}
          connected={connected}
          localIPs={localIPs}
          port={port}
          serverAppUrl={serverAppUrl}
          waitingCount={waitingCount}
          departmentTitle={settings.departmentTitle}
          onReconnect={fetchState}
          authName={auth?.name}
          authRole={auth?.role}
          onLogout={handleLogout}
        />
      )}

      <main className="flex-1">
        {currentTab === 'home' && (
          <NetworkGuide
            localIPs={localIPs}
            port={port}
            serverAppUrl={serverAppUrl}
            onNavigate={handleNavigate}
            connected={connected}
            onActivateServer={fetchState}
            tickets={tickets}
            counters={counters}
            staffList={staffList}
          />
        )}

        {currentTab === 'kiosk' && (
          <Kiosk
            issuancePaused={issuancePaused}
            onIssueTicket={handleIssueTicket}
            waitingCount={waitingCount}
            categories={settings.categories}
            departmentTitle={settings.departmentTitle}
            counters={counters}
            onRefreshState={fetchState}
          />
        )}

        {currentTab === 'display' && (
          <MainDisplay
            tickets={tickets}
            counters={counters}
            settings={settings}
            lastCalledTicket={lastCalledTicket}
            onNavigateHome={() => handleNavigate('home')}
          />
        )}

        {currentTab === 'staff' && (
          <StaffPortal
            staffList={staffList}
            counters={counters}
            tickets={tickets}
            categories={settings.categories}
            onCallNext={handleCallNext}
            onRecall={handleRecall}
            onComplete={handleComplete}
            onSkip={handleSkip}
            onReturnQueue={handleReturnQueue}
            onNavigateHome={() => handleNavigate('home')}
            departmentTitle={settings.departmentTitle}
          />
        )}

        {currentTab === 'admin' && (
          <AdminDashboard
            staffList={staffList}
            counters={counters}
            tickets={tickets}
            counterSessions={counterSessions}
            issuancePaused={issuancePaused}
            date={date}
            settings={settings}
            auditLogs={auditLogs}
            localIPs={localIPs}
            port={port}
            serverAppUrl={serverAppUrl}
            onRefreshState={fetchState}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        )}

        {currentTab === 'hq' && (
          <div className="p-4 sm:p-6 lg:p-8 bg-slate-950 min-h-screen">
            <CentralHQDashboard 
              adminToken={sessionStorage.getItem('agency_admin_token') || localStorage.getItem('agency_admin_token') || undefined}
              onRefreshState={fetchState} 
            />
          </div>
        )}
      </main>
    </div>
  );
}
