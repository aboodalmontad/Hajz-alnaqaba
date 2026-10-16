/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Ticket {
  id: string;
  branchId?: string;
  number: number;
  displayNumber: string; // e.g. "A-001"
  category: string; // 'general' | 'special' | 'attestation' | 'inquiry'
  categoryNameArabic: string;
  status: 'waiting' | 'serving' | 'completed' | 'skipped' | 'cancelled';
  createdAt: string;
  calledAt?: string;
  recallCount?: number;
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
  branchId?: string;
  name: string;
  pin: string;
  counterId: string;
  active: boolean;
  role: 'staff' | 'admin';
  jobTitle?: string; // e.g. 'مندوب وكالات' | 'موظف توثيق' | 'موظف شباك' | 'أمين صندوق'
  allowedCounterIds?: string[]; // If undefined or empty, allowed on all counters
  createdAt?: string;
}

export interface Counter {
  id: string;
  branchId?: string;
  name: string;
  isOpen: boolean;
  isPaused?: boolean;
  currentStaffId?: string;
  currentStaffName?: string;
  claimedAt?: string;
  assignedServiceId?: string;
  assignedServiceName?: string;
}

export interface CounterSession {
  id: string;
  branchId?: string;
  staffId: string;
  staffName: string;
  counterId: string;
  counterName: string;
  startedAt: string;
  endedAt?: string;
}

export interface CategoryConfig {
  id: string;
  branchId?: string;
  prefix: string;
  name: string;
  desc: string;
  active?: boolean;
  assignedCounterId?: string;
  assignedCounterName?: string;
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
  syncSettings?: SyncSettings;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string;
  address?: string;
  phone?: string;
  isHeadquarters: boolean;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  lastSyncAt?: string;
  lastKnownIp?: string;
  todayTicketsCount?: number;
  todayCompletedCount?: number;
  activeStaffCount?: number;
  totalAgenciesCount?: number;
}

export interface ManagerHistoryRecord {
  id: string;
  branchId: string;
  managerId: string;
  managerName: string;
  appointedAt: string;
  endedAt?: string;
  notes?: string;
  assignedBy: string;
}

export interface BranchComprehensiveDetails {
  branch: Branch;
  manager: BranchManagerUser | null;
  managerHistory: ManagerHistoryRecord[];
  staff: (Staff & {
    registeredAgenciesCount?: number;
    completedAgenciesCount?: number;
    pendingAgenciesCount?: number;
    ticketsHandledCount?: number;
    lastActive?: string;
  })[];
  counters: (Counter & {
    ticketsCalledCount?: number;
    ticketsCompletedCount?: number;
    avgWaitTimeSeconds?: number;
    avgServiceTimeSeconds?: number;
    remainingTicketsCount?: number;
  })[];
  services: (CategoryConfig & {
    ticketsCount?: number;
    completedCount?: number;
    pendingCount?: number;
    avgServiceTimeSeconds?: number;
  })[];
  tickets: Ticket[];
  agencies: AgencyTransaction[];
  auditLogs: AuditLog[];
  syncStatus: {
    lastSyncAt?: string;
    pendingQueueCount: number;
    isOnline: boolean;
    lastKnownIp?: string;
  };
  metrics: {
    totalAgencies: number;
    completedAgencies: number;
    pendingAgencies: number;
    totalFeesPaid: number;
    totalTickets: number;
    completedTickets: number;
    waitingTickets: number;
    servingTickets: number;
    skippedTickets: number;
    avgWaitTimeSeconds: number;
    avgServiceTimeSeconds: number;
    completionRatePercentage: number;
  };
}

export interface BranchManagerUser {
  id: string;
  branchId: string;
  branchName: string;
  fullName: string;
  username: string;
  password?: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface TransactionAttachment {
  id: string;
  branchId: string;
  transactionId?: string;
  localTicketId?: string;
  fileName: string;
  fileType: string;
  fileSizeBytes?: number;
  fileHashSha256?: string;
  storagePath: string;
  isUploadedToCloud?: boolean;
  uploadedAt?: string;
  createdAt: string;
}

export interface AgencyTransaction {
  id: string;
  branchId: string;
  ticketId?: string;
  localTicketId?: string;
  agencyNumber: string;
  agencyYear?: number;
  agencyType: string;
  principalsNames: string;
  lawyersNames: string;
  nationalId?: string;
  feesPaid?: number;
  receiptNumber?: string;
  notaryDelegateName?: string;
  isRevoked?: boolean;
  revocationDate?: string;
  status: 'approved' | 'pending_review' | 'rejected';
  notes?: string;
  createdAt: string;
  attachments?: TransactionAttachment[];
}

export interface SyncQueueItem {
  id: number | string;
  branchId: string;
  entityType: 'ticket' | 'counter_session' | 'audit_log' | 'agency' | 'attachment';
  entityLocalId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  syncStatus: 'pending' | 'synced' | 'failed';
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  syncedAt?: string;
}

export interface SyncHistoryLog {
  id: number | string;
  branchId: string;
  branchName?: string;
  syncDirection: 'branch_to_cloud' | 'cloud_to_hq';
  recordsPushed: number;
  filesUploaded: number;
  status: 'success' | 'partial' | 'failed';
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface SyncSettings {
  branchId: string;
  branchName: string;
  branchCode: string;
  isHeadquarters: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  syncIntervalMinutes: number;
  autoSyncEnabled: boolean;
  lastSyncTimestamp?: string;
  lastSyncStatus?: 'success' | 'failed' | 'idle';
  lastSyncMessage?: string;
  isKeyConfigured?: boolean;
  isKeyFromEnv?: boolean;
  isUrlFromEnv?: boolean;
}

export interface AuditLog {
  id: string;
  branchId?: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
  category?: 'ticket' | 'counter' | 'staff' | 'settings' | 'auth' | 'system' | 'sync';
}

export interface AppState {
  tickets: Ticket[];
  staff: Staff[];
  counters: Counter[];
  counterSessions?: CounterSession[];
  issuancePaused: boolean;
  date: string;
  settings: SystemSettings;
  syncSettings?: SyncSettings;
  syncQueue?: SyncQueueItem[];
  syncHistory?: SyncHistoryLog[];
  agenciesTransactions?: AgencyTransaction[];
  branches?: Branch[];
}

