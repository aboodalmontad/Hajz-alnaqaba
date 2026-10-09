import { supabase } from './supabase';
import { Ticket, Staff, Counter, SystemSettings, AuditLog, CounterSession } from '../types';

export const supabaseService = {
  // Fetch entire state from Supabase
  async getState() {
    try {
      const [ticketsRes, staffRes, countersRes, settingsRes, logsRes, sessionsRes] = await Promise.all([
        supabase.from('tickets').select('*').order('created_at', { ascending: false }),
        supabase.from('staff').select('*'),
        supabase.from('counters').select('*'),
        supabase.from('system_settings').select('*').eq('id', 1).single(),
        supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200),
        supabase.from('counter_sessions').select('*').order('started_at', { ascending: false })
      ]);

      const tickets: Ticket[] = (ticketsRes.data || []).map((t: any) => ({
        id: t.id,
        number: t.number,
        displayNumber: t.display_number,
        category: t.category,
        categoryNameArabic: t.category_name_arabic,
        status: t.status,
        createdAt: t.created_at,
        calledAt: t.called_at,
        documentingStartedAt: t.documenting_started_at,
        completedAt: t.completed_at,
        counterId: t.counter_id,
        counterName: t.counter_name,
        staffId: t.staff_id,
        staffName: t.staff_name,
        notes: t.notes
      }));

      const staff: Staff[] = (staffRes.data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        pin: s.pin,
        counterId: s.counter_id || '',
        active: s.active,
        role: s.role,
        allowedCounterIds: s.allowed_counter_ids || []
      }));

      const counters: Counter[] = (countersRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        isOpen: c.is_open,
        isPaused: c.is_paused,
        currentStaffId: c.current_staff_id,
        currentStaffName: c.current_staff_name,
        claimedAt: c.claimed_at
      }));

      const settingsData = settingsRes.data;
      const settings: SystemSettings = settingsData ? {
        departmentTitle: settingsData.department_title,
        departmentSubtitle: settingsData.department_subtitle,
        tickerMessage: settingsData.ticker_message,
        soundAlertsEnabled: settingsData.sound_alerts_enabled,
        workingHoursStart: settingsData.working_hours_start,
        workingHoursEnd: settingsData.working_hours_end,
        ticketSequence: settingsData.ticket_sequence,
        categories: settingsData.categories || []
      } : {
        departmentTitle: 'دائرة الوكالات – نقابة المحامين بحلب',
        departmentSubtitle: 'شاشة عرض أدواري المراجعين في صالة الانتظار',
        tickerMessage: 'يرجى الانتباه إلى أرقام الدور وظهورها على شاشة الشبابيك.',
        soundAlertsEnabled: true,
        workingHoursStart: '08:30',
        workingHoursEnd: '15:00',
        ticketSequence: 0,
        categories: []
      };

      const auditLogs: AuditLog[] = (logsRes.data || []).map((l: any) => ({
        id: l.id,
        timestamp: l.timestamp,
        action: l.action,
        details: l.details,
        user: l.user_name,
        category: l.category
      }));

      const counterSessions: CounterSession[] = (sessionsRes.data || []).map((cs: any) => ({
        id: cs.id,
        staffId: cs.staff_id,
        staffName: cs.staff_name,
        counterId: cs.counter_id,
        counterName: cs.counter_name,
        startedAt: cs.started_at,
        endedAt: cs.ended_at
      }));

      return {
        tickets,
        staff,
        counters,
        settings,
        auditLogs,
        counterSessions,
        issuancePaused: false,
        date: new Date().toISOString().split('T')[0]
      };
    } catch (err) {
      console.error('Error fetching state from Supabase:', err);
      throw err;
    }
  },

  // Subscribe to real-time changes
  subscribeToChanges(onUpdate: () => void) {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        onUpdate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // Issue a new ticket
  async issueTicket(category: string, categoryNameArabic: string, prefix: string) {
    // Get current sequence & settings
    const { data: settingsData } = await supabase.from('system_settings').select('ticket_sequence').eq('id', 1).single();
    const nextSeq = (settingsData?.ticket_sequence || 0) + 1;
    const displayNumber = `${prefix}-${String(nextSeq).padStart(3, '0')}`;

    await supabase.from('system_settings').update({ ticket_sequence: nextSeq }).eq('id', 1);

    const newTicket = {
      id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      number: nextSeq,
      display_number: displayNumber,
      category,
      category_name_arabic: categoryNameArabic,
      status: 'waiting',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('tickets').insert([newTicket]).select().single();
    if (error) throw error;
    return data;
  }
};
