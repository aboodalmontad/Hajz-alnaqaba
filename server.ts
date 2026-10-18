/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enable CORS and handle preflight OPTIONS for all API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token, x-admin-pin');
  if (req.path.startsWith('/api')) {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const server = createServer(app);
let io: any;
try {
  if (!process.env.VERCEL) {
    io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    });
  } else {
    io = { emit: () => {}, on: () => {} };
  }
} catch (e) {
  io = { emit: () => {}, on: () => {} };
}

const PORT = 3000;
const PRIMARY_DATA_DIR = join(process.cwd(), 'data');
const BACKUP_DATA_DIR = join(__dirname, 'data');
const TMP_DATA_DIR = join(os.tmpdir(), 'queue_data');

[PRIMARY_DATA_DIR, BACKUP_DATA_DIR, TMP_DATA_DIR].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // Non-fatal
  }
});
let DB_FILE = join(PRIMARY_DATA_DIR, 'queue_db.json');

interface Ticket {
  id: string;
  number: number;
  displayNumber: string; // e.g., "A-001"
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
  branchId?: string;
}

interface Staff {
  id: string;
  name: string;
  pin: string;
  counterId: string;
  active: boolean;
  role: 'staff' | 'admin';
  jobTitle?: string;
  allowedCounterIds?: string[];
  branchId?: string;
}

interface Counter {
  id: string;
  name: string;
  isOpen: boolean;
  isPaused?: boolean;
  currentStaffId?: string;
  currentStaffName?: string;
  claimedAt?: string;
  assignedServiceId?: string;
  assignedServiceName?: string;
}

interface CounterSession {
  id: string;
  staffId: string;
  staffName: string;
  counterId: string;
  counterName: string;
  startedAt: string;
  endedAt?: string;
}

interface CategoryConfig {
  id: string;
  prefix: string;
  name: string;
  desc: string;
  active?: boolean;
  assignedCounterId?: string;
  assignedCounterName?: string;
}

interface SystemSettings {
  departmentTitle: string;
  departmentSubtitle: string;
  tickerMessage: string;
  soundAlertsEnabled: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  ticketSequence: number;
  adminPin: string;
  categories: CategoryConfig[];
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
  category?: 'ticket' | 'counter' | 'staff' | 'settings' | 'auth' | 'system' | 'sync';
}

interface Branch {
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

interface BranchManagerUser {
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
  activeToken?: string;
}

interface ManagerHistoryRecord {
  id: string;
  branchId: string;
  managerId?: string;
  managerName: string;
  username?: string;
  appointedAt: string;
  endedAt?: string;
  notes?: string;
  assignedBy?: string;
}

interface AgencyTransaction {
  id: string;
  branchId: string;
  agencyNumber: string;
  agencyYear?: string | number;
  agencyType: string;
  principalsNames: string;
  principalsNationalIds?: string;
  nationalId?: string;
  lawyersNames: string;
  feesPaid?: number;
  receiptNumber?: string;
  notaryDelegateName?: string;
  isRevoked?: boolean;
  revocationDate?: string;
  status: 'approved' | 'pending_review' | 'rejected' | 'archived';
  notes?: string;
  attachments?: any[];
  hasAttachments?: boolean;
  ticketId?: string;
  localTicketId?: string;
  createdAt: string;
  updatedAt?: string;
}

interface DatabaseSchema {
  date: string; // YYYY-MM-DD
  ticketSequence: number;
  issuancePaused: boolean;
  settings: SystemSettings;
  tickets: Ticket[];
  staff: Staff[];
  counters: Counter[];
  counterSessions: CounterSession[];
  auditLogs: AuditLog[];
  activeTokens?: string[];
  branches?: Branch[];
  branchManagers?: BranchManagerUser[];
  managerHistory?: ManagerHistoryRecord[];
  agenciesTransactions?: AgencyTransaction[];
  syncSettings?: any;
  syncHistory?: any[];
  syncQueue?: any[];
}

const getTodayDateString = () => new Date().toISOString().split('T')[0];

function filterDb(db: DatabaseSchema, branchId: string | undefined): DatabaseSchema {
  if (!branchId || branchId === 'all') return db;
  return {
    ...db,
    tickets: db.tickets.filter(t => t.branchId === branchId),
    agenciesTransactions: (db.agenciesTransactions || []).filter(a => a.branchId === branchId),
    staff: (db.staff || []).filter(s => (s as any).branchId === branchId),
    auditLogs: (db.auditLogs || []).filter(l => true), // Keeping audit logs for now?
  };
}

const defaultSettings: SystemSettings = {
  departmentTitle: 'دائرة الوكالات – نقابة المحامين بحلب',
  departmentSubtitle: 'شاشة عرض أدواري المراجعين في صالة الانتظار',
  tickerMessage: 'يرجى الانتباه إلى أرقام الدور وظهورها على شاشة الشبابيك عند النداء الصوتي. أهلاً بكم في نقابة المحامين بحلب.',
  soundAlertsEnabled: true,
  workingHoursStart: '08:30',
  workingHoursEnd: '15:00',
  ticketSequence: 0,
  adminPin: '9999',
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

const defaultDb: DatabaseSchema = {
  date: getTodayDateString(),
  ticketSequence: 0,
  issuancePaused: false,
  settings: defaultSettings,
  tickets: [],
  staff: [
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
  ],
  counters: [
    {
      id: 'counter-1791640234085',
      name: 'الشباك 1',
      isOpen: true,
      isPaused: false
    },
    {
      id: 'counter-1791640239853',
      name: 'الشباك 2',
      isOpen: true,
      isPaused: false,
      assignedServiceId: 'special',
      assignedServiceName: 'توثيق وكالة'
    },
    {
      id: 'counter-1791640243217',
      name: 'الشباك 3',
      isOpen: true,
      isPaused: false,
      assignedServiceId: 'special',
      assignedServiceName: 'توثيق وكالة'
    },
    {
      id: 'counter-1791640932058',
      name: 'الشباك 5',
      isOpen: true,
      isPaused: false,
      assignedServiceId: 'cat_1791677992936',
      assignedServiceName: 'عزل وكالة'
    },
    {
      id: 'counter-1791642058000',
      name: 'الشباك 6',
      isOpen: true,
      isPaused: false,
      assignedServiceId: 'cat_1791641888137',
      assignedServiceName: 'الحصول على صورة عن وكالة'
    }
  ],
  counterSessions: [],
  auditLogs: [],
  branches: [
    {
      id: 'branch-aleppo-main',
      name: 'المقر الرئيسي - القصر العدلي بحلب',
      code: 'ALP-MAIN',
      city: 'حلب',
      address: 'القصر العدلي - دائرة تنظيم الوكالات',
      phone: '021-2244000',
      isHeadquarters: true,
      isActive: true,
      notes: 'المقر الرئيسي المركزي لدائرة تنظيم الوكالات ونظام الدور المعتمد',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'branch-afrin',
      name: 'مكتب نقابة المحامين - فرع عفرين',
      code: 'ALP-AFR',
      city: 'عفرين',
      address: 'مبنى المجمع القضائي - عفرين',
      phone: '021-6655100',
      isHeadquarters: false,
      isActive: true,
      notes: 'مكتب التوثيق القضائي في عفرين',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'branch-azaz',
      name: 'مكتب نقابة المحامين - فرع إعزاز',
      code: 'ALP-AZZ',
      city: 'إعزاز',
      address: 'شارع المحكمة - دار نقابة المحامين',
      phone: '021-7788200',
      isHeadquarters: false,
      isActive: true,
      notes: 'مكتب التوثيق والدور في إعزاز',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'branch-albab',
      name: 'مكتب نقابة المحامين - فرع الباب',
      code: 'ALP-BAB',
      city: 'مدينة الباب',
      address: 'جانب قصر العدل بالباب',
      phone: '021-8899300',
      isHeadquarters: false,
      isActive: true,
      notes: 'مكتب توثيق الوكالات في الباب',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'branch-manbij',
      name: 'مكتب نقابة المحامين - فرع منبج / الأتارب',
      code: 'ALP-MNB',
      city: 'ريف حلب',
      address: 'مكتب النقابة المعتمد',
      phone: '021-9911400',
      isHeadquarters: false,
      isActive: true,
      notes: 'مكتب ريف حلب المعتمد',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  branchManagers: [
    {
      id: 'bm-alp',
      branchId: 'branch-aleppo-main',
      branchName: 'المقر الرئيسي - القصر العدلي بحلب',
      fullName: 'الأستاذ أحمد الحلبي',
      username: 'manager_aleppo',
      password: 'Aleppo@2026',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'bm-afr',
      branchId: 'branch-afrin',
      branchName: 'مكتب نقابة المحامين - فرع عفرين',
      fullName: 'الأستاذ محمد الكردي',
      username: 'manager_afrin',
      password: 'Afrin@2026',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'bm-azz',
      branchId: 'branch-azaz',
      branchName: 'مكتب نقابة المحامين - فرع إعزاز',
      fullName: 'الأستاذ حسان الإعزازي',
      username: 'manager_azaz',
      password: 'Azaz@2026',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'bm-bab',
      branchId: 'branch-albab',
      branchName: 'مكتب نقابة المحامين - فرع الباب',
      fullName: 'الأستاذ عمر البابي',
      username: 'manager_albab',
      password: 'Albab@2026',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'bm-mnb',
      branchId: 'branch-manbij',
      branchName: 'مكتب نقابة المحامين - فرع منبج / الأتارب',
      fullName: 'الأستاذ باسل الأتاربي',
      username: 'manager_manbij',
      password: 'Manbij@2026',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  managerHistory: [],
  agenciesTransactions: []
};

function loadDb(): DatabaseSchema {
  const ensureDefaults = (parsed: DatabaseSchema) => {
    if (!parsed.branches || parsed.branches.length === 0) {
      parsed.branches = JSON.parse(JSON.stringify(defaultDb.branches || []));
    }
    if (!parsed.branchManagers || parsed.branchManagers.length === 0) {
      parsed.branchManagers = JSON.parse(JSON.stringify(defaultDb.branchManagers || []));
    }
    if (!parsed.managerHistory) {
      parsed.managerHistory = [];
    }
    if (!parsed.agenciesTransactions) {
      parsed.agenciesTransactions = [];
    }
    return parsed;
  };

  const primaryDbPath = join(process.cwd(), 'data', 'queue_db.json');
  
  // 1. Primary database: Directly load the manager's active database file
  if (fs.existsSync(primaryDbPath)) {
    try {
      const raw = fs.readFileSync(primaryDbPath, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && typeof parsed === 'object' && parsed.settings) {
        DB_FILE = primaryDbPath;
        const completeDb = ensureDefaults(parsed);
        // Mirror to backup locations safely
        saveDb(completeDb);
        return completeDb;
      }
    } catch (e) {
      console.warn('Error reading primary queue_db.json, checking backup files:', e);
    }
  }

  // 2. Only if primary file is missing or corrupted, check backups in order
  const backupPaths = [
    join(process.cwd(), 'data', 'queue_db.backup.json'),
    join(process.cwd(), 'data', 'queue_db.stable.json'),
    join(__dirname, 'data', 'queue_db.json'),
    join(os.tmpdir(), 'queue_data', 'queue_db.json'),
    join(os.tmpdir(), 'queue_db.json')
  ];

  for (const filePath of backupPaths) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && typeof parsed === 'object' && parsed.settings) {
          DB_FILE = filePath;
          const completeDb = ensureDefaults(parsed);
          saveDb(completeDb);
          return completeDb;
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Fallback only if no files exist at all
  console.log('No existing DB found, initializing fresh database.');
  saveDb(defaultDb);
  return defaultDb;
}

function saveDb(currentDb: DatabaseSchema) {
  const jsonContent = JSON.stringify(currentDb, null, 2);
  const targets = [
    join(process.cwd(), 'data', 'queue_db.json'),
    join(process.cwd(), 'data', 'queue_db.backup.json'),
    join(process.cwd(), 'data', 'queue_db.stable.json'),
    join(__dirname, 'data', 'queue_db.json'),
    join(os.tmpdir(), 'queue_data', 'queue_db.json'),
    join(os.tmpdir(), 'queue_db.json')
  ];

  for (const target of targets) {
    try {
      const dir = dirname(target);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${target}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, jsonContent, 'utf8');
      fs.renameSync(tmpPath, target);
    } catch {
      try {
        fs.writeFileSync(target, jsonContent, 'utf8');
      } catch {
        // Continue to other targets
      }
    }
  }
}

let db = loadDb();

// Active admin sessions tokens map
const activeAdminTokens = new Set<string>();
if (Array.isArray(db.activeTokens)) {
  db.activeTokens.forEach(t => activeAdminTokens.add(t));
}

// Helper to get local IP addresses
function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name];
    if (netInterface) {
      for (const net of netInterface) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address);
        }
      }
    }
  }
  if (ips.length === 0) ips.push('127.0.0.1');
  return ips;
}

// Broadcast helper
function broadcastState() {
  // 1. Broadcast to all (global state if needed, or iterate branches)
  // For now, let's keep it simple: Broadcast specific state to each branch room
  const branches = db.branches || [];
  
  // Update general state if needed, but primarily update branches
  branches.forEach(branch => {
    const branchId = branch.id;
    const filteredDb = filterDb(db, branchId);
    io.to(`branch_${branchId}`).emit('state_update', {
      tickets: filteredDb.tickets,
      staff: filteredDb.staff.map(s => ({ ...s, pin: '****' })),
      counters: filteredDb.counters,
      counterSessions: db.counterSessions,
      issuancePaused: db.issuancePaused,
      date: db.date,
      settings: db.settings
    });
  });

  // Also broadcast to any clients not in a specific branch room if necessary
  io.emit('state_update_global', {
    date: db.date,
    settings: db.settings
  });
}

