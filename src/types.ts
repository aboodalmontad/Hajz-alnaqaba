/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Ticket {
  id: string;
  number: number;
  displayNumber: string; // e.g. "A-001"
  category: string; // 'general' | 'special' | 'attestation' | 'inquiry'
  categoryNameArabic: string;
  status: 'waiting' | 'serving' | 'completed' | 'skipped' | 'cancelled';
  createdAt: string;
  calledAt?: string;
  documentingStartedAt?: string;
  completedAt?: string;
  counterId?: string;
  counterName?: string;
  staffId?: string;
  staffName?: string;
  notes?: string;
}

export interface Staff {
  id: string;
  name: string;
  pin: string;
  counterId: string;
  active: boolean;
  role: 'staff' | 'admin';
  jobTitle?: string; // e.g. 'مندوب وكالات' | 'موظف توثيق' | 'موظف شباك' | 'أمين صندوق'
  allowedCounterIds?: string[]; // If undefined or empty, allowed on all counters
}

export interface Counter {
  id: string;
  name: string;
  isOpen: boolean;
  isPaused?: boolean;
  currentStaffId?: string;
  currentStaffName?: string;
  claimedAt?: string;
}

export interface CounterSession {
  id: string;
  staffId: string;
  staffName: string;
  counterId: string;
  counterName: string;
  startedAt: string;
  endedAt?: string;
}

export interface CategoryConfig {
  id: string;
  prefix: string;
  name: string;
  desc: string;
}

export interface SystemSettings {
  departmentTitle: string;
  departmentSubtitle: string;
  tickerMessage: string;
  soundAlertsEnabled: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  ticketSequence: number;
  categories: CategoryConfig[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
  category?: 'ticket' | 'counter' | 'staff' | 'settings' | 'auth' | 'system';
}

export interface AppState {
  tickets: Ticket[];
  staff: Staff[];
  counters: Counter[];
  counterSessions?: CounterSession[];
  issuancePaused: boolean;
  date: string;
  settings: SystemSettings;
}
