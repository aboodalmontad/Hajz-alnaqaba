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
  name: string;
  pin: string;
  counterId: string;
  active: boolean;
  role: 'staff' | 'admin';
  jobTitle?: string; // e.g. 'مندوب وكالات' | 'موظف توثيق' | 'موظف شباك' | 'أمين صندوق'
  allowedCounterIds?: string[]; // If undefined or empty, allowed on all counters
  registeredAgenciesCount?: number;
  completedAgenciesCount?: number;
  pendingAgenciesCount?: number;
  ticketsHandledCount?: number;
  lastActive?: string;
}

export interface Counter {
  id: string;
  name: string;
  isOpen: boolean;
  isPaused?: boolean;
  currentStaffId?: string;
  currentStaffName?: string;
  claimedAt?: string;
  assignedServiceId?: string;
  assignedServiceName?: string;
  ticketsCalledCount?: number;
  ticketsCompletedCount?: number;
  avgWaitTimeSeconds?: number;
  avgServiceTimeSeconds?: number;
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
  active?: boolean;
  assignedCounterId?: string;
  assignedCounterName?: string;
  avgServiceTimeSeconds?: number;
  ticketsCount?: number;
  completedCount?: number;
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

export interface Branch {
  id: string;
  name: string;
  code: string;
  city?: string;
  address?: string;
  phone?: string;
  isHeadquarters?: boolean;
  isActive?: boolean;
  notes?: string;
  lastSyncAt?: string;
  lastKnownIp?: string;
  todayTicketsCount?: number;
  todayCompletedCount?: number;
  activeStaffCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchManagerUser {
  id: string;
  branchId: string;
  branchName: string;
  fullName: string;
  username: string;
  password?: string;
  active: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManagerHistoryRecord {
  id: string;
  branchId: string;
  managerName: string;
  username?: string;
  appointedAt: string;
  endedAt?: string;
  notes?: string;
  assignedBy?: string;
}

export interface TransactionAttachment {
  id: string;
  branchId?: string;
  transactionId?: string;
  localTicketId?: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  fileSizeBytes?: number;
  filePath?: string;
  storagePath?: string;
  fileBase64?: string;
  fileHashSha256?: string;
  isUploadedToCloud?: boolean;
  uploadedAt?: string;
  createdAt?: string;
}

export interface AgencyTransaction {
  id: string;
  branchId: string;
  agencyNumber: string;
  agencyYear?: string | number;
  agencyType: string;
  principalsNames: string;
  principalsNationalIds?: string;
  nationalId?: string;
  lawyersNames: string;
  notaryDelegateName: string;
  notaryDelegateId?: string;
  receiptNumber?: string;
  feesPaid?: number;
  status: 'pending_review' | 'approved' | 'rejected';
  isRevoked?: boolean;
  revocationDate?: string;
  notes?: string;
  attachments?: TransactionAttachment[];
  hasAttachments?: boolean;
  ticketId?: string;
  localTicketId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BranchComprehensiveDetails {
  branch: Branch;
  manager?: BranchManagerUser | null;
  managerHistory?: ManagerHistoryRecord[];
  staff: Staff[];
  counters: Counter[];
  services: CategoryConfig[];
  auditLogs: AuditLog[];
  agencies: AgencyTransaction[];
  tickets: Ticket[];
  syncStatus?: any;
}

export interface SyncQueueItem {
  id: string | number;
  branchId: string;
  entityType: 'ticket' | 'counter_session' | 'agency_transaction' | 'audit_log' | 'branch_setting' | 'agency' | 'attachment';
  localId?: string;
  entityLocalId?: string;
  operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  payload?: any;
  retryCount?: number;
  createdAt?: string;
  lastError?: string;
  errorMessage?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  syncedAt?: string;
}

export interface SyncHistoryLog {
  id: string | number;
  branchId: string;
  timestamp: string;
  recordsSynced?: number;
  recordsPushed?: number;
  filesUploaded?: number;
  direction?: 'UP' | 'DOWN';
  syncDirection?: string;
  branchName?: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'success' | 'failed' | 'partial';
  details?: string;
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
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'failed';
  lastSyncMessage?: string;
  lastSyncTime?: string;
  lastSyncTimestamp?: string;
  isKeyConfigured?: boolean;
  isKeyFromEnv?: boolean;
  isUrlFromEnv?: boolean;
  pendingCount?: number;
}