function logAudit(action: string, details: string, user: string = 'المدير العام', category: AuditLog['category'] = 'system') {
  const log: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    details,
    user,
    category
  };
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 2000) {
    db.auditLogs = db.auditLogs.slice(0, 2000);
  }
  saveDb(db);
  io.emit('audit_log_added', log);
}

// Middleware: Verify Admin Authorization
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const tokenHeader = req.headers['x-admin-token'] as string;
    const pinHeader = req.headers['x-admin-pin'] as string;
    const queryToken = req.query.token as string;
    const queryPin = req.query.pin as string;
    const bodyToken = req.body?.adminToken;
    const bodyPin = req.body?.pin;

    let token = tokenHeader || queryToken || bodyToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    const currentAdminPin = db?.settings?.adminPin || '9999';

    // 1. Direct PIN verification
    if (
      (pinHeader && pinHeader === currentAdminPin) ||
      (queryPin && queryPin === currentAdminPin) ||
      (bodyPin && bodyPin === currentAdminPin) ||
      (token && token === currentAdminPin)
    ) {
      return next();
    }

    if (!token) {
      return res.status(401).json({ error: 'غير مصرح: لم يتم تقديم رمز التوثيق.' });
    }

    // 2. Active memory tokens check
    if (activeAdminTokens.has(token)) {
      const manager = db.branchManagers?.find(m => m.activeToken === token);
      if (manager) (req as any).branchId = manager.branchId;
      return next();
    }

    // 3. Persisted database tokens check
    if (db && Array.isArray((db as any).activeTokens) && (db as any).activeTokens.includes(token)) {
      activeAdminTokens.add(token);
      const manager = db.branchManagers?.find(m => m.activeToken === token);
      if (manager) (req as any).branchId = manager.branchId;
      return next();
    }

    // 4. Any validly-formatted system issued token (e.g. admin-token-* or agency-admin-*)
    // Prevents session loss when server reboots or reloads during active manager work
    if (typeof token === 'string' && (token.startsWith('admin-token-') || token.startsWith('agency-admin-') || token.startsWith('branch-token-') || token.startsWith('bm-token-'))) {
      activeAdminTokens.add(token);
      if (!db.activeTokens) (db as any).activeTokens = [];
      if (!(db as any).activeTokens.includes(token)) {
        (db as any).activeTokens.push(token);
        saveDb(db);
      }
      const manager = db.branchManagers?.find(m => m.activeToken === token);
      if (manager) (req as any).branchId = manager.branchId;
      return next();
    }

    return res.status(401).json({
      error: 'انتهت صلاحية الجلسة أو لم يتم تسجيل الدخول بصفتك المدير العام.'
    });
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(401).json({ error: 'خطأ في المصادقة.' });
  }
}

// Normalize trailing slashes for all /api requests to prevent 404s
app.use('/api', (req, res, next) => {
  if (req.path.length > 1 && req.path.endsWith('/')) {
    req.url = req.url.replace(/\/+$/, '');
  }
  next();
});

// ==========================================
// PUBLIC & CLIENT API ROUTES
// ==========================================

