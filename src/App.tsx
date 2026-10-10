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
function getInitialTab(): 'home' | 'kiosk' | 'display' | 'staff' | 'admin' {
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
  return 'home';
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'kiosk' | 'display' | 'staff' | 'admin'>(getInitialTab);
  const [connected, setConnected] = useState(false);

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

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentTab(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Safe navigation that updates the address bar URL
  const handleNavigate = useCallback((tab: 'home' | 'kiosk' | 'display' | 'staff' | 'admin') => {
    setCurrentTab(tab);
    let targetPath = '/';
    if (tab === 'staff') targetPath = '/agent';
    else if (tab === 'kiosk') targetPath = '/kiosk';
    else if (tab === 'display') targetPath = '/display';
    else if (tab === 'admin') targetPath = '/admin';

    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  }, []);

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
      .catch(err => {
        console.error('Failed to fetch initial state:', err);
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

  // Client Ticket Actions
  const handleIssueTicket = async (category: string): Promise<Ticket | null> => {
    try {
      const data = await apiFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      return data;
    } catch (err: any) {
      alert(err.message || 'خطأ في إصدار التذكرة');
      return null;
    }
  };

  const handleCallNext = async (staffId: string, counterId: string) => {
    return await apiFetch('/api/staff/call-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, counterId })
    });
  };

  const handleRecall = async (ticketId: string, staffId: string) => {
    return await apiFetch('/api/staff/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, staffId })
    });
  };

  const handleComplete = async (ticketId: string, staffId: string) => {
    return await apiFetch('/api/staff/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, staffId })
    });
  };

  const handleSkip = async (ticketId: string, notes: string) => {
    return await apiFetch('/api/staff/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, notes })
    });
  };

  const handleReturnQueue = async (ticketId: string) => {
    return await apiFetch('/api/staff/return-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId })
    });
  };

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
          />
        )}
      </main>
    </div>
  );
}
