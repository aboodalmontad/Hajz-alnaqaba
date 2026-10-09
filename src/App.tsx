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
    { id: 'general', prefix: 'A', name: 'وكالات عامة', desc: 'تنظيم الوكالات العامة وسحب النسخ المعتمدة' },
    { id: 'special', prefix: 'B', name: 'وكالات خاصة', desc: 'وكالات البيع، الفراغ، الإدارة، والتصرف' },
    { id: 'attestation', prefix: 'C', name: 'تصديق العقود', desc: 'تصديق وتثبيت العقود والاتفاقيات القانونية' },
    { id: 'inquiry', prefix: 'D', name: 'الاستعلامات والدعم', desc: 'الاستعلام عن الأوراق المطلوبة والرسوم النقابية' }
  ]
};

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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [issuancePaused, setIssuancePaused] = useState(false);
  const [date, setDate] = useState('');
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [localIPs, setLocalIPs] = useState<string[]>(['127.0.0.1']);
  const [port, setPort] = useState<number>(3000);
  const [serverAppUrl, setServerAppUrl] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [counterSessions, setCounterSessions] = useState<CounterSession[]>([]);
  const [lastCalledTicket, setLastCalledTicket] = useState<{ ticket: Ticket; counter: string; isRecall?: boolean } | null>(null);

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
    apiFetch('/api/state')
      .then(data => {
        if (data.tickets) setTickets(data.tickets);
        if (data.staff) setStaffList(data.staff);
        if (data.counters) setCounters(data.counters);
        if (data.counterSessions) setCounterSessions(data.counterSessions);
        if (typeof data.issuancePaused === 'boolean') setIssuancePaused(data.issuancePaused);
        if (data.date) setDate(data.date);
        if (data.localIPs) setLocalIPs(data.localIPs);
        if (data.port) setPort(data.port);
        if (data.appUrl) setServerAppUrl(data.appUrl);
        if (data.settings) setSettings(data.settings);
      })
      .catch(err => console.error('Failed to fetch initial state:', err));

    const token = sessionStorage.getItem('agency_admin_token');
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
  }, []);

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
        if (state.tickets) setTickets(state.tickets);
        if (state.staff) setStaffList(state.staff);
        if (state.counters) setCounters(state.counters);
        if (state.counterSessions) setCounterSessions(state.counterSessions);
        if (typeof state.issuancePaused === 'boolean') setIssuancePaused(state.issuancePaused);
        if (state.date) setDate(state.date);
        if (state.settings) setSettings(state.settings);
      });

      socket.on('ticket_called', (callData) => {
        setLastCalledTicket(callData);
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

      <main className="flex-1">
        {currentTab === 'home' && (
          <NetworkGuide
            localIPs={localIPs}
            port={port}
            serverAppUrl={serverAppUrl}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'kiosk' && (
          <Kiosk
            issuancePaused={issuancePaused}
            onIssueTicket={handleIssueTicket}
            waitingCount={waitingCount}
            categories={settings.categories}
            departmentTitle={settings.departmentTitle}
          />
        )}

        {currentTab === 'display' && (
          <MainDisplay
            tickets={tickets}
            counters={counters}
            settings={settings}
            lastCalledTicket={lastCalledTicket}
          />
        )}

        {currentTab === 'staff' && (
          <StaffPortal
            staffList={staffList}
            counters={counters}
            tickets={tickets}
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
          />
        )}
      </main>
    </div>
  );
}