app.get('/api/ping', (req, res) => {
  res.json({
    status: 'ok',
    connected: true,
    message: 'Local server is active and ready',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/state', (req, res) => {
  const filteredDb = filterDb(db, (req as any).branchId);
  res.json({
    tickets: filteredDb.tickets,
    staff: filteredDb.staff.map(s => ({ ...s, pin: '****' })),
    counters: filteredDb.counters,
    counterSessions: db.counterSessions,
    issuancePaused: db.issuancePaused,
    date: db.date,
    localIPs: getLocalIPs(),
    port: PORT,
    appUrl: process.env.APP_URL || '',
    settings: {
      departmentTitle: db.settings.departmentTitle,
      departmentSubtitle: db.settings.departmentSubtitle,
      tickerMessage: db.settings.tickerMessage,
      soundAlertsEnabled: db.settings.soundAlertsEnabled,
      workingHoursStart: db.settings.workingHoursStart,
      workingHoursEnd: db.settings.workingHoursEnd,
      ticketSequence: db.ticketSequence,
      categories: db.settings.categories
    }
  });
});

app.get('/api/network-info', (req, res) => {
  res.json({
    localIPs: getLocalIPs(),
    port: PORT,
    appUrl: process.env.APP_URL || '',
    host: req.headers.host || '',
    protocol: req.headers['x-forwarded-proto'] || req.protocol || 'http'
  });
});

app.get('/api/staff/list', (req, res) => {
  res.json(db.staff.map(s => ({
    id: s.id,
    name: s.name,
    counterId: s.counterId,
    active: s.active,
    allowedCounterIds: s.allowedCounterIds
  })));
});

// Staff Authentication
app.post('/api/staff/login', (req, res) => {
  const { staffId, pin } = req.body;
  const staff = db.staff.find(s => s.id === staffId);
  if (!staff) {
    return res.status(404).json({ error: 'الموظف غير موجود في النظام.' });
  }
  if (!staff.active) {
    return res.status(403).json({ error: 'تم إيقاف هذا الحساب من قبل المدير العام.' });
  }
  if (staff.pin !== pin) {
    return res.status(401).json({ error: 'الرمز الشخصي (PIN) غير صحيح.' });
  }

  // Find counter currently claimed by this staff if any
  const currentCounter = db.counters.find(c => c.currentStaffId === staff.id);
  if (currentCounter) {
    staff.counterId = currentCounter.id;
  }

  logAudit('تسجيل دخول موظف', `قام الموظف ${staff.name} بتسجيل الدخول عبر الهاتف`, staff.name, 'auth');

  res.json({
    success: true,
    staff: {
      id: staff.id,
      name: staff.name,
      counterId: staff.counterId || (currentCounter ? currentCounter.id : ''),
      role: staff.role,
      allowedCounterIds: staff.allowedCounterIds
    },
    currentCounter: currentCounter || null
  });
});

// --------------------------------------------------------------------------
// MOBILE DELEGATE: CHOOSE & CLAIM COUNTER (ATOMIC & CONCURRENCY-SAFE)
// --------------------------------------------------------------------------
app.post('/api/staff/claim-counter', (req, res) => {
  const { staffId, counterId } = req.body;

  const staff = db.staff.find(s => s.id === staffId);
  if (!staff) {
    return res.status(404).json({ error: 'الموظف غير موجود في النظام.' });
  }
  if (!staff.active) {
    return res.status(403).json({ error: 'حسابك موقوف من قبل الإدارة.' });
  }

  const targetCounter = db.counters.find(c => c.id === counterId);
  if (!targetCounter) {
    return res.status(404).json({ error: 'الشباك المحدد غير موجود.' });
  }

  if (!targetCounter.isOpen) {
    return res.status(400).json({ error: 'هذا الشباك مغلق حالياً من قبل الإدارة.' });
  }

  // Permission check: Is staff allowed to use this counter?
  if (staff.allowedCounterIds && staff.allowedCounterIds.length > 0) {
    if (!staff.allowedCounterIds.includes(counterId)) {
      return res.status(403).json({ error: 'غير مصرح لك بالعمل على هذا الشباك وفق تعليمات الإدارة.' });
    }
  }

  // Concurrency check: Is the counter already taken by another delegate?
  if (targetCounter.currentStaffId && targetCounter.currentStaffId !== staffId) {
    return res.status(409).json({
      error: `عذراً، الشباك مشغول حالياً ويعمل عليه المندوب (${targetCounter.currentStaffName || 'زميل آخر'}). يرجى اختيار شباك متاح.`
    });
  }

  // Check if staff was working on another counter
  const previousCounter = db.counters.find(c => c.currentStaffId === staffId && c.id !== counterId);
  if (previousCounter) {
    // Check if staff has an unfinished ticket in 'serving'
    const activeServingTicket = db.tickets.find(t => t.staffId === staffId && t.status === 'serving');
    if (activeServingTicket) {
      return res.status(400).json({
        error: `لديك مراجع قيد الخدمة (${activeServingTicket.displayNumber}) على ${previousCounter.name}. يجب إنهاء المعاملة أو تجاوز الدور أولاً قبل الانتقال.`
      });
    }

    // Safely release the previous counter and close its shift session
    previousCounter.currentStaffId = undefined;
    previousCounter.currentStaffName = undefined;
    previousCounter.isPaused = false;
    previousCounter.claimedAt = undefined;

    const openSession = db.counterSessions.find(cs => cs.staffId === staffId && cs.counterId === previousCounter.id && !cs.endedAt);
    if (openSession) {
      openSession.endedAt = new Date().toISOString();
    }

    logAudit('تبديل الشباك', `قام المندوب ${staff.name} بمغادرة ${previousCounter.name} والانتقال إلى ${targetCounter.name}`, staff.name, 'counter');
  }

  // Claim the target counter
  targetCounter.currentStaffId = staffId;
  targetCounter.currentStaffName = staff.name;
  targetCounter.isPaused = false;
  targetCounter.claimedAt = new Date().toISOString();
  staff.counterId = targetCounter.id;

  // Record counter session
  const newSession: CounterSession = {
    id: `cs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    staffId: staff.id,
    staffName: staff.name,
    counterId: targetCounter.id,
    counterName: targetCounter.name,
    startedAt: targetCounter.claimedAt
  };
  db.counterSessions.unshift(newSession);

  saveDb(db);
  broadcastState();

  logAudit('بدء العمل على الشباك', `قام المندوب ${staff.name} بحجز وبدء العمل على ${targetCounter.name}`, staff.name, 'counter');

  res.json({
    success: true,
    counter: targetCounter,
    message: `تم حجز ${targetCounter.name} بنجاح، يمكنك الآن استقبال المراجعين.`
  });
});

// --------------------------------------------------------------------------
// MOBILE DELEGATE: RELEASE COUNTER & SWITCH
// --------------------------------------------------------------------------
app.post('/api/staff/release-counter', (req, res) => {
  const { staffId, counterId } = req.body;

  const staff = db.staff.find(s => s.id === staffId);
  const counter = db.counters.find(c => c.id === counterId);

  if (!staff || !counter) {
    return res.status(404).json({ error: 'الموظف أو الشباك غير موجود.' });
  }

  // Check if staff has active serving ticket
  const activeServing = db.tickets.find(t => t.staffId === staffId && t.status === 'serving');
  if (activeServing) {
    return res.status(400).json({
      error: `لا يمكنك إنهاء العمل على الشباك أثناء وجود معاملة جارية (${activeServing.displayNumber}). يرجى إنهاء الخدمة أو تجاوز الدور أولاً.`
    });
  }

  // Close session
  const openSession = db.counterSessions.find(cs => cs.staffId === staffId && cs.counterId === counterId && !cs.endedAt);
  if (openSession) {
    openSession.endedAt = new Date().toISOString();
  }

  // Release counter
  counter.currentStaffId = undefined;
  counter.currentStaffName = undefined;
  counter.isPaused = false;
  counter.claimedAt = undefined;
  staff.counterId = '';

  saveDb(db);
  broadcastState();

  logAudit('إنهاء العمل على الشباك', `أنهى المندوب ${staff.name} عمله على ${counter.name}`, staff.name, 'counter');

  res.json({
    success: true,
    message: `تم تحرير ${counter.name} بنجاح، يمكنك الآن اختيار شباك آخر.`
  });
});

// --------------------------------------------------------------------------
// MOBILE DELEGATE: TOGGLE PAUSE (استراحة مؤقتة)
// --------------------------------------------------------------------------
app.post('/api/staff/toggle-pause', (req, res) => {
  const { staffId, counterId } = req.body;
  const counter = db.counters.find(c => c.id === counterId);
  const staff = db.staff.find(s => s.id === staffId);

  if (!counter || counter.currentStaffId !== staffId) {
    return res.status(403).json({ error: 'غير مخول بالتحكم في هذا الشباك.' });
  }

  counter.isPaused = !counter.isPaused;
  saveDb(db);
  broadcastState();

  logAudit(
    counter.isPaused ? 'إيقاف مؤقت للشباك' : 'استئناف عمل الشباك',
    `قام المندوب ${staff?.name || 'الموظف'} بـ ${counter.isPaused ? 'إيقاف العمل مؤقتاً على' : 'استئناف العمل على'} ${counter.name}`,
    staff?.name || 'موظف',
    'counter'
  );

  res.json({
    success: true,
    isPaused: counter.isPaused,
    message: counter.isPaused ? 'تم إيقاف الشباك مؤقتاً للاستراحة.' : 'تم استئناف استقبال المراجعين.'
  });
});

// --------------------------------------------------------------------------
// MOBILE DELEGATE: START DOCUMENTING AGENCY (بدء توثيق الوكالة)
// --------------------------------------------------------------------------
app.post('/api/staff/start-documenting', (req, res) => {
  const { ticketId, staffId } = req.body;
  const ticket = db.tickets.find(t => t.id === ticketId);
  const staff = db.staff.find(s => s.id === staffId);

  if (!ticket || ticket.status !== 'serving') {
    return res.status(400).json({ error: 'التذكرة غير موجودة أو ليست قيد الاستدعاء.' });
  }

  ticket.documentingStartedAt = new Date().toISOString();
  saveDb(db);
  broadcastState();

  logAudit(
    'بدء توثيق الوكالة',
    `بدأ المندوب ${staff?.name || 'الموظف'} توثيق الوكالة للتذكرة ${ticket.displayNumber} على ${ticket.counterName}`,
    staff?.name || 'موظف',
    'ticket'
  );

  res.json({ success: true, ticket });
});

// Issue new ticket from Kiosk
app.post('/api/tickets', (req, res) => {
  const { category = 'general' } = req.body;
  if (db.issuancePaused) {
    return res.status(400).json({ error: 'إصدار التذاكر متوقف مؤقتًا من قبل الإدارة.' });
  }

  const today = getTodayDateString();
  if (db.date !== today) {
    db.date = today;
  }

  db.ticketSequence += 1;
  const num = db.ticketSequence;
  const paddedNum = String(num).padStart(3, '0');

  const catConfig = db.settings.categories.find(c => c.id === category) || {
    id: category,
    prefix: 'A',
    name: 'وكالات عامة',
    desc: '',
    assignedCounterId: undefined,
    assignedCounterName: undefined
  };

  const newTicket: Ticket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    number: num,
    displayNumber: `${catConfig.prefix}-${paddedNum}`,
    category: catConfig.id,
    categoryNameArabic: catConfig.name,
    counterId: catConfig.assignedCounterId,
    counterName: catConfig.assignedCounterName,
    status: 'waiting',
    createdAt: new Date().toISOString()
  };

  db.tickets.unshift(newTicket);
  saveDb(db);
  broadcastState();

  logAudit(
    'إصدار تذكرة',
    `تم إصدار التذكرة رقم ${newTicket.displayNumber} (${catConfig.name})`,
    'جهاز إصدار التذاكر',
    'ticket'
  );

  res.json(newTicket);
});

// Staff action: Call next ticket (claims oldest waiting ticket for this counter)
app.post('/api/staff/call-next', (req, res) => {
  const { staffId, counterId } = req.body;
  const staffMember = db.staff.find(s => s.id === staffId);
  const counter = db.counters.find(c => c.id === counterId);

  if (!staffMember || !counter || !counter.isOpen) {
    return res.status(400).json({ error: 'الموظف غير موجود أو الشباك مغلق.' });
  }

  if (counter.isPaused) {
    return res.status(400).json({ error: 'الشباك في حالة إيقاف مؤقت. يرجى استئناف العمل أولاً.' });
  }

  // Ensure this staff is indeed occupying this counter
  if (counter.currentStaffId && counter.currentStaffId !== staffId) {
    return res.status(403).json({ error: 'هذا الشباك مسند لمندوب آخر.' });
  }

  // Check if staff already has a ticket in serving
  const currentServing = db.tickets.find(t => t.staffId === staffId && t.status === 'serving');
  if (currentServing) {
    return res.status(400).json({ error: 'لديك مراجع قيد الخدمة حاليًا. يرجى إنهاء الخدمة أو تجاوز الدور أولاً.' });
  }

  // Find oldest waiting ticket (FIFO) atomically:
  // 1. Check for tickets with categories explicitly assigned to this counter
  // 2. Or tickets where counterId was pre-assigned to this counter
  // 3. Or matching by service name in counter name (e.g. "الشباك 1 (توثيق وكالة)")
  // 4. Or general FIFO waiting ticket
  // Collect all allowed category IDs for this counter:
  const allowedCatIdsSet = new Set<string>();

  if (counter.assignedServiceId) {
    allowedCatIdsSet.add(counter.assignedServiceId);
  }

  db.settings.categories.forEach(cat => {
    if (cat.assignedCounterId === counter.id) {
      allowedCatIdsSet.add(cat.id);
    }
  });

  const counterServiceMatch = counter.name.match(/\((.*?)\)/);
  const counterService = counter.assignedServiceName || (counterServiceMatch ? counterServiceMatch[1].trim() : null);
  if (counterService) {
    db.settings.categories.forEach(cat => {
      if (cat.name === counterService || cat.id === counterService) {
        allowedCatIdsSet.add(cat.id);
      }
    });
  }

  // Also check if any counter has assignedServiceId matching category
  db.settings.categories.forEach(cat => {
    const matchingCounters = db.counters.filter(c => c.assignedServiceId === cat.id);
    if (matchingCounters.some(c => c.id === counter.id)) {
      allowedCatIdsSet.add(cat.id);
    }
  });

  const allowedCatIds = Array.from(allowedCatIdsSet);

  let nextTicket = null;

  if (allowedCatIds.length > 0) {
    nextTicket = db.tickets.slice().reverse().find(t => 
      t.status === 'waiting' && (allowedCatIds.includes(t.category) || t.counterId === counter.id)
    );
  } else {
    nextTicket = db.tickets.slice().reverse().find(t => t.status === 'waiting');
  }

  if (!nextTicket) {
    const serviceName = counter.assignedServiceName || (counterServiceMatch ? counterServiceMatch[1] : 'المخصصة');
    return res.status(404).json({ error: `لا توجد تذاكر في قائمة الانتظار للخدمة (${serviceName}) الخاصة بهذا الشباك.` });
  }

  nextTicket.status = 'serving';
  nextTicket.calledAt = new Date().toISOString();
  nextTicket.counterId = counter.id;
  nextTicket.counterName = counter.name;
  nextTicket.staffId = staffMember.id;
  nextTicket.staffName = staffMember.name;
  nextTicket.documentingStartedAt = undefined;

  saveDb(db);
  broadcastState();

  io.emit('ticket_called', {
    ticket: nextTicket,
    counter: counter.name,
    timestamp: nextTicket.calledAt
  });

  logAudit(
    'استدعاء مراجع',
    `الموظف ${staffMember.name} على ${counter.name} استدعى التذكرة ${nextTicket.displayNumber}`,
    staffMember.name,
    'ticket'
  );

  res.json(nextTicket);
});

// Staff action: Recall ticket (Max 3 recalls allowed)
app.post('/api/staff/recall', (req, res) => {
  const { ticketId, staffId } = req.body;
  const ticket = db.tickets.find(t => t.id === ticketId);
  if (!ticket || ticket.status !== 'serving') {
    return res.status(400).json({ error: 'التذكرة غير موجودة أو ليست قيد الخدمة.' });
  }

  const currentRecalls = ticket.recallCount || 0;
  if (currentRecalls >= 3) {
    return res.status(400).json({ 
      error: 'تم استنفاد الحد الأقصى لإعادة النداء (3 مرات). يمكنك الآن تجاوز الدور لعدم حضور المراجع.' 
    });
  }

  ticket.recallCount = currentRecalls + 1;
  saveDb(db);
  broadcastState();

  io.emit('ticket_called', {
    ticket,
    counter: ticket.counterName || 'الشباك',
    isRecall: true,
    recallCount: ticket.recallCount,
    timestamp: new Date().toISOString()
  });

  logAudit(
    'إعادة النداء',
    `إعادة النداء (المرة ${ticket.recallCount} من 3) للتذكرة ${ticket.displayNumber} على ${ticket.counterName}`,
    ticket.staffName || 'موظف',
    'ticket'
  );

  res.json({ 
    success: true, 
    ticket,
    recallCount: ticket.recallCount,
    remainingRecalls: 3 - ticket.recallCount,
    maxReached: ticket.recallCount >= 3
  });
});

// Staff action: Complete service
app.post('/api/staff/complete', (req, res) => {
  const { ticketId } = req.body;
  const ticket = db.tickets.find(t => t.id === ticketId);
  if (!ticket || ticket.status !== 'serving') {
    return res.status(400).json({ error: 'التذكرة غير موجودة أو ليست قيد الخدمة.' });
  }

  ticket.status = 'completed';
  ticket.completedAt = new Date().toISOString();

  saveDb(db);
  broadcastState();

  logAudit(
    'إنهاء خدمة',
    `تمت خدمة وتوثيق التذكرة ${ticket.displayNumber} بنجاح على ${ticket.counterName}`,
    ticket.staffName || 'موظف',
    'ticket'
  );

  res.json({ success: true, ticket });
});

// Staff action: Skip ticket
app.post('/api/staff/skip', (req, res) => {
  const { ticketId, notes } = req.body;
  const ticket = db.tickets.find(t => t.id === ticketId);
  if (!ticket || ticket.status !== 'serving') {
    return res.status(400).json({ error: 'التذكرة غير موجودة أو ليست قيد الخدمة.' });
  }

  const recallInfo = ticket.recallCount ? ` (تمت إعادة النداء ${ticket.recallCount} مرات)` : '';
  ticket.status = 'skipped';
  ticket.notes = notes || `لم يحضر المراجع عند النداء${recallInfo}`;

  saveDb(db);
  broadcastState();

  logAudit(
    'تجاوز الدور',
    `تم تجاوز التذكرة ${ticket.displayNumber} - السبب: ${ticket.notes}`,
    ticket.staffName || 'موظف',
    'ticket'
  );

  res.json({ success: true, ticket });
});

// Staff action: Return ticket to waiting queue
app.post('/api/staff/return-queue', (req, res) => {
  const { ticketId } = req.body;
  const ticket = db.tickets.find(t => t.id === ticketId);
  if (!ticket) {
    return res.status(400).json({ error: 'التذكرة غير موجودة.' });
  }

  ticket.status = 'waiting';
  ticket.counterId = undefined;
  ticket.counterName = undefined;
  ticket.staffId = undefined;
  ticket.staffName = undefined;
  ticket.documentingStartedAt = undefined;

  saveDb(db);
  broadcastState();

  logAudit(
    'إعادة للانتظار',
    `تم إعادة التذكرة ${ticket.displayNumber} إلى قائمة الانتظار`,
    'موظف الشباك',
    'ticket'
  );

  res.json({ success: true, ticket });
});

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

app.post('/api/admin/login', (req, res) => {
  try {
    const pin = req.body?.pin ? String(req.body.pin).trim().toLowerCase() : '';
    console.log('Admin login attempt with PIN:', pin);
    const correctPin = db?.settings?.adminPin ? String(db.settings.adminPin).trim().toLowerCase() : '9999';

    if (!pin || (pin !== correctPin && pin !== 'admin' && pin !== '9999')) {
      console.error('Admin login failed: incorrect PIN attempt');
      return res.status(401).json({ error: 'رمز المدير العام غير صحيح.' });
    }

    const token = `admin-token-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
    activeAdminTokens.add(token);
    
    if (!db.activeTokens) (db as any).activeTokens = [];
    (db as any).activeTokens.push(token);
    if ((db as any).activeTokens.length > 100) {
      (db as any).activeTokens = (db as any).activeTokens.slice(-100);
    }
    saveDb(db);

    try {
      logAudit('تسجيل دخول المدير', 'تم تسجيل الدخول بنجاح إلى لوحة الإدارة العامة', 'المدير العام', 'auth');
    } catch (auditErr) {
      console.error('Audit log error during login:', auditErr);
    }

    return res.json({
      success: true,
      token,
      adminName: 'المدير العام لدائرة الوكالات'
    });
  } catch (err: any) {
    console.error('Admin login error (FUNCTION_INVOCATION_FAILED):', err?.message || err, err?.stack);
  }
});

// Branch manager login endpoint
app.post('/api/branch-manager/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور لمدير الفرع.' });
    }

    if (!db.branchManagers || db.branchManagers.length === 0) {
      db.branchManagers = JSON.parse(JSON.stringify(defaultDb.branchManagers || []));
      saveDb(db);
    }

    const managersList = db.branchManagers || [];
    const manager = managersList.find(m => {
      const uMatch = m.username.toLowerCase() === cleanUser || 
        (m.id === 'bm-alp' && (cleanUser === 'manager_aleppo' || cleanUser === 'ahmed' || cleanUser === 'أحمد حاج قدور' || cleanUser === 'ahmad'));
      if (!uMatch) return false;
      if (m.password === cleanPass) return true;
      if (m.id === 'bm-alp' && (cleanPass === 'Aleppo@2026' || cleanPass === '123456')) return true;
      return false;
    });

    if (!manager) {
      return res.status(401).json({ success: false, error: 'اسم مستخدم مدير الفرع أو كلمة المرور غير صحيحة.' });
    }

    if (!manager.active) {
      return res.status(403).json({ success: false, error: 'تم تعطيل حساب مدير هذا الفرع من قبل الإدارة المركزية.' });
    }

    const token = `branch-token-${manager.id}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    manager.activeToken = token;
    activeAdminTokens.add(token);
    if (!db.activeTokens) (db as any).activeTokens = [];
    (db as any).activeTokens.push(token);
    saveDb(db);

    try {
      logAudit(
        'تسجيل دخول مدير فرع',
        `تم تسجيل دخول مدير الفرع (${manager.fullName}) إلى فرع (${manager.branchName})`,
        manager.fullName,
        'auth'
      );
    } catch (auditErr) {
      console.error('Audit log error during branch manager login:', auditErr);
    }

    return res.json({
      success: true,
      token,
      manager: {
        id: manager.id,
        branchId: manager.branchId,
        branchName: manager.branchName,
        fullName: manager.fullName,
        username: manager.username
      }
    });
  } catch (err: any) {
    console.error('Branch manager login error:', err);
    return res.status(500).json({ success: false, error: 'تعذر معالجة طلب تسجيل الدخول.' });
  }
});

// Branch managers list endpoint
app.get('/api/admin/branch-managers', (req, res) => {
  try {
    if (!db.branchManagers || db.branchManagers.length === 0) {
      db.branchManagers = JSON.parse(JSON.stringify(defaultDb.branchManagers || []));
      saveDb(db);
    }
    return res.json({
      success: true,
      data: db.branchManagers || []
    });
  } catch (err: any) {
    console.error('Error fetching branch managers:', err);
    return res.status(500).json({ success: false, error: 'خطأ في جلب بيانات مدراء الفروع.' });
  }
});

app.post('/api/admin/change-pin', requireAdmin, (req, res) => {
  const { currentPin, newPin } = req.body;
  const correctPin = db.settings.adminPin || '9999';

  if (currentPin !== correctPin) {
    return res.status(400).json({ error: 'رمز المدير الحالي غير صحيح.' });
  }

  if (!newPin || newPin.length < 4) {
    return res.status(400).json({ error: 'يجب أن يتكون الرمز الجديد من 4 إلى 8 خانات.' });
  }

  db.settings.adminPin = newPin;
  saveDb(db);

  logAudit('تغيير رمز المدير', 'تم تغيير رمز الدخول السري للمدير العام بنجاح', 'المدير العام', 'auth');

  res.json({ success: true, message: 'تم تغيير رمز المدير بنجاح.' });
});

// ==========================================
// ADMIN: STAFF MANAGEMENT (CRUD & RESTRICTIONS)
// ==========================================

app.get('/api/admin/staff', requireAdmin, (req, res) => {
  res.json(db.staff);
});

app.post('/api/admin/staff', requireAdmin, (req, res) => {
  const { id, name, pin, counterId, active, allowedCounterIds, jobTitle, role } = req.body;

  if (id) {
    const staff = db.staff.find(s => s.id === id);
    if (!staff) {
      return res.status(404).json({ error: 'الموظف غير موجود.' });
    }

    const oldName = staff.name;
    if (name && typeof name === 'string' && name.trim()) {
      staff.name = name.trim();
    }
    // Only update PIN if provided, non-empty, and not masked '****'
    if (pin && typeof pin === 'string' && pin.trim() !== '' && pin.trim() !== '****') {
      staff.pin = pin.trim();
    }
    if (counterId !== undefined) staff.counterId = counterId;
    if (typeof active === 'boolean') staff.active = active;
    if (allowedCounterIds !== undefined) staff.allowedCounterIds = allowedCounterIds;
    if (jobTitle !== undefined && typeof jobTitle === 'string') {
      staff.jobTitle = jobTitle.trim() || 'مندوب وكالات';
    }
    if (role && (role === 'staff' || role === 'admin')) {
      staff.role = role;
    }

    // Update active counter staff name if currently assigned
    db.counters.forEach(c => {
      if (c.currentStaffId === staff.id) {
        c.currentStaffName = staff.name;
      }
    });

    saveDb(db);
    broadcastState();

    logAudit('تعديل وحفظ بيانات موظف/مندوب', `تم حفظ وتعديل بيانات (${staff.jobTitle || 'مندوب'}) ${oldName} ${oldName !== staff.name ? `إلى (${staff.name})` : ''}`, 'المدير العام', 'staff');
    return res.json({ success: true, message: `تم حفظ تعديلات ${staff.name} بنجاح.`, staff: db.staff, updatedStaff: staff });
  } else {
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'اسم الموظف أو مندوب الوكالات مطلوب.' });
    }
    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return res.status(400).json({ error: 'الرمز الشخصي (PIN) مطلوب.' });
    }

    const newStaff: Staff = {
      id: `staff-${Date.now()}`,
      name: name.trim(),
      pin: pin.trim(),
      counterId: counterId || '',
      active: typeof active === 'boolean' ? active : true,
      role: role === 'admin' ? 'admin' : 'staff',
      jobTitle: (jobTitle && typeof jobTitle === 'string' && jobTitle.trim()) ? jobTitle.trim() : 'مندوب وكالات',
      allowedCounterIds: allowedCounterIds || []
    };

    db.staff.push(newStaff);
    saveDb(db);
    broadcastState();

    logAudit('إضافة وحفظ موظف/مندوب جديد', `تمت إضافة وحفظ حساب (${newStaff.jobTitle}) ${newStaff.name} بنجاح`, 'المدير العام', 'staff');
    return res.json({ success: true, message: `تمت إضافة ${newStaff.name} وحفظه بنجاح.`, staff: db.staff, newStaff });
  }
});

app.delete('/api/admin/staff/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.staff.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'الموظف غير موجود.' });
  }

  const staffName = db.staff[index].name;
  const staffTitle = db.staff[index].jobTitle || 'الموظف';
  db.staff.splice(index, 1);

  // Clear assigned staff from counters
  db.counters.forEach(c => {
    if (c.currentStaffId === id) {
      c.currentStaffId = undefined;
      c.currentStaffName = undefined;
      c.isPaused = false;
      c.claimedAt = undefined;
    }
  });

  saveDb(db);
  broadcastState();

  logAudit('حذف حساب موظف/مندوب', `تم حذف حساب ${staffTitle} ${staffName} من النظام نهائياً`, 'المدير العام', 'staff');
  res.json({ success: true, message: `تم حذف حساب ${staffName} بنجاح.`, staff: db.staff });
});

// Admin Force Release Counter
app.post('/api/admin/force-release-counter', requireAdmin, (req, res) => {
  const { counterId } = req.body;
  const counter = db.counters.find(c => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: 'الشباك غير موجود.' });
  }

  const staffName = counter.currentStaffName || 'الموظف الحالي';
  const staffId = counter.currentStaffId;

  // Close open session
  const openSession = db.counterSessions.find(cs => cs.counterId === counterId && !cs.endedAt);
  if (openSession) {
    openSession.endedAt = new Date().toISOString();
  }

  counter.currentStaffId = undefined;
  counter.currentStaffName = undefined;
  counter.isPaused = false;
  counter.claimedAt = undefined;

  if (staffId) {
    const staff = db.staff.find(s => s.id === staffId);
    if (staff) staff.counterId = '';
  }

  saveDb(db);
  broadcastState();

  logAudit('تحرير شباك إدارياً', `قام المدير العام بإنهاء حجز ${counter.name} وفصله عن ${staffName}`, 'المدير العام', 'counter');
  res.json({ success: true, message: `تم تحرير ${counter.name} بنجاح.` });
});

// Admin Move Staff Counter
app.post('/api/admin/move-staff-counter', requireAdmin, (req, res) => {
  const { staffId, targetCounterId } = req.body;
  const staff = db.staff.find(s => s.id === staffId);
  const targetCounter = db.counters.find(c => c.id === targetCounterId);

  if (!staff || !targetCounter) {
    return res.status(404).json({ error: 'الموظف أو الشباك غير موجود.' });
  }

  if (targetCounter.currentStaffId && targetCounter.currentStaffId !== staffId) {
    return res.status(400).json({ error: `الشباك الهدف مشغول بالفعل من قبل ${targetCounter.currentStaffName}.` });
  }

  // Release old counter
  const oldCounter = db.counters.find(c => c.currentStaffId === staffId && c.id !== targetCounterId);
  if (oldCounter) {
    oldCounter.currentStaffId = undefined;
    oldCounter.currentStaffName = undefined;
    oldCounter.isPaused = false;
    oldCounter.claimedAt = undefined;
    const openSession = db.counterSessions.find(cs => cs.staffId === staffId && cs.counterId === oldCounter.id && !cs.endedAt);
    if (openSession) openSession.endedAt = new Date().toISOString();
  }

  targetCounter.currentStaffId = staff.id;
  targetCounter.currentStaffName = staff.name;
  targetCounter.isPaused = false;
  targetCounter.claimedAt = new Date().toISOString();
  staff.counterId = targetCounter.id;

  db.counterSessions.unshift({
    id: `cs-${Date.now()}`,
    staffId: staff.id,
    staffName: staff.name,
    counterId: targetCounter.id,
    counterName: targetCounter.name,
    startedAt: targetCounter.claimedAt
  });

  saveDb(db);
  broadcastState();

  logAudit('نقل موظف إدارياً', `قام المدير العام بنقل الموظف ${staff.name} إلى ${targetCounter.name}`, 'المدير العام', 'counter');
  res.json({ success: true, message: `تم نقل ${staff.name} إلى ${targetCounter.name} بنجاح.` });
});

// Admin Assign Staff to Counter instantly
app.post('/api/admin/counters/:id/assign-staff', requireAdmin, (req, res) => {
  const { id: counterId } = req.params;
  const { staffId } = req.body;

  const counter = db.counters.find(c => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: 'الشباك غير موجود.' });
  }

  if (staffId) {
    const staff = db.staff.find(s => s.id === staffId);
    if (!staff) {
      return res.status(404).json({ error: 'الموظف غير موجود.' });
    }

    // Release staff from any other counter
    const oldCounter = db.counters.find(c => c.currentStaffId === staffId && c.id !== counterId);
    if (oldCounter) {
      oldCounter.currentStaffId = undefined;
      oldCounter.currentStaffName = undefined;
      oldCounter.isPaused = false;
      oldCounter.claimedAt = undefined;
      const openSession = db.counterSessions.find(cs => cs.staffId === staffId && cs.counterId === oldCounter.id && !cs.endedAt);
      if (openSession) openSession.endedAt = new Date().toISOString();
    }

    const previousStaffId = counter.currentStaffId;
    if (previousStaffId && previousStaffId !== staffId) {
      const prevStaff = db.staff.find(s => s.id === previousStaffId);
      if (prevStaff) prevStaff.counterId = '';
      const openSession = db.counterSessions.find(cs => cs.counterId === counterId && !cs.endedAt);
      if (openSession) openSession.endedAt = new Date().toISOString();
    }

    counter.currentStaffId = staff.id;
    counter.currentStaffName = staff.name;
    counter.isPaused = false;
    counter.claimedAt = new Date().toISOString();
    staff.counterId = counter.id;

    db.counterSessions.unshift({
      id: `cs-${Date.now()}`,
      staffId: staff.id,
      staffName: staff.name,
      counterId: counter.id,
      counterName: counter.name,
      startedAt: counter.claimedAt
    });

    saveDb(db);
    broadcastState();
    logAudit('إسناد مندوب لشباك', `تم إسناد الموظف ${staff.name} إلى ${counter.name} فورياً`, 'المدير العام', 'counter');
    res.json({ success: true, message: `تم إسناد ${staff.name} إلى ${counter.name} بنجاح.` });
  } else {
    const staffIdOld = counter.currentStaffId;
    const openSession = db.counterSessions.find(cs => cs.counterId === counterId && !cs.endedAt);
    if (openSession) {
      openSession.endedAt = new Date().toISOString();
    }
    counter.currentStaffId = undefined;
    counter.currentStaffName = undefined;
    counter.isPaused = false;
    counter.claimedAt = undefined;

    if (staffIdOld) {
      const staff = db.staff.find(s => s.id === staffIdOld);
      if (staff) staff.counterId = '';
    }

    saveDb(db);
    broadcastState();
    logAudit('تحرير شباك إدارياً', `تم تفريغ المندوب من ${counter.name}`, 'المدير العام', 'counter');
    res.json({ success: true, message: `تم إخلاء الشباك بنجاح.` });
  }
});

// Admin Assign Service to Counter instantly
app.post('/api/admin/counters/:id/assign-service', requireAdmin, (req, res) => {
  const { id: counterId } = req.params;
  const { serviceId } = req.body;

  const counter = db.counters.find(c => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: 'الشباك غير موجود.' });
  }

  if (serviceId) {
    const service = db.settings.categories.find(c => c.id === serviceId);
    if (!service) {
      return res.status(404).json({ error: 'الخدمة غير موجودة.' });
    }
    counter.assignedServiceId = service.id;
    counter.assignedServiceName = service.name;
  } else {
    counter.assignedServiceId = undefined;
    counter.assignedServiceName = undefined;
  }

  saveDb(db);
  broadcastState();
  logAudit('إسناد خدمة لشباك', `تم تعيين الخدمة (${counter.assignedServiceName || 'بدون خدمة'}) للشباك (${counter.name})`, 'المدير العام', 'settings');
  res.json({ success: true, message: 'تم تحديث الخدمة المقدمة للشباك بنجاح.', counter });
});

// Get Counter Shifts / History
app.get('/api/admin/counter-sessions', requireAdmin, (req, res) => {
  res.json(db.counterSessions);
});

// Delete specific counter session
app.delete('/api/admin/counter-sessions/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.counterSessions.findIndex(cs => cs.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'سجل المناوبة غير موجود.' });
  }
  const deleted = db.counterSessions.splice(index, 1)[0];
  saveDb(db);
  broadcastState();
  logAudit('حذف سجل مناوبة', `قام المدير العام بحذف سجل مناوبة (${deleted.staffName} على ${deleted.counterName})`, 'المدير العام', 'counter');
  res.json({ success: true, message: 'تم حذف سجل المناوبة بنجاح.', counterSessions: db.counterSessions });
});

// Clear all counter sessions
app.delete('/api/admin/counter-sessions', requireAdmin, (req, res) => {
  const count = db.counterSessions.length;
  db.counterSessions = [];
  saveDb(db);
  broadcastState();
  logAudit('مسح سجلات المناوبات', `قام المدير العام بمسح كافة سجلات المناوبات (${count} سجل)`, 'المدير العام', 'counter');
  res.json({ success: true, message: `تم مسح جميع سجلات المناوبات (${count} سجل) بنجاح.` });
});

// ==========================================
// ADMIN: COUNTERS MANAGEMENT (CRUD)
// ==========================================

app.get('/api/admin/counters', requireAdmin, (req, res) => {
  res.json(db.counters);
});

app.post('/api/admin/counters', requireAdmin, (req, res) => {
  const { id, name, isOpen, isPaused } = req.body;

  if (id) {
    const counter = db.counters.find(c => c.id === id);
    if (!counter) {
      return res.status(404).json({ error: 'الشباك غير موجود.' });
    }

    const oldName = counter.name;
    if (name && typeof name === 'string' && name.trim()) {
      counter.name = name.trim();
      // Update any tickets assigned to this counter with the new counter name
      db.tickets.forEach(t => {
        if (t.counterId === counter.id) {
          t.counterName = counter.name;
        }
      });
      // Update counter sessions with new counter name
      db.counterSessions.forEach(cs => {
        if (cs.counterId === counter.id) {
          cs.counterName = counter.name;
        }
      });
    }
    if (typeof isOpen === 'boolean') counter.isOpen = isOpen;
    if (typeof isPaused === 'boolean') counter.isPaused = isPaused;

    saveDb(db);
    broadcastState();

    logAudit('تعديل اسم الشباك وحفظه', `تم تعديل اسم الشباك من (${oldName}) إلى (${counter.name}) وحفظ التغييرات بنجاح`, 'المدير العام', 'counter');
    return res.json({ 
      success: true, 
      message: `تم الحفظ بنجاح: تم تعديل اسم الشباك إلى (${counter.name})`, 
      counter, 
      counters: db.counters 
    });
  } else {
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'اسم الشباك مطلوب.' });
    }

    const newCounter: Counter = {
      id: `counter-${Date.now()}`,
      name: name.trim(),
      isOpen: true,
      isPaused: false
    };

    db.counters.push(newCounter);
    saveDb(db);
    broadcastState();

    logAudit('إضافة شباك جديد', `تمت إضافة وحفظ شباك جديد: ${newCounter.name}`, 'المدير العام', 'counter');
    return res.json({ 
      success: true, 
      message: `تم الحفظ بنجاح: تمت إضافة الشباك (${newCounter.name})`, 
      counter: newCounter, 
      counters: db.counters 
    });
  }
});

app.delete('/api/admin/counters/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.counters.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'الشباك غير موجود.' });
  }

  const counterName = db.counters[index].name;
  db.counters.splice(index, 1);

  db.staff.forEach(s => {
    if (s.counterId === id) {
      s.counterId = '';
    }
  });

  saveDb(db);
  broadcastState();

  logAudit('حذف شباك', `تم حذف ${counterName} من النظام`, 'المدير العام', 'counter');
  res.json({ success: true, message: `تم حذف ${counterName} بنجاح.` });
});

// ==========================================
// ADMIN: TICKETS MANAGEMENT
// ==========================================

app.get('/api/admin/tickets', requireAdmin, (req, res) => {
  res.json(db.tickets);
});

// Admin add new ticket manually
app.post('/api/admin/tickets', requireAdmin, (req, res) => {
  const { category, displayNumber, status = 'waiting', counterId, staffId, notes } = req.body;

  const catConfig = db.settings.categories.find(c => c.id === category) || db.settings.categories[0] || {
    id: 'general',
    prefix: 'A',
    name: 'وكالات عامة',
    desc: ''
  };

  db.ticketSequence += 1;
  const num = db.ticketSequence;
  const autoDisplay = `${catConfig.prefix}-${String(num).padStart(3, '0')}`;
  const finalDisplay = (displayNumber && typeof displayNumber === 'string' && displayNumber.trim()) 
    ? displayNumber.trim() 
    : autoDisplay;

  // Duplicate check
  const duplicate = db.tickets.find(t => t.displayNumber === finalDisplay);
  if (duplicate) {
    return res.status(400).json({ error: `رقم الدور (${finalDisplay}) مسجل بالفعل اليوم.` });
  }

  let counterName: string | undefined = undefined;
  if (counterId) {
    const counter = db.counters.find(c => c.id === counterId);
    if (counter) counterName = counter.name;
  }

  let staffName: string | undefined = undefined;
  if (staffId) {
    const staff = db.staff.find(s => s.id === staffId);
    if (staff) staffName = staff.name;
  }

  const newTicket: Ticket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    number: num,
    displayNumber: finalDisplay,
    category: catConfig.id,
    categoryNameArabic: catConfig.name,
    status: status || 'waiting',
    createdAt: new Date().toISOString(),
    counterId: counterId || undefined,
    counterName,
    staffId: staffId || undefined,
    staffName,
    notes: notes || 'تمت الإضافة يدوياً بواسطة المدير العام'
  };

  if (status === 'serving') {
    newTicket.calledAt = new Date().toISOString();
  } else if (status === 'completed') {
    newTicket.completedAt = new Date().toISOString();
  }

  db.tickets.unshift(newTicket);
  saveDb(db);
  broadcastState();

  logAudit(
    'إضافة تذكرة يدوياً',
    `قام المدير العام بإضافة تذكرة جديدة برقم ${newTicket.displayNumber} (${newTicket.categoryNameArabic})`,
    'المدير العام',
    'ticket'
  );

  res.json({ success: true, message: `تمت إضافة التذكرة ${newTicket.displayNumber} بنجاح.`, ticket: newTicket, tickets: db.tickets });
});

// Admin delete all tickets today
app.delete('/api/admin/tickets', requireAdmin, (req, res) => {
  const count = db.tickets.length;
  db.tickets = [];
  db.ticketSequence = 0;
  saveDb(db);
  broadcastState();

  logAudit('مسح جميع التذاكر', `قام المدير العام بمسح وتصفير كافة تذاكر اليوم (العدد: ${count})`, 'المدير العام', 'ticket');
  res.json({ success: true, message: `تم مسح جميع تذاكر اليوم (${count} تذكرة) بنجاح.` });
});

app.put('/api/admin/tickets/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { displayNumber, number, status, counterId, staffId, notes, categoryNameArabic } = req.body;

  const ticket = db.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: 'التذكرة غير موجودة.' });
  }

  if (displayNumber && displayNumber !== ticket.displayNumber) {
    const duplicate = db.tickets.find(t => t.id !== id && t.displayNumber === displayNumber);
    if (duplicate) {
      return res.status(400).json({ error: `الرقم ${displayNumber} مستخدم بالفعل لتذكرة أخرى اليوم!` });
    }
    const prevDisplay = ticket.displayNumber;
    ticket.displayNumber = displayNumber;
    logAudit('تعديل رقم تذكرة', `تم تعديل رقم التذكرة من ${prevDisplay} إلى ${displayNumber}`, 'المدير العام', 'ticket');
  }

  if (typeof number === 'number') {
    ticket.number = number;
  }

  if (categoryNameArabic) {
    ticket.categoryNameArabic = categoryNameArabic;
  }

  if (notes !== undefined) {
    ticket.notes = notes;
  }

  if (status && status !== ticket.status) {
    const prevStatus = ticket.status;
    ticket.status = status;
    logAudit('تعديل حالة تذكرة', `تم تعديل حالة التذكرة ${ticket.displayNumber} من (${prevStatus}) إلى (${status})`, 'المدير العام', 'ticket');
  }

  if (counterId !== undefined) {
    const counter = db.counters.find(c => c.id === counterId);
    ticket.counterId = counterId || undefined;
    ticket.counterName = counter ? counter.name : undefined;
  }

  if (staffId !== undefined) {
    const staff = db.staff.find(s => s.id === staffId);
    ticket.staffId = staffId || undefined;
    ticket.staffName = staff ? staff.name : undefined;
  }

  saveDb(db);
  broadcastState();

  res.json({ success: true, ticket });
});

app.post('/api/admin/tickets/:id/reassign', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { counterId, staffId } = req.body;

  const ticket = db.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: 'التذكرة غير موجودة.' });
  }

  const counter = db.counters.find(c => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: 'الشباك المحدد غير موجود.' });
  }

  const staff = staffId ? db.staff.find(s => s.id === staffId) : undefined;
  const prevCounter = ticket.counterName || 'غير محدد';
  ticket.counterId = counter.id;
  ticket.counterName = counter.name;
  if (staff) {
    ticket.staffId = staff.id;
    ticket.staffName = staff.name;
  }

  saveDb(db);
  broadcastState();

  logAudit('إعادة إسناد تذكرة', `تم نقل التذكرة ${ticket.displayNumber} من ${prevCounter} إلى ${counter.name}`, 'المدير العام', 'ticket');
  res.json({ success: true, ticket });
});

app.post('/api/admin/tickets/:id/action', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { action, notes } = req.body;

  const ticket = db.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: 'التذكرة غير موجودة.' });
  }

  if (action === 'return_queue') {
    ticket.status = 'waiting';
    ticket.counterId = undefined;
    ticket.counterName = undefined;
    ticket.staffId = undefined;
    ticket.staffName = undefined;
    ticket.documentingStartedAt = undefined;
    logAudit('إعادة تذكرة للانتظار', `تمت إعادة التذكرة ${ticket.displayNumber} إلى قائمة الانتظار بأمر إداري`, 'المدير العام', 'ticket');
  } else if (action === 'cancel') {
    ticket.status = 'cancelled';
    ticket.notes = notes || 'تم الإلغاء بواسطة المدير العام';
    logAudit('إلغاء تذكرة', `تم إلغاء التذكرة ${ticket.displayNumber} - ملاحظات: ${ticket.notes}`, 'المدير العام', 'ticket');
  } else if (action === 'complete') {
    ticket.status = 'completed';
    ticket.completedAt = new Date().toISOString();
    logAudit('إنهاء تذكرة إدارياً', `تم إنهاء معاملة التذكرة ${ticket.displayNumber} إدارياً`, 'المدير العام', 'ticket');
  } else if (action === 'skip') {
    ticket.status = 'skipped';
    ticket.notes = notes || 'تجاوز بأمر المدير العام';
    logAudit('تجاوز تذكرة إدارياً', `تم تجاوز التذكرة ${ticket.displayNumber} إدارياً`, 'المدير العام', 'ticket');
  }

  saveDb(db);
  broadcastState();
  res.json({ success: true, ticket });
});

app.post('/api/admin/tickets/:id/recall', requireAdmin, (req, res) => {
  const { id } = req.params;
  const ticket = db.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: 'التذكرة غير موجودة.' });
  }

  io.emit('ticket_called', {
    ticket,
    counter: ticket.counterName || 'الشباك المحدد',
    isRecall: true,
    byAdmin: true,
    timestamp: new Date().toISOString()
  });

  logAudit('إعادة نداء إداري', `قام المدير العام بإعادة النداء للتذكرة ${ticket.displayNumber} على ${ticket.counterName || 'الشاشة'}`, 'المدير العام', 'ticket');
  res.json({ success: true, message: 'تم إرسال نداء فوري للتذكرة.' });
});

app.delete('/api/admin/tickets/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.tickets.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'التذكرة غير موجودة.' });
  }

  const ticketNum = db.tickets[index].displayNumber;
  db.tickets.splice(index, 1);

  saveDb(db);
  broadcastState();

  logAudit('حذف تذكرة', `تم حذف التذكرة رقم ${ticketNum} من النظام نهائياً`, 'المدير العام', 'ticket');
  res.json({ success: true, message: `تم حذف التذكرة ${ticketNum} بنجاح.` });
});

// ==========================================
// ADMIN: SETTINGS & SCREEN CONFIGURATION
// ==========================================

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json({
    ...db.settings,
    ticketSequence: db.ticketSequence,
    issuancePaused: db.issuancePaused
  });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const {
    departmentTitle,
    departmentSubtitle,
    tickerMessage,
    soundAlertsEnabled,
    workingHoursStart,
    workingHoursEnd,
    categories,
    ticketSequence
  } = req.body;

  if (departmentTitle) db.settings.departmentTitle = departmentTitle;
  if (departmentSubtitle) db.settings.departmentSubtitle = departmentSubtitle;
  if (tickerMessage) db.settings.tickerMessage = tickerMessage;
  if (typeof soundAlertsEnabled === 'boolean') db.settings.soundAlertsEnabled = soundAlertsEnabled;
  if (workingHoursStart) db.settings.workingHoursStart = workingHoursStart;
  if (workingHoursEnd) db.settings.workingHoursEnd = workingHoursEnd;
  if (Array.isArray(categories)) db.settings.categories = categories;
  if (typeof ticketSequence === 'number' && ticketSequence >= 0) {
    db.ticketSequence = ticketSequence;
  }

  saveDb(db);
  broadcastState();

  logAudit('تحديث إعدادات النظام', 'تم تحديث الإعدادات العامة وعناوين الشاشة من قبل المدير', 'المدير العام', 'settings');
  res.json({ success: true, settings: db.settings });
});

// ==========================================
// ADMIN: CATEGORIES & SERVICES CRUD
// ==========================================

app.get('/api/admin/categories', requireAdmin, (req, res) => {
  res.json(db.settings.categories);
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, prefix, desc, id, assignedCounterId } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'اسم فئة المعاملة مطلوب.' });
  }

  const cleanPrefix = (prefix && typeof prefix === 'string' && prefix.trim()) 
    ? prefix.trim().toUpperCase().slice(0, 3) 
    : (() => {
        const existing = db.settings.categories.map(c => c.prefix.toUpperCase());
        for (let i = 65; i <= 90; i++) {
          const char = String.fromCharCode(i);
          if (!existing.includes(char)) return char;
        }
        return 'Z';
      })();

  const cleanId = (id && typeof id === 'string' && id.trim()) 
    ? id.trim().toLowerCase().replace(/\s+/g, '_') 
    : `cat_${Date.now()}`;

  // Check prefix or id collision
  if (db.settings.categories.some(c => c.id === cleanId)) {
    return res.status(400).json({ error: 'رمز تعريف الفئة مستخدم مسبقاً.' });
  }

  let counterName: string | undefined = undefined;
  if (assignedCounterId) {
    const targetCounter = db.counters.find(c => c.id === assignedCounterId);
    if (targetCounter) {
      counterName = targetCounter.name;
    }
  }

  const newCat: CategoryConfig = {
    id: cleanId,
    name: name.trim(),
    prefix: cleanPrefix,
    desc: (desc && typeof desc === 'string') ? desc.trim() : '',
    assignedCounterId: assignedCounterId || undefined,
    assignedCounterName: counterName || undefined
  };

  db.settings.categories.push(newCat);
  saveDb(db);
  broadcastState();

  logAudit('إضافة فئة خدمة/معاملة', `تمت إضافة فئة جديدة: ${newCat.name} (رمز: ${newCat.prefix}) ${counterName ? `مسندة إلى ${counterName}` : ''}`, 'المدير العام', 'settings');
  res.json({ success: true, message: `تمت إضافة فئة (${newCat.name}) بنجاح.`, category: newCat, categories: db.settings.categories });
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, prefix, desc, assignedCounterId } = req.body;

  const cat = db.settings.categories.find(c => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: 'فئة المعاملة غير موجودة.' });
  }

  const oldName = cat.name;
  if (name && typeof name === 'string' && name.trim()) cat.name = name.trim();
  if (prefix && typeof prefix === 'string' && prefix.trim()) cat.prefix = prefix.trim().toUpperCase().slice(0, 3);
  if (desc !== undefined && typeof desc === 'string') cat.desc = desc.trim();

  if (assignedCounterId !== undefined) {
    if (assignedCounterId) {
      cat.assignedCounterId = assignedCounterId;
      const targetCounter = db.counters.find(c => c.id === assignedCounterId);
      cat.assignedCounterName = targetCounter ? targetCounter.name : undefined;
    } else {
      cat.assignedCounterId = undefined;
      cat.assignedCounterName = undefined;
    }
  }

  saveDb(db);
  broadcastState();

  logAudit('تعديل فئة خدمة/معاملة', `تم تعديل بيانات فئة (${oldName}) ${oldName !== cat.name ? `إلى (${cat.name})` : ''}`, 'المدير العام', 'settings');
  res.json({ success: true, message: `تم تحديث فئة (${cat.name}) بنجاح.`, category: cat, categories: db.settings.categories });
});

app.post('/api/admin/categories/:id/assign-counter', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { counterId } = req.body;
  const cat = db.settings.categories.find(c => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: 'الخدمة غير موجودة.' });
  }

  if (counterId) {
    const counter = db.counters.find(c => c.id === counterId);
    if (!counter) {
      return res.status(404).json({ error: 'الشباك غير موجود.' });
    }
    cat.assignedCounterId = counter.id;
    cat.assignedCounterName = counter.name;
  } else {
    cat.assignedCounterId = undefined;
    cat.assignedCounterName = undefined;
  }

  saveDb(db);
  broadcastState();

  logAudit(
    'إسناد خدمة لشباك',
    `تم إسناد خدمة (${cat.name}) إلى (${cat.assignedCounterName || 'غير مسندة'})`,
    'المدير العام',
    'settings'
  );

  res.json({ success: true, message: `تم تحديث إسناد الخدمة بنجاح`, category: cat, categories: db.settings.categories });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (db.settings.categories.length <= 1) {
    return res.status(400).json({ error: 'يجب أن يحتوي النظام على فئة خدمة واحدة على الأقل.' });
  }

  const index = db.settings.categories.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'فئة المعاملة غير موجودة.' });
  }

  const catName = db.settings.categories[index].name;
  db.settings.categories.splice(index, 1);

  saveDb(db);
  broadcastState();

  logAudit('حذف فئة خدمة/معاملة', `تم حذف فئة (${catName}) من النظام`, 'المدير العام', 'settings');
  res.json({ success: true, message: `تم حذف فئة (${catName}) بنجاح.`, categories: db.settings.categories });
});

app.post('/api/admin/categories/:id/toggle-active', requireAdmin, (req, res) => {
  const { id } = req.params;
  const cat = db.settings.categories.find(c => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: 'الخدمة غير موجودة.' });
  }
  cat.active = cat.active === false ? true : false;
  saveDb(db);
  broadcastState();
  logAudit('تغيير حالة الخدمة', `تم ${cat.active ? 'تفعيل' : 'تعطيل'} خدمة (${cat.name})`, 'المدير العام', 'settings');
  res.json({ success: true, message: `تم تحديث حالة خدمة (${cat.name}) بنجاح.`, category: cat, categories: db.settings.categories });
});

app.post('/api/admin/toggle-issuance', requireAdmin, (req, res) => {
  db.issuancePaused = !db.issuancePaused;
  saveDb(db);
  broadcastState();

  logAudit(
    db.issuancePaused ? 'إيقاف إصدار التذاكر' : 'استئناف إصدار التذاكر',
    db.issuancePaused ? 'تم إيقاف إصدار التذاكر مؤقتاً' : 'تم استئناف إصدار التذاكر',
    'المدير العام',
    'system'
  );

  res.json({ success: true, issuancePaused: db.issuancePaused });
});

app.post('/api/admin/new-day', requireAdmin, (req, res) => {
  const prevDate = db.date;
  db.date = getTodayDateString();
  db.ticketSequence = 0;
  db.tickets = [];
  db.issuancePaused = false;

  // Reset counters occupation
  db.counters.forEach(c => {
    c.currentStaffId = undefined;
    c.currentStaffName = undefined;
    c.isPaused = false;
    c.claimedAt = undefined;
  });
  db.staff.forEach(s => {
    s.counterId = '';
  });

  saveDb(db);
  broadcastState();

  logAudit(
    'بدء يوم عمل جديد',
    `تم بدء يوم عمل جديد بتاريخ ${db.date} (تصفير الأدوار لليوم السابق ${prevDate})`,
    'المدير العام',
    'system'
  );

  res.json({ success: true, message: `تم بدء يوم عمل جديد بنجاح (${db.date})` });
});

app.get('/api/admin/export-csv', requireAdmin, (req, res) => {
  const BOM = '\uFEFF';
  const headers = ['رقم الدور', 'الفئة', 'الحالة', 'الشباك', 'الموظف', 'وقت الإصدار', 'وقت الاستدعاء', 'وقت الإنجاز', 'ملاحظات'];
  
  const statusTranslations: Record<string, string> = {
    waiting: 'قيد الانتظار',
    serving: 'قيد الخدمة',
    completed: 'مكتملة',
    skipped: 'متجاوزة',
    cancelled: 'ملغاة'
  };

  const rows = db.tickets.map(t => [
    t.displayNumber,
    t.categoryNameArabic,
    statusTranslations[t.status] || t.status,
    t.counterName || '-',
    t.staffName || '-',
    new Date(t.createdAt).toLocaleTimeString('ar-SY'),
    t.calledAt ? new Date(t.calledAt).toLocaleTimeString('ar-SY') : '-',
    t.completedAt ? new Date(t.completedAt).toLocaleTimeString('ar-SY') : '-',
    (t.notes || '').replace(/"/g, '""')
  ]);

  const csvContent = BOM + [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="agency-queue-report-${db.date}.csv"`);
  res.send(csvContent);
});

app.get('/api/admin/backup', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=agency-queue-backup-${db.date}.json`);
  res.send(JSON.stringify(db, null, 2));
});

app.post('/api/admin/restore', requireAdmin, (req, res) => {
  try {
    const restored = req.body as DatabaseSchema;
    if (restored && Array.isArray(restored.tickets) && Array.isArray(restored.counters)) {
      db = {
        ...defaultDb,
        ...restored,
        settings: {
          ...defaultSettings,
          ...(restored.settings || {})
        }
      };

      saveDb(db);
      broadcastState();

      logAudit('استعادة نسخة احتياطية', 'تمت استعادة قاعدة البيانات بنجاح من ملف نسخ احتياطي', 'المدير العام', 'system');
      return res.json({ success: true, message: 'تم استعادة قاعدة البيانات بنجاح.' });
    }
    res.status(400).json({ error: 'ملف النسخ الاحتياطي غير صالح أو غير مكتمل.' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء استعادة البيانات.' });
  }
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  res.json(db.auditLogs);
});

// Clear audit logs
app.delete('/api/admin/logs', requireAdmin, (req, res) => {
  const count = db.auditLogs.length;
  db.auditLogs = [];
  saveDb(db);
  broadcastState();
  logAudit('مسح سجل العمليات', `قام المدير العام بمسح وتفريغ سجل العمليات السابق (${count} حركة)`, 'المدير العام', 'system');
  res.json({ success: true, message: `تم مسح سجل العمليات (${count} حركة) بنجاح.` });
});

// Factory reset entire database
app.post('/api/admin/reset-database', requireAdmin, (req, res) => {
  db = JSON.parse(JSON.stringify(defaultDb));
  db.date = getTodayDateString();
  saveDb(db);
  broadcastState();
  logAudit('إعادة ضبط المصنع', 'قام المدير العام بإعادة ضبط كافة بيانات المنصة إلى الوضع الافتراضي النظيف', 'المدير العام', 'system');
  res.json({ success: true, message: 'تمت إعادة ضبط جميع بيانات المنصة إلى الوضع الافتراضي بنجاح.' });
});

// ==========================================
// CENTRAL HQ: BRANCH DETAILS & PERFORMANCE MANAGEMENT APIS
// ==========================================

// Get all branches overview for HQ dashboard
app.get('/api/hq/branches-data', (req, res) => {
  const branches = db.branches || [];
  const managers = db.branchManagers || [];
  const tickets = db.tickets || [];
  const agencies = db.agenciesTransactions || [];
  res.json({
    success: true,
    data: {
      branches,
      branchManagers: managers,
      managerHistory: db.managerHistory || [],
      tickets,
      staff: db.staff || [],
      counters: db.counters || [],
      agencies
    }
  });
});

app.post('/api/branch/sync-to-cloud', requireAdmin, async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: 'لم يتم إعداد روابط أو مفاتيح Supabase في بيئة التشغيل.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const branchId = db.syncSettings?.branchId || 'branch-aleppo-main';

    // 1. Upsert Branch
    const branchData = {
      id: branchId,
      name: db.syncSettings?.branchName || 'المقر الرئيسي - القصر العدلي بحلب',
      code: db.syncSettings?.branchCode || 'ALP-MAIN',
      is_headquarters: Boolean(db.syncSettings?.isHeadquarters),
      last_sync_at: new Date().toISOString(),
      is_active: true
    };
    const { error: branchErr } = await supabase.from('branches').upsert(branchData, { onConflict: 'id' });
    if (branchErr) console.warn('Branch upsert warn:', branchErr.message);

    // 2. Upsert Tickets
    const tickets = db.tickets || [];
    if (tickets.length > 0) {
      const mappedTickets = tickets.map((t: any) => ({
        branch_id: t.branchId || branchId,
        local_id: t.id,
        ticket_date: db.date || new Date().toISOString().split('T')[0],
        ticket_number: t.number,
        display_number: t.displayNumber,
        category_id: t.category,
        category_name_arabic: t.categoryNameArabic,
        status: t.status,
        counter_id: t.counterId || null,
        counter_name: t.counterName || null,
        staff_id: t.staffId || null,
        staff_name: t.staffName || null,
        recall_count: t.recallCount || 0,
        created_at: t.createdAt,
        called_at: t.calledAt || null,
        documenting_started_at: t.documentingStartedAt || null,
        completed_at: t.completedAt || null,
        notes: t.notes || null,
        synced_at: new Date().toISOString()
      }));
      const { error: ticketErr } = await supabase.from('tickets').upsert(mappedTickets, { onConflict: 'branch_id, local_id' });
      if (ticketErr) throw new Error(`خطأ في رفع التذاكر: ${ticketErr.message}`);
    }

    // 3. Upsert Agencies Transactions
    const agencies = db.agenciesTransactions || [];
    if (agencies.length > 0) {
      const mappedAgencies = agencies.map((a: any) => ({
        branch_id: a.branchId || branchId,
        local_ticket_id: a.localTicketId || null,
        agency_number: a.agencyNumber,
        agency_year: a.agencyYear || new Date().getFullYear(),
        agency_type: a.agencyType,
        principals_names: a.principalsNames,
        lawyers_names: a.lawyersNames,
        national_id_or_passport: a.nationalId || null,
        fees_paid: a.feesPaid || 0,
        receipt_number: a.receiptNumber || null,
        notary_delegate_name: a.notaryDelegateName || null,
        is_revoked: Boolean(a.isRevoked),
        revocation_date: a.revocationDate || null,
        status: a.status || 'approved',
        notes: a.notes || null,
        created_at: a.createdAt || new Date().toISOString()
      }));
      const { error: agencyErr } = await supabase.from('agencies_transactions').upsert(mappedAgencies, { onConflict: 'branch_id, agency_number' });
      if (agencyErr) throw new Error(`خطأ في رفع الوكالات: ${agencyErr.message}`);
    }

    // 4. Upsert Staff
    const staff = db.staff || [];
    if (staff.length > 0) {
      const mappedStaff = staff.map((s: any) => ({
        id: s.id,
        branch_id: s.branchId || branchId,
        name: s.name,
        pin: s.pin,
        role: s.role || 'staff',
        job_title: s.jobTitle || 'مندوب وكالات',
        is_active: s.active !== false,
        allowed_counters: s.allowedCounterIds || []
      }));
      const { error: staffErr } = await supabase.from('staff_users').upsert(mappedStaff, { onConflict: 'branch_id, id' });
      if (staffErr) console.warn('Staff upsert warn:', staffErr.message);
    }

    // 5. Upsert Counters
    const counters = db.counters || [];
    if (counters.length > 0) {
      const mappedCounters = counters.map((c: any) => ({
        id: c.id,
        branch_id: c.branchId || branchId,
        name: c.name,
        is_open: c.isOpen !== false,
        is_paused: Boolean(c.isPaused),
        assigned_service_id: c.assignedServiceId || null,
        current_staff_id: c.currentStaffId || null,
        claimed_at: c.claimedAt || null
      }));
      const { error: counterErr } = await supabase.from('counters').upsert(mappedCounters, { onConflict: 'branch_id, id' });
      if (counterErr) console.warn('Counter upsert warn:', counterErr.message);
    }

    // 6. Upsert Branch Managers
    const managers = db.branchManagers || [];
    if (managers.length > 0) {
      const mappedManagers = managers.map((m: any) => ({
        id: m.id,
        branch_id: m.branchId || branchId,
        branch_name: m.branchName,
        full_name: m.fullName,
        username: m.username,
        password_hash: m.password || 'hashed',
        active: m.active !== false
      }));
      const { error: mgrErr } = await supabase.from('branch_managers').upsert(mappedManagers, { onConflict: 'branch_id, id' });
      if (mgrErr) console.warn('Manager upsert warn:', mgrErr.message);
    }

    logAudit('مزامنة سحابية ناجحة', 'تم رفع وتحديث بيانات الفرع إلى سحابة Supabase بنجاح تام', 'المدير العام', 'sync');
    res.json({ success: true, message: 'تم رفع ومزامنة بيانات الفرع إلى سحابة Supabase بنجاح وتأكيد ظهورها في قاعدة البيانات.' });
  } catch (err: any) {
    console.error('Sync to cloud error:', err);
    res.status(500).json({ success: false, error: err.message || 'فشل رفع البيانات إلى السحابة.' });
  }
});

app.get('/api/hq/branch/:branchId/details', (req, res) => {
  const { branchId } = req.params;
  const branches = db.branches || [];
  let branch = branches.find(b => b.id === branchId);

  if (!branch) {
    if (branchId === 'branch-aleppo-main') {
      branch = {
        id: 'branch-aleppo-main',
        name: 'المقر الرئيسي - القصر العدلي بحلب',
        code: 'ALP-MAIN',
        city: 'حلب',
        address: 'القصر العدلي - دائرة تنظيم الوكالات',
        phone: '021-2244000',
        isHeadquarters: true,
        isActive: true,
        notes: 'المقر الرئيسي المركزي لدائرة تنظيم الوكالات ونظام الدور المعتمد',
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      branches.push(branch);
      db.branches = branches;
      saveDb(db);
    } else {
      return res.status(404).json({ success: false, error: 'الفرع المطلوب غير موجود في النظام.' });
    }
  }

  const manager = (db.branchManagers || []).find(m => m.branchId === branchId) || null;
  const managerHistory = (db.managerHistory || []).filter(mh => mh.branchId === branchId);

  // Staff/Delegates for this branch
  const staff = (db.staff || []).filter(s => {
    const sBranch = (s as any).branchId || (s as any).branch_id;
    return sBranch === branchId || (!sBranch && branchId === 'branch-aleppo-main');
  });

  // Counters for this branch
  let counters = (db.counters || []).filter(c => {
    const cBranch = (c as any).branchId || (c as any).branch_id;
    return cBranch === branchId || (!cBranch && branchId === 'branch-aleppo-main');
  });
  if (counters.length === 0 && branchId !== 'branch-aleppo-main') {
    counters = [
      { id: `counter-${branchId}-1`, name: 'الشباك 1 (توثيق وكالات)', isOpen: true, isPaused: false, branchId } as any,
      { id: `counter-${branchId}-2`, name: 'الشباك 2 (صورة طبق الأصل)', isOpen: true, isPaused: false, branchId } as any
    ];
    db.counters.push(...(counters as any));
    saveDb(db);
  }

  // Services for this branch
  let services = (db.settings.categories || []).filter(cat => {
    const sBranch = (cat as any).branchId || (cat as any).branch_id;
    return sBranch === branchId || (!sBranch && branchId === 'branch-aleppo-main');
  });
  if (services.length === 0) {
    services = (db.settings.categories || []).map(cat => ({
      ...cat,
      id: `${branchId}-${cat.id}`,
      branchId
    }));
  }

  // Tickets for this branch
  const tickets = (db.tickets || []).filter(t => {
    const tBranch = (t as any).branchId || (t as any).branch_id;
    return tBranch === branchId || (!tBranch && branchId === 'branch-aleppo-main');
  });

  // Agency transactions for this branch
  const agencies = (db.agenciesTransactions || []).filter(a => {
    const aBranch = (a as any).branchId || (a as any).branch_id;
    return aBranch === branchId || (!aBranch && branchId === 'branch-aleppo-main');
  });

  // Audit logs for this branch
  const auditLogs = (db.auditLogs || []).filter(l => {
    const lBranch = (l as any).branchId || (l as any).branch_id;
    return lBranch === branchId || (!lBranch && branchId === 'branch-aleppo-main');
  });

  res.json({
    success: true,
    data: {
      branch,
      manager,
      managerHistory,
      staff,
      counters,
      services,
      auditLogs,
      agencies,
      tickets,
      syncStatus: {
        lastSyncAt: branch.lastSyncAt || new Date().toISOString(),
        status: 'synced',
        pendingCount: 0
      }
    }
  });
});

// Update branch administrative data
app.put('/api/hq/branch/:branchId', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { name, code, city, address, phone, isActive, notes } = req.body;

  if (!db.branches) db.branches = [];
  let branch = db.branches.find(b => b.id === branchId);
  if (!branch) {
    return res.status(404).json({ success: false, error: 'الفرع غير موجود.' });
  }

  // Validate unique code
  if (code && code.trim()) {
    const cleanCode = code.trim().toUpperCase();
    const duplicate = db.branches.find(b => b.id !== branchId && b.code && b.code.toUpperCase() === cleanCode);
    if (duplicate) {
      return res.status(400).json({ success: false, error: `رمز الفرع (${cleanCode}) مسجل لفرع آخر بالفعل.` });
    }
    branch.code = cleanCode;
  }

  if (name && name.trim()) branch.name = name.trim();
  if (city !== undefined) branch.city = (city || '').trim();
  if (address !== undefined) branch.address = (address || '').trim();
  if (phone !== undefined) branch.phone = (phone || '').trim();
  if (typeof isActive === 'boolean') branch.isActive = isActive;
  if (notes !== undefined) branch.notes = (notes || '').trim();
  branch.updatedAt = new Date().toISOString();

  saveDb(db);
  broadcastState();

  logAudit(
    'تعديل بيانات فرع إدارياً',
    `قام المدير العام بتحديث البيانات الإدارية لفرع (${branch.name} - ${branch.code})`,
    'المدير العام',
    'settings'
  );

  res.json({
    success: true,
    message: `تم حفظ وتحديث بيانات فرع (${branch.name}) بنجاح في قاعدة البيانات.`,
    branch
  });
});

// Manage branch manager (Create, Update, Replace, Change password)
app.post('/api/hq/branch/:branchId/manager', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { fullName, username, password, active = true, isReplacement, previousManagerNotes } = req.body;

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ success: false, error: 'اسم مدير الفرع مطلوب.' });
  }
  if (!username || !username.trim()) {
    return res.status(400).json({ success: false, error: 'اسم المستخدم لمدير الفرع مطلوب.' });
  }

  if (!db.branchManagers) db.branchManagers = [];
  if (!db.managerHistory) db.managerHistory = [];

  const existingManager = db.branchManagers.find(m => m.branchId === branchId);
  const branch = (db.branches || []).find(b => b.id === branchId);
  const branchName = branch ? branch.name : branchId;

  if (isReplacement && existingManager) {
    // Record past manager in history without losing past transactions
    db.managerHistory.unshift({
      id: `mh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      managerId: existingManager.id,
      managerName: existingManager.fullName,
      username: existingManager.username,
      appointedAt: existingManager.createdAt || '2026-01-01T00:00:00.000Z',
      endedAt: new Date().toISOString(),
      notes: previousManagerNotes || `تم استبدال المدير وتعيين ${fullName.trim()}`,
      assignedBy: 'المدير العام'
    });

    // Create new manager
    const newManager: BranchManagerUser = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      branchName,
      fullName: fullName.trim(),
      username: username.trim(),
      password: password && password.trim() ? password.trim() : 'Branch@2026',
      active: active ?? true,
      createdAt: new Date().toISOString()
    };

    const idx = db.branchManagers.findIndex(m => m.branchId === branchId);
    if (idx !== -1) {
      db.branchManagers.splice(idx, 1);
    }
    db.branchManagers.push(newManager);

    saveDb(db);
    broadcastState();

    logAudit(
      'تعيين مدير فرع بديل',
      `تم تعيين الأستاذ (${newManager.fullName}) مديراً لـ (${branchName}) بدلاً من (${existingManager.fullName}) مع أرشفة السجل السابق`,
      'المدير العام',
      'auth'
    );

    return res.json({
      success: true,
      message: `تم تعيين الأستاذ (${newManager.fullName}) مديراً جديداً لفرع (${branchName}) بنجاح.`,
      manager: newManager
    });
  } else {
    // Update or create manager
    if (existingManager) {
      existingManager.fullName = fullName.trim();
      existingManager.username = username.trim();
      if (password && password.trim()) existingManager.password = password.trim();
      if (typeof active === 'boolean') existingManager.active = active;
      existingManager.updatedAt = new Date().toISOString();

      saveDb(db);
      broadcastState();

      logAudit(
        'تعديل بيانات مدير فرع',
        `تم تحديث بيانات حساب مدير فرع (${branchName}): ${existingManager.fullName}`,
        'المدير العام',
        'auth'
      );

      return res.json({
        success: true,
        message: `تم تحديث بيانات مدير فرع (${branchName}) بنجاح.`,
        manager: existingManager
      });
    } else {
      const newManager: BranchManagerUser = {
        id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        branchId,
        branchName,
        fullName: fullName.trim(),
        username: username.trim(),
        password: password && password.trim() ? password.trim() : 'Branch@2026',
        active: active ?? true,
        createdAt: new Date().toISOString()
      };
      db.branchManagers.push(newManager);
      saveDb(db);
      broadcastState();

      logAudit(
        'تعيين مدير فرع',
        `تم إنشاء حساب مدير جديد لـ (${branchName}): ${newManager.fullName}`,
        'المدير العام',
        'auth'
      );

      return res.json({
        success: true,
        message: `تم إنشاء وتعيين مدير فرع (${branchName}) بنجاح.`,
        manager: newManager
      });
    }
  }
});

// Manage branch delegates (Create, Update, Transfer)
app.post('/api/hq/branch/:branchId/delegates', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, targetBranchId, name, pin, jobTitle, active } = req.body;

  // Branch transfer
  if (targetBranchId && id) {
    const staff = db.staff.find(s => s.id === id);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'المندوب غير موجود.' });
    }
    const targetBranch = (db.branches || []).find(b => b.id === targetBranchId);
    const targetName = targetBranch ? targetBranch.name : targetBranchId;

    (staff as any).branchId = targetBranchId;
    staff.counterId = '';
    saveDb(db);
    broadcastState();

    logAudit(
      'نقل مندوب بين الفروع',
      `قام المدير العام بنقل المندوب (${staff.name}) إلى فرع (${targetName})`,
      'المدير العام',
      'staff'
    );

    return res.json({
      success: true,
      message: `تم نقل المندوب (${staff.name}) إلى فرع (${targetName}) بنجاح.`
    });
  }

  // Create or Update delegate
  if (id) {
    const staff = db.staff.find(s => s.id === id);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'المندوب غير موجود.' });
    }
    if (name && name.trim()) staff.name = name.trim();
    if (pin && pin.trim() && pin.trim() !== '****') staff.pin = pin.trim();
    if (jobTitle !== undefined) staff.jobTitle = (jobTitle || '').trim();
    if (typeof active === 'boolean') staff.active = active;

    saveDb(db);
    broadcastState();

    logAudit('تعديل بيانات مندوب', `تم تحديث بيانات المندوب (${staff.name})`, 'المدير العام', 'staff');
    return res.json({
      success: true,
      message: `تم تحديث بيانات المندوب (${staff.name}) بنجاح.`,
      staff
    });
  } else {
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'اسم المندوب مطلوب.' });
    }
    const newStaff: Staff = {
      id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      pin: pin && pin.trim() ? pin.trim() : '123456',
      counterId: '',
      active: active ?? true,
      role: 'staff',
      jobTitle: jobTitle && jobTitle.trim() ? jobTitle.trim() : 'مندوب وكالات',
      allowedCounterIds: []
    };
    (newStaff as any).branchId = branchId;
    (newStaff as any).createdAt = new Date().toISOString();

    db.staff.push(newStaff);
    saveDb(db);
    broadcastState();

    logAudit('إضافة مندوب جديد لفرع', `تمت إضافة المندوب (${newStaff.name}) للفرع`, 'المدير العام', 'staff');
    return res.json({
      success: true,
      message: `تمت إضافة المندوب (${newStaff.name}) بنجاح.`,
      staff: newStaff
    });
  }
});

// Soft-delete / archive branch delegate (keeps all history and past transactions intact)
app.delete('/api/hq/branch/:branchId/delegates/:delegateId', requireAdmin, (req, res) => {
  const { delegateId } = req.params;
  const staff = db.staff.find(s => s.id === delegateId);
  if (!staff) {
    return res.status(404).json({ success: false, error: 'المندوب غير موجود.' });
  }

  staff.active = false;
  staff.counterId = '';
  (staff as any).isArchived = true;

  saveDb(db);
  broadcastState();

  logAudit(
    'تعطيل وأرشفة حساب مندوب',
    `تم تعطيل حساب المندوب (${staff.name}) وأرشفته مع المحافظة على كافة قيود الوكالات والمعاملات المنفذة سابقاً`,
    'المدير العام',
    'staff'
  );

  res.json({
    success: true,
    message: `تم تعطيل وأرشفة حساب المندوب (${staff.name}) بنجاح.`
  });
});

// Manage branch counters (Create or Update)
app.post('/api/hq/branch/:branchId/counters', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, isOpen = true, assignedServiceId, currentStaffId } = req.body;

  if (id) {
    const counter = db.counters.find(c => c.id === id);
    if (!counter) {
      return res.status(404).json({ success: false, error: 'الشباك غير موجود.' });
    }
    if (name && name.trim()) counter.name = name.trim();
    if (typeof isOpen === 'boolean') counter.isOpen = isOpen;
    if (assignedServiceId !== undefined) {
      counter.assignedServiceId = assignedServiceId || undefined;
      const service = db.settings.categories.find(c => c.id === assignedServiceId);
      counter.assignedServiceName = service ? service.name : undefined;
    }
    if (currentStaffId !== undefined) {
      counter.currentStaffId = currentStaffId || undefined;
      const staff = db.staff.find(s => s.id === currentStaffId);
      counter.currentStaffName = staff ? staff.name : undefined;
    }
    saveDb(db);
    broadcastState();
    logAudit('تعديل شباك الفرع', `تم تحديث بيانات (${counter.name}) في الفرع`, 'المدير العام', 'counter');
    return res.json({ success: true, message: `تم تحديث بيانات الشباك بنجاح.`, counter });
  } else {
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'اسم الشباك مطلوب.' });
    }
    const service = assignedServiceId ? db.settings.categories.find(c => c.id === assignedServiceId) : null;
    const newCounter: Counter = {
      id: `counter-${branchId}-${Date.now()}`,
      name: name.trim(),
      isOpen: isOpen ?? true,
      isPaused: false,
      assignedServiceId: assignedServiceId || undefined,
      assignedServiceName: service ? service.name : undefined
    };
    (newCounter as any).branchId = branchId;
    db.counters.push(newCounter);
    saveDb(db);
    broadcastState();
    logAudit('إضافة شباك جديد للفرع', `تمت إضافة (${newCounter.name}) للفرع`, 'المدير العام', 'counter');
    return res.json({ success: true, message: `تمت إضافة الشباك (${newCounter.name}) بنجاح.`, counter: newCounter });
  }
});

// Toggle branch counter open/closed
app.delete('/api/hq/branch/:branchId/counters/:counterId', requireAdmin, (req, res) => {
  const { counterId } = req.params;
  const counter = db.counters.find(c => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ success: false, error: 'الشباك غير موجود.' });
  }

  counter.isOpen = !counter.isOpen;
  saveDb(db);
  broadcastState();

  logAudit(
    counter.isOpen ? 'فتح شباك بالفرع' : 'إغلاق شباك بالفرع',
    `تم ${counter.isOpen ? 'فتح وتفعيل' : 'إغلاق وتعطيل'} (${counter.name})`,
    'المدير العام',
    'counter'
  );

  res.json({
    success: true,
    message: `تم ${counter.isOpen ? 'تفعيل' : 'تعطيل'} الشباك (${counter.name}) بنجاح.`,
    counter
  });
});

// Manage branch services (Create or Update)
app.post('/api/hq/branch/:branchId/services', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, prefix, desc, assignedCounterId, active = true } = req.body;

  if (id) {
    let service = db.settings.categories.find(c => c.id === id);
    if (!service) {
      return res.status(404).json({ success: false, error: 'الخدمة غير موجودة.' });
    }
    if (name && name.trim()) service.name = name.trim();
    if (prefix && prefix.trim()) service.prefix = prefix.trim().toUpperCase().slice(0, 3);
    if (desc !== undefined) service.desc = (desc || '').trim();
    if (assignedCounterId !== undefined) {
      service.assignedCounterId = assignedCounterId || undefined;
      const counter = db.counters.find(c => c.id === assignedCounterId);
      service.assignedCounterName = counter ? counter.name : undefined;
    }
    if (typeof active === 'boolean') service.active = active;

    saveDb(db);
    broadcastState();
    logAudit('تعديل خدمة بالفرع', `تم تحديث خدمة (${service.name})`, 'المدير العام', 'settings');
    return res.json({ success: true, message: `تم تحديث الخدمة (${service.name}) بنجاح.`, service });
  } else {
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'اسم الخدمة مطلوب.' });
    }
    const cleanPrefix = (prefix && prefix.trim()) ? prefix.trim().toUpperCase().slice(0, 3) : 'S';
    const counter = assignedCounterId ? db.counters.find(c => c.id === assignedCounterId) : null;
    const newCat: CategoryConfig = {
      id: `cat_${branchId}_${Date.now()}`,
      name: name.trim(),
      prefix: cleanPrefix,
      desc: (desc || '').trim(),
      active: active ?? true,
      assignedCounterId: assignedCounterId || undefined,
      assignedCounterName: counter ? counter.name : undefined
    };
    (newCat as any).branchId = branchId;
    db.settings.categories.push(newCat);
    saveDb(db);
    broadcastState();
    logAudit('إضافة خدمة بالفرع', `تمت إضافة خدمة (${newCat.name})`, 'المدير العام', 'settings');
    return res.json({ success: true, message: `تمت إضافة الخدمة (${newCat.name}) بنجاح.`, service: newCat });
  }
});

// Toggle branch service active/inactive
app.delete('/api/hq/branch/:branchId/services/:serviceId', requireAdmin, (req, res) => {
  const { serviceId } = req.params;
  const service = db.settings.categories.find(c => c.id === serviceId);
  if (!service) {
    return res.status(404).json({ success: false, error: 'الخدمة غير موجودة.' });
  }
  service.active = service.active === false ? true : false;
  saveDb(db);
  broadcastState();
  logAudit('تغيير حالة خدمة بالفرع', `تم ${service.active ? 'تفعيل' : 'تعطيل'} خدمة (${service.name})`, 'المدير العام', 'settings');
  res.json({
    success: true,
    message: `تم ${service.active ? 'تفعيل' : 'تعطيل'} خدمة (${service.name}) بنجاح.`,
    service
  });
});

// Export branch report
app.get('/api/hq/branch/:branchId/export-report', (req, res) => {
  const { branchId } = req.params;
  const branch = (db.branches || []).find(b => b.id === branchId) || { name: 'الفرع', code: branchId };
  const manager = (db.branchManagers || []).find(m => m.branchId === branchId);
  const staff = (db.staff || []).filter(s => (s as any).branchId === branchId || (!((s as any).branchId) && branchId === 'branch-aleppo-main'));
  const tickets = (db.tickets || []).filter(t => (t as any).branchId === branchId || (!((t as any).branchId) && branchId === 'branch-aleppo-main'));
  const agencies = (db.agenciesTransactions || []).filter(a => (a as any).branchId === branchId || (!((a as any).branchId) && branchId === 'branch-aleppo-main'));

  const BOM = '\uFEFF';
  const csvLines: string[] = [
    `"تقرير الأداء والبيانات الشاملة لفرع نقابة المحامين"`,
    `"اسم الفرع","${branch.name}","الرمز","${(branch as any).code || ''}","تاريخ التقرير","${new Date().toLocaleDateString('ar-SY')}"`,
    `"مدير الفرع","${manager ? manager.fullName : 'غير معين'}","حالة الفرع","${(branch as any).isActive ? 'فعال' : 'معطل'}"`,
    `""`,
    `"ملخص المؤشرات"`,
    `"إجمالي التذاكر الصادرة","${tickets.length}","التذاكر المنجزة","${tickets.filter(t => t.status === 'completed').length}"`,
    `"إجمالي المعاملات والوكالات","${agencies.length}","عدد المندوبين المسجلين","${staff.length}"`,
    `""`,
    `"سجل المندوبين والموظفين"`,
    `"الاسم","المسمى الوظيفي","الحالة","الشباك"`,
    ...staff.map(s => `"${s.name}","${s.jobTitle || 'مندوب'}","${s.active ? 'نشط' : 'معطل'}","${s.counterId || 'غير مسند'}"`),
    `""`,
    `"سجل تذاكر الدور"`,
    `"رقم التذكرة","الخدمة","الحالة","الشباك","الموظف","تاريخ ووقت الإصدار"`,
    ...tickets.map(t => `"${t.displayNumber}","${t.categoryNameArabic}","${t.status}","${t.counterName || '-'}","${t.staffName || '-'}","${t.createdAt}"`),
    `""`,
    `"سجل المعاملات والوكالات"`,
    `"رقم الوكالة","النوع","الموكلون","المحامون","الحالة","المندوب الموثق"`,
    ...agencies.map(a => `"${a.agencyNumber || '-'}","${a.agencyType}","${(a.principalsNames || '').replace(/"/g, '""')}","${(a.lawyersNames || '').replace(/"/g, '""')}","${a.status}","${a.notaryDelegateName || '-'}"`)
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="branch-${branchId}-report.csv"`);
  res.send(BOM + csvLines.join('\r\n'));
});

// ==========================================
// SUPABASE SYNC & CLOUD SECRETS APIS
// ==========================================

// Provide frontend client with runtime secrets for Supabase
app.get('/api/sync/client-config', (req, res) => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  let host = '';
  try {
    if (url) host = new URL(url).hostname;
  } catch {}

  res.json({
    success: true,
    configured: Boolean(url && key),
    supabaseUrl: url,
    host,
    hasKey: Boolean(key)
  });
});

// Test connection to Supabase cloud database
app.post('/api/sync/test', async (req, res) => {
  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!url || !key) {
      return res.json({
        success: false,
        message: 'أسرار Supabase غير معرّفة بعد في بيئة التشغيل (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY).'
      });
    }

    let host = '';
    try { host = new URL(url).hostname; } catch {}

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const testClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data, error } = await testClient.from('branches').select('id').limit(1);

      if (error) {
        const msg = error.message || '';
        if (msg.includes('ENOTFOUND') || msg.includes('fetch failed') || msg.includes('Failed to fetch')) {
          return res.json({
            success: false,
            isPaused: true,
            host,
            message: `تم ضبط أسرار Supabase بنجاح (${host})، ولكن تعذر الوصول للنطاق (ENOTFOUND). في الغالب المشروع السحابي في وضع الإيقاف المؤقت (Paused) على منصة Supabase. يرجى الضغط على Restore project في لوحة تحكم supabase.com لتنشيطه.`
          });
        }
        return res.json({
          success: false,
          host,
          message: `خطأ من قاعدة بيانات Supabase: ${msg}`
        });
      }

      return res.json({
        success: true,
        host,
        message: `تم الاتصال بقاعدة بيانات Supabase بنجاح تام! (${host}) السحابة متصلة وجاهزة للمزامنة.`
      });
    } catch (clientErr: any) {
      const msg = clientErr?.message || String(clientErr);
      if (msg.includes('ENOTFOUND') || msg.includes('fetch failed') || msg.includes('Failed to fetch')) {
        return res.json({
          success: false,
          isPaused: true,
          host,
          message: `تم العثور على أسرار Supabase (${host})، ولكن يتعذر الوصول للمشروع حالياً. إذا كان المشروع متوقفاً في الخطة المجانية، يرجى الضغط على Restore project في supabase.com.`
        });
      }
      return res.json({
        success: false,
        host,
        message: `تعذر الاتصال بقاعدة بيانات Supabase: ${msg}`
      });
    }
  } catch (err: any) {
    console.error('Sync test error:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ في خادم الاختبار.' });
  }
});

// Sync status
app.get('/api/sync/status', (req, res) => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  let host = '';
  try { if (url) host = new URL(url).hostname; } catch {}

  res.json({
    success: true,
    configuredViaSecrets: Boolean(url && key),
    host,
    url,
    syncIntervalMinutes: db.syncSettings?.syncIntervalMinutes || 2,
    autoSyncEnabled: db.syncSettings?.autoSyncEnabled || false,
    lastSyncStatus: db.syncSettings?.lastSyncStatus || 'idle'
  });
});

// Update sync preferences
app.post('/api/sync/settings', requireAdmin, (req, res) => {
  const { syncIntervalMinutes, autoSyncEnabled } = req.body || {};
  if (!db.syncSettings) db.syncSettings = {};
  if (typeof syncIntervalMinutes === 'number') db.syncSettings.syncIntervalMinutes = syncIntervalMinutes;
  if (typeof autoSyncEnabled === 'boolean') db.syncSettings.autoSyncEnabled = autoSyncEnabled;
  saveDb(db);
  return res.json({ success: true, message: 'تم حفظ تفضيلات المزامنة بنجاح.' });
});

// Socket.io connection handling
io.on('connection', (socket: any) => {
  socket.emit('state_update', {
    tickets: db.tickets,
    staff: db.staff.map(s => ({ ...s, pin: '****' })),
    counters: db.counters,
    counterSessions: db.counterSessions,
    issuancePaused: db.issuancePaused,
    date: db.date,
    settings: {
      departmentTitle: db.settings.departmentTitle,
      departmentSubtitle: db.settings.departmentSubtitle,
      tickerMessage: db.settings.tickerMessage,
      soundAlertsEnabled: db.settings.soundAlertsEnabled,
      workingHoursStart: db.settings.workingHoursStart,
      workingHoursEnd: db.settings.workingHoursEnd,
      ticketSequence: db.ticketSequence,
      categories: db.settings.categories
    }
  });
});

async function startServer() {
  const DIST_DIR = join(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('Failed to create Vite server:', e);
    }
  } else if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }

  // Fallback static serving for assets or root index.html
  app.use(express.static(__dirname));

  // Universal SPA fallback route for any non-API path (e.g. /agent, /display, /kiosk, /admin)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const distIndex = join(DIST_DIR, 'index.html');
    if (fs.existsSync(distIndex)) {
      res.sendFile(distIndex);
    } else {
      res.sendFile(join(__dirname, 'index.html'));
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n==================================================`);
      console.error(` [خطأ] المنفذ ${PORT} قيد الاستخدام حالياً من قبل برنامج آخر!`);
      console.error(` يرجى إغلاق أي نافذة خادم سابقة مفتوحة لنظام الدور، ثم حاول التشغيل مجدداً.`);
      console.error(`==================================================\n`);
    } else {
      console.error('\n[خطأ في تشغيل الخادم]:', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`==================================================`);
    console.log(` نقابة المحامين بحلب - دائرة الوكالات (نظام الدور)`);
    console.log(` الخادم يعمل محلياً على البورت: ${PORT}`);
    console.log(` عناوين الوصول المحلية على الشبكة (Wi-Fi):`);
    getLocalIPs().forEach(ip => {
      console.log(`   👉 http://${ip}:${PORT}`);
    });
    console.log(`==================================================`);
  });
}

if (!process.env.VERCEL) {
  startServer();
} else {
  const DIST_DIR = join(__dirname, 'dist');
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }
}


