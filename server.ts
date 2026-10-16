/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { SyncService } from './src/syncService';
import { AgencyTransaction, TransactionAttachment, BranchManagerUser, Branch, ManagerHistoryRecord, BranchComprehensiveDetails } from './src/types';

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

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
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
  branchId?: string;
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
}

interface Staff {
  id: string;
  branchId?: string;
  name: string;
  pin: string;
  counterId: string;
  active: boolean;
  role: 'staff' | 'admin';
  jobTitle?: string;
  allowedCounterIds?: string[];
  createdAt?: string;
}

interface Counter {
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

interface CounterSession {
  id: string;
  branchId?: string;
  staffId: string;
  staffName: string;
  counterId: string;
  counterName: string;
  startedAt: string;
  endedAt?: string;
}

interface CategoryConfig {
  id: string;
  branchId?: string;
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
  branchId?: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
  category?: 'ticket' | 'counter' | 'staff' | 'settings' | 'auth' | 'system' | 'sync';
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
  syncQueue?: any[];
  syncHistory?: any[];
  syncSettings?: any;
  agenciesTransactions?: AgencyTransaction[];
  branchManagers?: BranchManagerUser[];
  branches?: Branch[];
  managerHistory?: ManagerHistoryRecord[];
}

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const defaultBranches: Branch[] = [
  {
    id: 'branch-aleppo-main',
    name: 'المقر الرئيسي - القصر العدلي بحلب',
    code: 'ALP-MAIN',
    city: 'حلب',
    address: 'القصر العدلي - دائرة تنظيم الوكالات',
    phone: '021-2244000',
    isHeadquarters: true,
    isActive: true,
    notes: 'المقر الرئيسي المركزي لدائرة تنظيم الوكالات ونظام الدور',
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
];

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
  branches: defaultBranches,
  managerHistory: []
};

function loadDb(): DatabaseSchema {
  const primaryDbPath = join(process.cwd(), 'data', 'queue_db.json');
  
  // 1. Primary database: Directly load the manager's active database file
  if (fs.existsSync(primaryDbPath)) {
    try {
      const raw = fs.readFileSync(primaryDbPath, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && typeof parsed === 'object' && parsed.settings) {
        DB_FILE = primaryDbPath;
        if (!parsed.branchManagers || !Array.isArray(parsed.branchManagers) || parsed.branchManagers.length === 0) {
          parsed.branchManagers = defaultDb.branchManagers;
        }
        if (!parsed.branches || !Array.isArray(parsed.branches) || parsed.branches.length === 0) {
          parsed.branches = defaultBranches;
        }
        if (!parsed.managerHistory || !Array.isArray(parsed.managerHistory)) {
          parsed.managerHistory = [];
        }
        if (Array.isArray(parsed.staff)) {
          parsed.staff.forEach(s => {
            if (!s.branchId) s.branchId = 'branch-aleppo-main';
          });
        }
        if (Array.isArray(parsed.counters)) {
          parsed.counters.forEach(c => {
            if (!c.branchId) c.branchId = 'branch-aleppo-main';
          });
        }
        if (parsed.settings && Array.isArray(parsed.settings.categories)) {
          parsed.settings.categories.forEach(cat => {
            if (!cat.branchId) cat.branchId = 'branch-aleppo-main';
          });
        }
        // Mirror to backup locations safely
        saveDb(parsed);
        return parsed;
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
          saveDb(parsed);
          return parsed;
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
if (!db.branchManagers || !Array.isArray(db.branchManagers) || db.branchManagers.length === 0) {
  db.branchManagers = defaultDb.branchManagers;
  saveDb(db);
}
if (!db.branches || !Array.isArray(db.branches) || db.branches.length === 0) {
  db.branches = defaultBranches;
  saveDb(db);
}
if (!db.managerHistory || !Array.isArray(db.managerHistory)) {
  db.managerHistory = [];
  saveDb(db);
}

// Instantiate Sync Service for offline local queue and Supabase integration
const syncService = new SyncService(db, saveDb, broadcastState);

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
  const pendingSyncCount = (db.syncQueue || []).filter((q: any) => q.syncStatus === 'pending').length;
  io.emit('state_update', {
    tickets: db.tickets,
    staff: db.staff.map(s => ({ ...s, pin: '****' })),
    counters: db.counters,
    counterSessions: db.counterSessions,
    issuancePaused: db.issuancePaused,
    date: db.date,
    syncSettings: syncService.getSettings(),
    pendingSyncCount,
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

  // Enqueue in sync queue for cloud sync
  try {
    syncService.enqueue('audit_log', log.id, 'INSERT', log);
  } catch {}
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
      return next();
    }

    // 3. Persisted database tokens check
    if (db && Array.isArray((db as any).activeTokens) && (db as any).activeTokens.includes(token)) {
      activeAdminTokens.add(token);
      return next();
    }

    // 4. Any validly-formatted system issued token (e.g. admin-token-* or agency-admin-* or branch-token-*)
    // Prevents session loss when server reboots or reloads during active manager work
    if (typeof token === 'string' && (token.startsWith('admin-token-') || token.startsWith('agency-admin-') || token.startsWith('branch-token-'))) {
      activeAdminTokens.add(token);
      if (!db.activeTokens) (db as any).activeTokens = [];
      if (!(db as any).activeTokens.includes(token)) {
        (db as any).activeTokens.push(token);
        saveDb(db);
      }
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
  const pendingSyncCount = (db.syncQueue || []).filter((q: any) => q.syncStatus === 'pending').length;
  res.json({
    tickets: db.tickets,
    staff: db.staff.map(s => ({ ...s, pin: '****' })),
    counters: db.counters,
    counterSessions: db.counterSessions,
    issuancePaused: db.issuancePaused,
    date: db.date,
    localIPs: getLocalIPs(),
    port: PORT,
    appUrl: process.env.APP_URL || '',
    syncSettings: syncService.getSettings(),
    pendingSyncCount,
    agenciesTransactions: db.agenciesTransactions || [],
    syncHistory: (db.syncHistory || []).slice(0, 20),
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

  try {
    syncService.enqueue('ticket', newTicket.id, 'INSERT', newTicket);
  } catch {}

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

  try {
    syncService.enqueue('ticket', nextTicket.id, 'UPDATE', nextTicket);
  } catch {}

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

  try {
    syncService.enqueue('ticket', ticket.id, 'UPDATE', ticket);
  } catch {}

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

  try {
    syncService.enqueue('ticket', ticket.id, 'UPDATE', ticket);
  } catch {}

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

  try {
    syncService.enqueue('ticket', ticket.id, 'UPDATE', ticket);
  } catch {}

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
    const pin = req.body?.pin;
    const correctPin = db?.settings?.adminPin || '9999';

    if (!pin || pin !== correctPin) {
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
    return res.status(500).json({ error: 'تعذر الاتصال بالخادم (500): A server error has occurred' });
  }
});

// ==========================================
// BRANCH MANAGERS AUTHENTICATION & MANAGEMENT
// ==========================================

// Branch Manager Login (requires unique username and manager password)
app.post('/api/branch-manager/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور لمدير الفرع.' });
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();

    if (!db.branchManagers || !Array.isArray(db.branchManagers) || db.branchManagers.length === 0) {
      db.branchManagers = defaultDb.branchManagers;
      saveDb(db);
    }

    // Check if entered password matches a staff/delegate PIN
    const isStaffPin = (db.staff || []).some(s => s.pin === cleanPass);
    const managers = db.branchManagers || [];
    const manager = managers.find(
      bm => bm.username.toLowerCase() === cleanUser.toLowerCase() && bm.password === cleanPass
    );

    if (isStaffPin && (!manager || manager.password !== cleanPass)) {
      return res.status(401).json({ 
        error: 'رمز المندوب أو موظف الشباك لا يخول الدخول كمدير فرع! لكل مدير فرع اسم مستخدم وكلمة مرور خاصة ومستقلة تماماً تُعرّف من قبل الإدارة المركزية.' 
      });
    }

    if (!manager) {
      return res.status(401).json({ 
        error: 'اسم المستخدم أو كلمة المرور لمدير الفرع غير صحيحة. يتم تعريف حسابات مدراء الفروع وتحديد كلمات مرورهم حصراً من قبل الإدارة المركزية.' 
      });
    }

    if (!manager.active) {
      return res.status(403).json({ error: 'تم تعطيل حساب هذا المدير من قبل الإدارة المركزية.' });
    }

    manager.lastLoginAt = new Date().toISOString();
    saveDb(db);

    const token = `branch-token-${manager.id}-${Date.now()}`;
    activeAdminTokens.add(token);
    if (!db.activeTokens) (db as any).activeTokens = [];
    (db as any).activeTokens.push(token);
    saveDb(db);

    logAudit(
      'تسجيل دخول مدير فرع',
      `تم تسجيل الدخول لمدير الفرع: ${manager.fullName} (${manager.branchName})`,
      manager.fullName,
      'auth'
    );

    return res.json({
      success: true,
      token,
      manager: {
        id: manager.id,
        fullName: manager.fullName,
        username: manager.username,
        branchId: manager.branchId,
        branchName: manager.branchName
      }
    });
  } catch (err: any) {
    console.error('Branch manager login error:', err);
    return res.status(500).json({ error: 'حدث خطأ في الخادم أثناء تسجيل الدخول.' });
  }
});

// Central HQ: Get all branch managers
app.get('/api/admin/branch-managers', (req, res) => {
  const managers = (db.branchManagers || []).map(m => ({
    id: m.id,
    branchId: m.branchId,
    branchName: m.branchName,
    fullName: m.fullName,
    username: m.username,
    password: m.password,
    active: m.active,
    createdAt: m.createdAt,
    lastLoginAt: m.lastLoginAt
  }));
  res.json({ success: true, data: managers });
});

// Central HQ: Create or update branch manager
app.post('/api/admin/branch-managers', (req, res) => {
  try {
    const { id, branchId, branchName, fullName, username, password, active } = req.body;
    if (!branchId || !fullName || !username || !password) {
      return res.status(400).json({ error: 'يرجى استكمال جميع بيانات حساب المدير (الفرع، الاسم، اسم المستخدم، كلمة المرور).' });
    }

    if (!db.branchManagers) db.branchManagers = [];

    const existingIdx = id ? db.branchManagers.findIndex(m => m.id === id) : -1;
    const usernameConflict = db.branchManagers.find(
      m => m.username.toLowerCase() === username.trim().toLowerCase() && m.id !== id
    );

    if (usernameConflict) {
      return res.status(400).json({ error: 'اسم المستخدم هذا مستخدم مسبقاً، يرجى اختيار اسم مستخدم آخر.' });
    }

    if (existingIdx >= 0) {
      db.branchManagers[existingIdx] = {
        ...db.branchManagers[existingIdx],
        branchId,
        branchName: branchName || db.branchManagers[existingIdx].branchName,
        fullName: fullName.trim(),
        username: username.trim(),
        password: password.trim(),
        active: active !== undefined ? !!active : true
      };
      saveDb(db);
      logAudit('تعديل حساب مدير فرع', `تم تحديث بيانات مدير الفرع ${fullName} (${branchName})`, 'الإدارة المركزية', 'auth');
      return res.json({ success: true, message: 'تم تحديث بيانات مدير الفرع بنجاح.', manager: db.branchManagers[existingIdx] });
    } else {
      const newManager: BranchManagerUser = {
        id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        branchId,
        branchName: branchName || 'فرع نقابة المحامين',
        fullName: fullName.trim(),
        username: username.trim(),
        password: password.trim(),
        active: active !== undefined ? !!active : true,
        createdAt: new Date().toISOString()
      };
      db.branchManagers.push(newManager);
      saveDb(db);
      logAudit('إنشاء حساب مدير فرع', `تم إنشاء وتعيين حساب مدير فرع جديد: ${fullName} (${branchName})`, 'الإدارة المركزية', 'auth');
      return res.json({ success: true, message: 'تم إنشاء وتفعيل حساب مدير الفرع بنجاح.', manager: newManager });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'فشل حفظ حساب مدير الفرع.' });
  }
});

// Central HQ: Delete branch manager
app.delete('/api/admin/branch-managers/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!db.branchManagers) db.branchManagers = [];
    const idx = db.branchManagers.findIndex(m => m.id === id);
    if (idx < 0) {
      return res.status(404).json({ error: 'حساب المدير غير موجود.' });
    }
    const deleted = db.branchManagers.splice(idx, 1)[0];
    saveDb(db);
    logAudit('حذف حساب مدير فرع', `تم حذف حساب مدير الفرع: ${deleted.fullName} (${deleted.branchName})`, 'الإدارة المركزية', 'auth');
    res.json({ success: true, message: 'تم حذف حساب المدير بنجاح.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'فشل حذف حساب المدير.' });
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
// CENTRAL SYNC & HQ MONITORING API ROUTES
// ==========================================

// Get current sync settings & status
app.get('/api/sync/settings', (req, res) => {
  const pendingCount = (db.syncQueue || []).filter((q: any) => q.syncStatus === 'pending').length;
  res.json({
    settings: syncService.getSettings(),
    pendingCount,
    history: (db.syncHistory || []).slice(0, 15)
  });
});

// Update sync settings (Admin)
app.post('/api/sync/settings', requireAdmin, (req, res) => {
  const {
    branchId,
    branchName,
    branchCode,
    isHeadquarters,
    supabaseUrl,
    supabaseKey,
    syncIntervalMinutes,
    autoSyncEnabled
  } = req.body;

  syncService.updateSettings({
    branchId: branchId || undefined,
    branchName: branchName || undefined,
    branchCode: branchCode || undefined,
    isHeadquarters: typeof isHeadquarters === 'boolean' ? isHeadquarters : undefined,
    supabaseUrl: typeof supabaseUrl === 'string' ? supabaseUrl.trim() : undefined,
    supabaseKey: typeof supabaseKey === 'string' ? supabaseKey.trim() : undefined,
    syncIntervalMinutes: syncIntervalMinutes ? parseInt(syncIntervalMinutes) : undefined,
    autoSyncEnabled: typeof autoSyncEnabled === 'boolean' ? autoSyncEnabled : undefined
  });

  logAudit(
    'تحديث إعدادات المزامنة السحابية',
    `قام المدير العام بتحديث إعدادات الربط السحابي (الفرع: ${syncService.getSettings().branchName})`,
    'المدير العام',
    'sync'
  );

  res.json({
    success: true,
    message: 'تم حفظ وتطبيق إعدادات المزامنة السحابية بنجاح.',
    settings: syncService.getSettings()
  });
});

// Test connection to Supabase
app.post('/api/sync/test', async (req, res) => {
  const { supabaseUrl, supabaseKey } = req.body;
  const result = await syncService.testConnection(supabaseUrl, supabaseKey);
  res.json(result);
});

// Trigger Branch Push to Cloud
app.post('/api/sync/push', async (req, res) => {
  try {
    const result = await syncService.pushBranchData();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'خطأ في عملية المزامنة.' });
  }
});

// Trigger HQ Pull of all branches (Online or Offline Local Cache Fallback)
app.post('/api/sync/pull-hq', async (req, res) => {
  try {
    const result = await syncService.pullAllBranchesDataToHQ();
    res.json(result);
  } catch (err: any) {
    console.error('SERVER_ERROR [/api/sync/pull-hq]:', err);
    res.status(500).json({ success: false, message: err.message || 'خطأ في جلب بيانات الفروع.' });
  }
});

// Get Headquarters aggregated branches data (Reads persistent db.branches or local disk cache if offline)
app.get('/api/hq/branches-data', (req, res) => {
  const cached = syncService.loadHQLocalCache();

  const branchesList = (db.branches && db.branches.length > 0 ? db.branches : defaultBranches).map(b => {
    const branchTickets = (db.tickets || []).filter((t: any) => (t.branchId || 'branch-aleppo-main') === b.id);
    const completedCount = branchTickets.filter((t: any) => t.status === 'completed').length;
    const activeStaff = (db.counters || []).filter((c: any) => (c.branchId || 'branch-aleppo-main') === b.id && c.currentStaffId).length;
    const branchAgencies = (db.agenciesTransactions || []).filter((a: any) => (a.branchId || 'branch-aleppo-main') === b.id);

    return {
      ...b,
      todayTicketsCount: branchTickets.length,
      todayCompletedCount: completedCount,
      activeStaffCount: activeStaff,
      totalAgenciesCount: branchAgencies.length,
      lastSyncAt: b.lastSyncAt || syncService.getSettings().lastSyncTimestamp
    };
  });

  const ticketsByBranch: Record<string, any[]> = {};
  const agenciesByBranch: Record<string, any[]> = {};
  const auditLogsByBranch: Record<string, any[]> = {};

  branchesList.forEach(b => {
    ticketsByBranch[b.id] = (db.tickets || []).filter((t: any) => (t.branchId || 'branch-aleppo-main') === b.id);
    agenciesByBranch[b.id] = (db.agenciesTransactions || []).filter((a: any) => (a.branchId || 'branch-aleppo-main') === b.id);
    auditLogsByBranch[b.id] = (db.auditLogs || []).filter((au: any) => (au.branchId || 'branch-aleppo-main') === b.id || au.details?.includes(b.name));
  });

  const aggregatedHQ = {
    lastUpdated: new Date().toISOString(),
    branches: branchesList,
    ticketsByBranch,
    agenciesByBranch,
    auditLogsByBranch,
    summary: {
      totalBranches: branchesList.length,
      activeBranches: branchesList.filter(b => b.isActive).length,
      totalTodayTickets: (db.tickets || []).length,
      totalCompletedTickets: (db.tickets || []).filter((t: any) => t.status === 'completed').length,
      totalAgenciesCount: (db.agenciesTransactions || []).length
    }
  };

  res.json({
    success: true,
    fromLocalCache: cached ? true : false,
    data: aggregatedHQ
  });
});

// ============================================================================
// BRANCH COMPREHENSIVE DETAILS & PERFORMANCE EVALUATION API (CENTRAL HQ)
// ============================================================================

// 1. Get complete details of a specific branch
app.get('/api/hq/branch/:branchId/details', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const branches = db.branches && db.branches.length > 0 ? db.branches : defaultBranches;
  const branch = branches.find(b => b.id === branchId);

  if (!branch) {
    return res.status(404).json({ error: `الفرع المطلوب (${branchId}) غير موجود في النظام.` });
  }

  // Branch Manager
  const manager = (db.branchManagers || []).find(m => m.branchId === branchId) || null;
  const managerHistory = (db.managerHistory || []).filter(h => h.branchId === branchId);

  // Staff and delegates with operational metrics
  const branchStaff = (db.staff || []).filter(s => (s.branchId || 'branch-aleppo-main') === branchId);
  const staffWithStats = branchStaff.map(s => {
    const sAgencies = (db.agenciesTransactions || []).filter(a =>
      (a.branchId || 'branch-aleppo-main') === branchId &&
      (a.notaryDelegateName === s.name || (s.jobTitle && a.notaryDelegateName?.includes(s.name)))
    );
    const sTickets = (db.tickets || []).filter(t =>
      (t.branchId || 'branch-aleppo-main') === branchId &&
      (t.staffId === s.id || t.staffName === s.name)
    );
    const lastAgencyTime = sAgencies[0]?.createdAt;
    const lastTicketTime = sTickets[0]?.completedAt || sTickets[0]?.calledAt || sTickets[0]?.createdAt;
    const lastActive = [lastAgencyTime, lastTicketTime].filter(Boolean).sort().reverse()[0] || s.createdAt;

    return {
      ...s,
      registeredAgenciesCount: sAgencies.length,
      completedAgenciesCount: sAgencies.filter(a => a.status === 'approved').length,
      pendingAgenciesCount: sAgencies.filter(a => a.status === 'pending_review').length,
      ticketsHandledCount: sTickets.length,
      lastActive
    };
  });

  // Counters with operational metrics
  const branchCounters = (db.counters || []).filter(c => (c.branchId || 'branch-aleppo-main') === branchId);
  const countersWithStats = branchCounters.map(c => {
    const cTickets = (db.tickets || []).filter(t =>
      (t.branchId || 'branch-aleppo-main') === branchId && t.counterId === c.id
    );
    const completed = cTickets.filter(t => t.status === 'completed');
    let totalWaitSeconds = 0;
    let waitCount = 0;
    let totalServiceSeconds = 0;
    let serviceCount = 0;

    cTickets.forEach(t => {
      if (t.calledAt && t.createdAt) {
        const diff = (new Date(t.calledAt).getTime() - new Date(t.createdAt).getTime()) / 1000;
        if (diff >= 0 && diff < 86400) {
          totalWaitSeconds += diff;
          waitCount++;
        }
      }
      if (t.completedAt && t.calledAt) {
        const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 1000;
        if (diff >= 0 && diff < 86400) {
          totalServiceSeconds += diff;
          serviceCount++;
        }
      }
    });

    const avgWait = waitCount > 0 ? Math.round(totalWaitSeconds / waitCount) : 0;
    const avgService = serviceCount > 0 ? Math.round(totalServiceSeconds / serviceCount) : 0;
    const remaining = (db.tickets || []).filter(t =>
      (t.branchId || 'branch-aleppo-main') === branchId &&
      t.status === 'waiting' &&
      (t.counterId === c.id || t.category === c.assignedServiceId)
    ).length;

    return {
      ...c,
      ticketsCalledCount: cTickets.filter(t => t.status === 'serving' || t.status === 'completed' || t.status === 'skipped').length,
      ticketsCompletedCount: completed.length,
      avgWaitTimeSeconds: avgWait,
      avgServiceTimeSeconds: avgService,
      remainingTicketsCount: remaining
    };
  });

  // Services with operational metrics
  const branchServices = (db.settings.categories || []).filter(cat => (cat.branchId || 'branch-aleppo-main') === branchId);
  const servicesWithStats = branchServices.map(cat => {
    const sTickets = (db.tickets || []).filter(t => (t.branchId || 'branch-aleppo-main') === branchId && t.category === cat.id);
    const completed = sTickets.filter(t => t.status === 'completed');
    const pending = sTickets.filter(t => t.status === 'waiting' || t.status === 'serving');
    let totalDuration = 0;
    let countDuration = 0;

    completed.forEach(t => {
      if (t.completedAt && t.calledAt) {
        const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 1000;
        if (diff >= 0 && diff < 86400) {
          totalDuration += diff;
          countDuration++;
        }
      }
    });

    return {
      ...cat,
      ticketsCount: sTickets.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      avgServiceTimeSeconds: countDuration > 0 ? Math.round(totalDuration / countDuration) : 0
    };
  });

  // Tickets and Agencies
  const tickets = (db.tickets || []).filter(t => (t.branchId || 'branch-aleppo-main') === branchId);
  const agencies = (db.agenciesTransactions || []).filter(a => (a.branchId || 'branch-aleppo-main') === branchId);
  const auditLogs = (db.auditLogs || []).filter(au => (au.branchId || 'branch-aleppo-main') === branchId || au.details?.includes(branch.name));

  // Comprehensive Metrics
  const completedTickets = tickets.filter(t => t.status === 'completed').length;
  const waitingTickets = tickets.filter(t => t.status === 'waiting').length;
  const servingTickets = tickets.filter(t => t.status === 'serving').length;
  const skippedTickets = tickets.filter(t => t.status === 'skipped').length;
  const completedAgencies = agencies.filter(a => a.status === 'approved').length;
  const pendingAgencies = agencies.filter(a => a.status === 'pending_review').length;
  const totalFeesPaid = agencies.reduce((acc, a) => acc + (Number(a.feesPaid) || 0), 0);

  let totalWaitTime = 0;
  let waitCountTotal = 0;
  let totalServiceTime = 0;
  let serviceCountTotal = 0;

  tickets.forEach(t => {
    if (t.calledAt && t.createdAt) {
      const diff = (new Date(t.calledAt).getTime() - new Date(t.createdAt).getTime()) / 1000;
      if (diff >= 0 && diff < 86400) {
        totalWaitTime += diff;
        waitCountTotal++;
      }
    }
    if (t.completedAt && t.calledAt) {
      const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 1000;
      if (diff >= 0 && diff < 86400) {
        totalServiceTime += diff;
        serviceCountTotal++;
      }
    }
  });

  const avgWaitTimeSeconds = waitCountTotal > 0 ? Math.round(totalWaitTime / waitCountTotal) : 0;
  const avgServiceTimeSeconds = serviceCountTotal > 0 ? Math.round(totalServiceTime / serviceCountTotal) : 0;
  const totalCountForRate = completedTickets + waitingTickets + servingTickets + skippedTickets;
  const completionRatePercentage = totalCountForRate > 0 ? Math.round((completedTickets / totalCountForRate) * 100) : 100;

  const pendingQueueCount = (db.syncQueue || []).filter(q => q.branchId === branchId && q.syncStatus === 'pending').length;

  const responseData: BranchComprehensiveDetails = {
    branch: {
      ...branch,
      todayTicketsCount: tickets.length,
      todayCompletedCount: completedTickets,
      activeStaffCount: countersWithStats.filter(c => c.currentStaffId).length,
      totalAgenciesCount: agencies.length,
      lastSyncAt: branch.lastSyncAt || syncService.getSettings().lastSyncTimestamp
    },
    manager,
    managerHistory,
    staff: staffWithStats,
    counters: countersWithStats,
    services: servicesWithStats,
    tickets,
    agencies,
    auditLogs,
    syncStatus: {
      lastSyncAt: branch.lastSyncAt || syncService.getSettings().lastSyncTimestamp,
      pendingQueueCount,
      isOnline: branch.isActive,
      lastKnownIp: branch.lastKnownIp || '127.0.0.1'
    },
    metrics: {
      totalAgencies: agencies.length,
      completedAgencies,
      pendingAgencies,
      totalFeesPaid,
      totalTickets: tickets.length,
      completedTickets,
      waitingTickets,
      servingTickets,
      skippedTickets,
      avgWaitTimeSeconds,
      avgServiceTimeSeconds,
      completionRatePercentage
    }
  };

  res.json({ success: true, data: responseData });
});

// 2. Update Branch Administrative Data (General Director)
app.put('/api/hq/branch/:branchId', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { name, code, city, address, phone, isActive, notes } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'اسم الفرع مطلوب ولا يمكن تركه فارغاً.' });
  }

  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'رمز الفرع مطلوب لتمييز المعاملات.' });
  }

  const cleanCode = code.trim().toUpperCase();

  if (!db.branches) db.branches = defaultBranches;

  const branchIdx = db.branches.findIndex(b => b.id === branchId);
  if (branchIdx === -1) {
    return res.status(404).json({ error: 'الفرع المطلوب غير موجود في قاعدة البيانات.' });
  }

  // Check unique code constraint across other branches
  const codeConflict = db.branches.find(b => b.id !== branchId && b.code.toUpperCase() === cleanCode);
  if (codeConflict) {
    return res.status(400).json({ error: `رمز الفرع (${cleanCode}) مستخدم مسبقاً من قبل ${codeConflict.name}. يجب أن يكون لكل فرع رمز فريد.` });
  }

  const oldBranch = db.branches[branchIdx];
  const oldName = oldBranch.name;

  db.branches[branchIdx] = {
    ...oldBranch,
    name: name.trim(),
    code: cleanCode,
    city: city ? String(city).trim() : oldBranch.city,
    address: address !== undefined ? String(address).trim() : oldBranch.address,
    phone: phone !== undefined ? String(phone).trim() : oldBranch.phone,
    isActive: typeof isActive === 'boolean' ? isActive : oldBranch.isActive,
    notes: notes !== undefined ? String(notes).trim() : oldBranch.notes
  };

  const updatedBranch = db.branches[branchIdx];

  // Keep branch managers synced with updated branch name
  if (db.branchManagers) {
    db.branchManagers.forEach(m => {
      if (m.branchId === branchId) {
        m.branchName = updatedBranch.name;
      }
    });
  }

  // If this happens to be the locally configured branch in sync settings, keep it updated
  if (syncService.getSettings().branchId === branchId) {
    syncService.updateSettings({
      branchName: updatedBranch.name,
      branchCode: updatedBranch.code
    });
  }

  saveDb(db);
  broadcastState();

  try {
    (syncService as any).enqueue('audit_log', branchId, 'UPDATE', updatedBranch);
  } catch {}

  logAudit(
    'تعديل وحفظ بيانات الفرع',
    `قام المدير العام بتحديث البيانات الإدارية لفرع (${oldName}) ${oldName !== updatedBranch.name ? `إلى (${updatedBranch.name})` : ''} - الحالة: ${updatedBranch.isActive ? 'فعال' : 'معطل'}`,
    'المدير العام',
    'settings'
  );

  res.json({
    success: true,
    message: `تم حفظ وتحديث بيانات فرع (${updatedBranch.name}) في قاعدة البيانات بنجاح.`,
    branch: updatedBranch
  });
});

// 3. Manage Branch Manager (Edit, change password, replace manager, appointment history)
app.post('/api/hq/branch/:branchId/manager', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { fullName, username, password, active, isReplacement, previousManagerNotes } = req.body;

  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    return res.status(400).json({ error: 'اسم مدير الفرع مطلوب.' });
  }

  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'اسم المستخدم مطلوب لحساب المدير.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const branches = db.branches && db.branches.length > 0 ? db.branches : defaultBranches;
  const branch = branches.find(b => b.id === branchId);
  const branchName = branch ? branch.name : 'فرع نقابة المحامين';

  if (!db.branchManagers) db.branchManagers = defaultDb.branchManagers ? [...defaultDb.branchManagers] : [];
  if (!db.managerHistory) db.managerHistory = [];
  const branchManagers = db.branchManagers;

  const currentManager = branchManagers.find(m => m.branchId === branchId);

  // Check username conflicts with other managers
  const usernameConflict = branchManagers.find(
    m => m.username.toLowerCase() === cleanUsername && m.branchId !== branchId
  );
  if (usernameConflict) {
    return res.status(400).json({ error: `اسم المستخدم (${username}) مستخدم مسبقاً لمدير فرع آخر. يرجى اختيار اسم مستخدم فريد.` });
  }

  if (isReplacement && currentManager) {
    // Preserve history of previous manager
    db.managerHistory.unshift({
      id: `mh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      managerId: currentManager.id,
      managerName: currentManager.fullName,
      appointedAt: currentManager.createdAt,
      endedAt: new Date().toISOString(),
      notes: previousManagerNotes || 'تم استبدال المدير وتعيين مدير جديد من قبل المدير العام',
      assignedBy: 'المدير العام'
    });

    // Soft-deactivate previous manager
    currentManager.active = false;

    // Create new manager
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'كلمة المرور مطلوبة لتعيين المدير الجديد.' });
    }

    const newManager: BranchManagerUser = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      branchName,
      fullName: fullName.trim(),
      username: cleanUsername,
      password: password.trim(),
      active: typeof active === 'boolean' ? active : true,
      createdAt: new Date().toISOString()
    };

    // Remove older active entry for this branch or replace
    const currentIdx = branchManagers.findIndex(m => m.id === currentManager.id);
    if (currentIdx !== -1) {
      branchManagers.splice(currentIdx, 1);
    }
    branchManagers.push(newManager);

    saveDb(db);
    broadcastState();

    logAudit(
      'تعيين مدير فرع بديل',
      `قام المدير العام بتعيين (${newManager.fullName}) مديراً لـ (${branchName}) بدلاً من (${currentManager.fullName}) مع أرشفة السجل السابق`,
      'المدير العام',
      'auth'
    );

    return res.json({
      success: true,
      message: `تم تعيين الأستاذ (${newManager.fullName}) مديراً لـ (${branchName}) بنجاح والاحتفاظ بسجل المدير السابق.`,
      manager: newManager,
      managerHistory: db.managerHistory.filter(h => h.branchId === branchId)
    });
  }

  // Standard Edit
  if (currentManager) {
    currentManager.fullName = fullName.trim();
    currentManager.username = cleanUsername;
    if (password && typeof password === 'string' && password.trim()) {
      currentManager.password = password.trim();
    }
    if (typeof active === 'boolean') {
      currentManager.active = active;
    }

    saveDb(db);
    broadcastState();

    logAudit(
      'تحديث بيانات مدير الفرع',
      `تم تحديث بيانات وحساب مدير (${branchName}): ${currentManager.fullName} (الحالة: ${currentManager.active ? 'مفعل' : 'معطل'})`,
      'المدير العام',
      'auth'
    );

    return res.json({
      success: true,
      message: `تم تحديث بيانات وحساب المدير (${currentManager.fullName}) بنجاح.`,
      manager: currentManager
    });
  } else {
    // Create first manager for branch
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'كلمة المرور مطلوبة لحساب المدير الجديد.' });
    }

    const newManager: BranchManagerUser = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      branchName,
      fullName: fullName.trim(),
      username: cleanUsername,
      password: password.trim(),
      active: typeof active === 'boolean' ? active : true,
      createdAt: new Date().toISOString()
    };

    branchManagers.push(newManager);
    saveDb(db);
    broadcastState();

    logAudit(
      'تعيين مدير فرع جديد',
      `تم إنشاء وتعيين حساب مدير فرع: ${newManager.fullName} (${branchName})`,
      'المدير العام',
      'auth'
    );

    return res.json({
      success: true,
      message: `تم إنشاء وتفعيل حساب مدير الفرع (${newManager.fullName}) بنجاح.`,
      manager: newManager
    });
  }
});

// 4. Manage Delegates / Staff of Branch (Add, Edit, Transfer, Toggle Active)
app.post('/api/hq/branch/:branchId/delegates', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, pin, jobTitle, active, allowedCounterIds, targetBranchId } = req.body;

  if (id) {
    const staff = db.staff.find(s => s.id === id);
    if (!staff) {
      return res.status(404).json({ error: 'المندوب غير موجود في النظام.' });
    }

    // Branch transfer action
    if (targetBranchId && targetBranchId !== staff.branchId) {
      const branches = db.branches && db.branches.length > 0 ? db.branches : defaultBranches;
      const targetBranch = branches.find(b => b.id === targetBranchId);
      const targetName = targetBranch ? targetBranch.name : targetBranchId;
      const oldBranchName = branches.find(b => b.id === staff.branchId)?.name || staff.branchId || 'الفرع';

      staff.branchId = targetBranchId;
      staff.counterId = ''; // Release counter in old branch

      saveDb(db);
      broadcastState();

      logAudit(
        'نقل مندوب إدارياً',
        `قام المدير العام بنقل المندوب (${staff.name}) من (${oldBranchName}) إلى (${targetName})`,
        'المدير العام',
        'staff'
      );

      return res.json({
        success: true,
        message: `تم نقل المندوب (${staff.name}) إلى (${targetName}) بنجاح.`,
        staff
      });
    }

    if (name && typeof name === 'string' && name.trim()) staff.name = name.trim();
    if (pin && typeof pin === 'string' && pin.trim() && pin.trim() !== '****') staff.pin = pin.trim();
    if (jobTitle !== undefined && typeof jobTitle === 'string') staff.jobTitle = jobTitle.trim();
    if (typeof active === 'boolean') staff.active = active;
    if (allowedCounterIds !== undefined) staff.allowedCounterIds = allowedCounterIds;

    saveDb(db);
    broadcastState();

    logAudit(
      'تعديل بيانات مندوب',
      `تم تحديث بيانات المندوب (${staff.name}) في الفرع - الحالة: ${staff.active ? 'نشط' : 'معطل'}`,
      'المدير العام',
      'staff'
    );

    return res.json({
      success: true,
      message: `تم حفظ تعديلات المندوب (${staff.name}) بنجاح.`,
      staff
    });
  } else {
    // Create new delegate
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'اسم المندوب مطلوب.' });
    }
    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return res.status(400).json({ error: 'الرمز الشخصي (PIN) مطلوب لحساب المندوب.' });
    }

    const newDelegate: Staff = {
      id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      name: name.trim(),
      pin: pin.trim(),
      counterId: '',
      active: typeof active === 'boolean' ? active : true,
      role: 'staff',
      jobTitle: (jobTitle && typeof jobTitle === 'string' && jobTitle.trim()) ? jobTitle.trim() : 'مندوب وكالات',
      allowedCounterIds: allowedCounterIds || [],
      createdAt: new Date().toISOString()
    };

    db.staff.push(newDelegate);
    saveDb(db);
    broadcastState();

    logAudit(
      'إضافة مندوب جديد للفرع',
      `تمت إضافة المندوب (${newDelegate.name}) كـ (${newDelegate.jobTitle}) في الفرع بنجاح`,
      'المدير العام',
      'staff'
    );

    return res.json({
      success: true,
      message: `تمت إضافة وحفظ المندوب (${newDelegate.name}) بنجاح.`,
      staff: newDelegate
    });
  }
});

// Logical soft delete / archive delegate without deleting previous records
app.delete('/api/hq/branch/:branchId/delegates/:delegateId', requireAdmin, (req, res) => {
  const { delegateId } = req.params;
  const staff = db.staff.find(s => s.id === delegateId);
  if (!staff) {
    return res.status(404).json({ error: 'المندوب غير موجود.' });
  }

  staff.active = false;
  staff.counterId = '';

  // Free any claimed counter
  db.counters.forEach(c => {
    if (c.currentStaffId === delegateId) {
      c.currentStaffId = undefined;
      c.currentStaffName = undefined;
      c.isPaused = false;
      c.claimedAt = undefined;
    }
  });

  saveDb(db);
  broadcastState();

  logAudit(
    'تعطيل وأرشفة حساب مندوب',
    `تم تعطيل حساب (${staff.name}) وأرشفته بأمان مع الاحتفاظ بكافة سجلاته ومعاملاته السابقة دون أي مساس بها`,
    'المدير العام',
    'staff'
  );

  res.json({
    success: true,
    message: `تم تعطيل حساب المندوب (${staff.name}) وأرشفته بنجاح دون المساس بسجلاته التاريخية.`
  });
});

// 5. Manage Counters of Branch (Add, Edit, Assign Staff, Toggle)
app.post('/api/hq/branch/:branchId/counters', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, isOpen, isPaused, assignedServiceId, currentStaffId } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'اسم أو رقم الشباك مطلوب.' });
  }

  const cleanName = name.trim();

  // Check unique counter name/number within the branch
  const existingCounters = db.counters.filter(c => (c.branchId || 'branch-aleppo-main') === branchId);
  const nameConflict = existingCounters.find(c => c.name.toLowerCase() === cleanName.toLowerCase() && c.id !== id);
  if (nameConflict) {
    return res.status(400).json({ error: `اسم أو رقم الشباك (${cleanName}) مستخدم مسبقاً في هذا الفرع. يرجى اختيار اسم أو رقم مميز.` });
  }

  let assignedServiceName: string | undefined = undefined;
  if (assignedServiceId) {
    const service = db.settings.categories.find(cat => cat.id === assignedServiceId);
    if (service) assignedServiceName = service.name;
  }

  if (id) {
    const counter = db.counters.find(c => c.id === id);
    if (!counter) {
      return res.status(404).json({ error: 'الشباك غير موجود.' });
    }

    counter.name = cleanName;
    if (typeof isOpen === 'boolean') counter.isOpen = isOpen;
    if (typeof isPaused === 'boolean') counter.isPaused = isPaused;
    if (assignedServiceId !== undefined) {
      counter.assignedServiceId = assignedServiceId || undefined;
      counter.assignedServiceName = assignedServiceName;
    }

    if (currentStaffId !== undefined) {
      if (currentStaffId) {
        const staff = db.staff.find(s => s.id === currentStaffId);
        if (staff) {
          counter.currentStaffId = staff.id;
          counter.currentStaffName = staff.name;
          counter.claimedAt = new Date().toISOString();
          staff.counterId = counter.id;
        }
      } else {
        if (counter.currentStaffId) {
          const prev = db.staff.find(s => s.id === counter.currentStaffId);
          if (prev) prev.counterId = '';
        }
        counter.currentStaffId = undefined;
        counter.currentStaffName = undefined;
        counter.claimedAt = undefined;
      }
    }

    saveDb(db);
    broadcastState();

    logAudit(
      'تعديل بيانات شباك',
      `تم تحديث بيانات ${counter.name} في الفرع (الخدمة: ${counter.assignedServiceName || 'عامة'})`,
      'المدير العام',
      'counter'
    );

    return res.json({
      success: true,
      message: `تم تحديث بيانات (${counter.name}) بنجاح.`,
      counter
    });
  } else {
    // Create new counter
    const newCounter: Counter = {
      id: `counter-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      name: cleanName,
      isOpen: typeof isOpen === 'boolean' ? isOpen : true,
      isPaused: false,
      assignedServiceId: assignedServiceId || undefined,
      assignedServiceName: assignedServiceName
    };

    if (currentStaffId) {
      const staff = db.staff.find(s => s.id === currentStaffId);
      if (staff) {
        newCounter.currentStaffId = staff.id;
        newCounter.currentStaffName = staff.name;
        newCounter.claimedAt = new Date().toISOString();
        staff.counterId = newCounter.id;
      }
    }

    db.counters.push(newCounter);
    saveDb(db);
    broadcastState();

    logAudit(
      'إضافة شباك جديد للفرع',
      `تمت إضافة شباك جديد: ${newCounter.name} في الفرع`,
      'المدير العام',
      'counter'
    );

    return res.json({
      success: true,
      message: `تمت إضافة (${newCounter.name}) وحفظه بنجاح.`,
      counter: newCounter
    });
  }
});

// Soft disable counter to preserve records
app.delete('/api/hq/branch/:branchId/counters/:counterId', requireAdmin, (req, res) => {
  const { counterId } = req.params;
  const counter = db.counters.find(c => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: 'الشباك غير موجود.' });
  }

  counter.isOpen = false;
  if (counter.currentStaffId) {
    const staff = db.staff.find(s => s.id === counter.currentStaffId);
    if (staff) staff.counterId = '';
  }
  counter.currentStaffId = undefined;
  counter.currentStaffName = undefined;
  counter.claimedAt = undefined;

  saveDb(db);
  broadcastState();

  logAudit(
    'إغلاق وتعطيل شباك',
    `تم إغلاق ${counter.name} وتعطيله مع الاحتفاظ بكافة بياناته التاريخية بنجاح`,
    'المدير العام',
    'counter'
  );

  res.json({
    success: true,
    message: `تم إغلاق وتعطيل (${counter.name}) بنجاح مع الاحتفاظ بكافة سجلاته السابقة.`
  });
});

// 6. Manage Services & Categories of Branch
app.post('/api/hq/branch/:branchId/services', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, prefix, desc, assignedCounterId, active } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'اسم الخدمة مطلوب.' });
  }

  if (!prefix || typeof prefix !== 'string' || !prefix.trim()) {
    return res.status(400).json({ error: 'بادئة كود التذكرة (Prefix) مطلوبة.' });
  }

  const cleanPrefix = prefix.trim().toUpperCase().slice(0, 3);
  let counterName: string | undefined = undefined;
  if (assignedCounterId) {
    const counter = db.counters.find(c => c.id === assignedCounterId);
    if (counter) counterName = counter.name;
  }

  if (id) {
    const cat = db.settings.categories.find(c => c.id === id);
    if (!cat) {
      return res.status(404).json({ error: 'الخدمة غير موجودة.' });
    }

    cat.name = name.trim();
    cat.prefix = cleanPrefix;
    if (desc !== undefined) cat.desc = String(desc).trim();
    if (typeof active === 'boolean') cat.active = active;
    if (assignedCounterId !== undefined) {
      cat.assignedCounterId = assignedCounterId || undefined;
      cat.assignedCounterName = counterName;
    }

    saveDb(db);
    broadcastState();

    logAudit(
      'تعديل خدمة الفرع',
      `تم تحديث بيانات الخدمة (${cat.name}) في الفرع بنجاح`,
      'المدير العام',
      'settings'
    );

    return res.json({
      success: true,
      message: `تم حفظ تعديلات الخدمة (${cat.name}) بنجاح.`,
      category: cat
    });
  } else {
    const newService: CategoryConfig = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      name: name.trim(),
      prefix: cleanPrefix,
      desc: desc ? String(desc).trim() : '',
      active: typeof active === 'boolean' ? active : true,
      assignedCounterId: assignedCounterId || undefined,
      assignedCounterName: counterName
    };

    db.settings.categories.push(newService);
    saveDb(db);
    broadcastState();

    logAudit(
      'إضافة خدمة جديدة للفرع',
      `تمت إضافة خدمة جديدة: (${newService.name}) بالبادئة (${newService.prefix})`,
      'المدير العام',
      'settings'
    );

    return res.json({
      success: true,
      message: `تمت إضافة خدمة (${newService.name}) بنجاح.`,
      category: newService
    });
  }
});

// Soft disable service
app.delete('/api/hq/branch/:branchId/services/:serviceId', requireAdmin, (req, res) => {
  const { serviceId } = req.params;
  const service = db.settings.categories.find(c => c.id === serviceId);
  if (!service) {
    return res.status(404).json({ error: 'الخدمة غير موجودة.' });
  }

  service.active = false;
  saveDb(db);
  broadcastState();

  logAudit(
    'تعطيل خدمة',
    `تم إيقاف وتعطيل خدمة (${service.name}) في الفرع مع الحفاظ التام على سجلات وتذاكر المعاملات السابقة`,
    'المدير العام',
    'settings'
  );

  res.json({
    success: true,
    message: `تم إيقاف خدمة (${service.name}) بنجاح مع الاحتفاظ بكافة سجلاتها التاريخية.`
  });
});

// 7. Comprehensive CSV Export for Branch Performance
app.get('/api/hq/branch/:branchId/export-report', requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const branches = db.branches && db.branches.length > 0 ? db.branches : defaultBranches;
  const branch = branches.find(b => b.id === branchId) || { name: branchId, code: branchId };

  const tickets = (db.tickets || []).filter(t => (t.branchId || 'branch-aleppo-main') === branchId);
  const agencies = (db.agenciesTransactions || []).filter(a => (a.branchId || 'branch-aleppo-main') === branchId);

  const BOM = '\uFEFF';
  const csvRows: string[] = [];

  csvRows.push(`تقرير تقييم الأداء والبيانات الشاملة لفرع: ${branch.name} (${branch.code})`);
  csvRows.push(`تاريخ استخراج التقرير: ${new Date().toLocaleString('ar-SY')}`);
  csvRows.push('');
  csvRows.push('=== ملخص المؤشرات العامة ===');
  csvRows.push(`إجمالي التذاكر,${tickets.length}`);
  csvRows.push(`التذاكر المنجزة,${tickets.filter(t => t.status === 'completed').length}`);
  csvRows.push(`التذاكر قيد الانتظار,${tickets.filter(t => t.status === 'waiting').length}`);
  csvRows.push(`إجمالي الوكالات الموثقة,${agencies.length}`);
  csvRows.push(`إجمالي الرسوم المستوفاة (ل.س),${agencies.reduce((acc, a) => acc + (Number(a.feesPaid) || 0), 0)}`);
  csvRows.push('');
  csvRows.push('=== تفاصيل المعاملات والوكالات ===');
  csvRows.push('رقم الوكالة,السنة,النوع,الموكلون,المحامون,الرسوم (ل.س),المندوب الموثق,الحالة,تاريخ التسجيل');

  agencies.forEach(a => {
    csvRows.push([
      `"${a.agencyNumber}"`,
      a.agencyYear || 2026,
      `"${a.agencyType}"`,
      `"${(a.principalsNames || '').replace(/"/g, '""')}"`,
      `"${(a.lawyersNames || '').replace(/"/g, '""')}"`,
      a.feesPaid || 0,
      `"${a.notaryDelegateName || '-'}"`,
      `"${a.status === 'approved' ? 'معتمدة' : 'قيد المراجعة'}"`,
      `"${new Date(a.createdAt).toLocaleString('ar-SY')}"`
    ].join(','));
  });

  const csvContent = BOM + csvRows.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="branch-${branchId}-performance-report.csv"`);
  res.send(csvContent);
});

// Inspect Local Sync Queue
app.get('/api/sync/queue', requireAdmin, (req, res) => {
  res.json(db.syncQueue || []);
});

// Inspect Sync History
app.get('/api/sync/history', (req, res) => {
  res.json(db.syncHistory || []);
});

// ==========================================
// AGENCIES & LEGAL TRANSACTIONS API ROUTES
// ==========================================

// Get all agencies registered in this branch
app.get('/api/agencies', (req, res) => {
  res.json(db.agenciesTransactions || []);
});

// Register or update an agency record
app.post('/api/agencies', (req, res) => {
  const {
    id,
    localTicketId,
    agencyNumber,
    agencyYear,
    agencyType,
    principalsNames,
    lawyersNames,
    nationalId,
    feesPaid,
    receiptNumber,
    notaryDelegateName,
    isRevoked,
    revocationDate,
    status,
    notes
  } = req.body;

  if (!agencyNumber || !agencyType || !principalsNames || !lawyersNames) {
    return res.status(400).json({ error: 'يرجى استكمال الحقول الإلزامية للوكالة (رقم الوكالة، نوعها، أسماء الموكلين، أسماء الوكلاء).' });
  }

  if (!db.agenciesTransactions) db.agenciesTransactions = [];

  let agency: AgencyTransaction;
  const existingIndex = id ? db.agenciesTransactions.findIndex((a: any) => a.id === id) : -1;

  if (existingIndex >= 0) {
    agency = {
      ...db.agenciesTransactions[existingIndex],
      localTicketId: localTicketId || db.agenciesTransactions[existingIndex].localTicketId,
      agencyNumber,
      agencyYear: agencyYear || new Date().getFullYear(),
      agencyType,
      principalsNames,
      lawyersNames,
      nationalId,
      feesPaid: parseFloat(feesPaid || 0),
      receiptNumber,
      notaryDelegateName,
      isRevoked: isRevoked || false,
      revocationDate,
      status: status || 'approved',
      notes
    };
    db.agenciesTransactions[existingIndex] = agency;
    syncService.enqueue('agency', agency.id, 'UPDATE', agency);
    logAudit('تعديل معاملة وكالة', `تم تعديل بيانات الوكالة رقم ${agency.agencyNumber} (${agency.agencyType})`, notaryDelegateName || 'المندوب', 'ticket');
  } else {
    agency = {
      id: `agency-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId: syncService.getSettings().branchId,
      localTicketId,
      agencyNumber,
      agencyYear: agencyYear || new Date().getFullYear(),
      agencyType,
      principalsNames,
      lawyersNames,
      nationalId,
      feesPaid: parseFloat(feesPaid || 0),
      receiptNumber,
      notaryDelegateName,
      isRevoked: isRevoked || false,
      revocationDate,
      status: status || 'approved',
      notes,
      createdAt: new Date().toISOString()
    };
    db.agenciesTransactions.unshift(agency);
    syncService.enqueue('agency', agency.id, 'INSERT', agency);
    logAudit('تسجيل وكالة جديدة', `تم تنظيم وتسجيل الوكالة رقم ${agency.agencyNumber} (${agency.agencyType}) للموكل: ${principalsNames}`, notaryDelegateName || 'المندوب', 'ticket');
  }

  saveDb(db);
  broadcastState();

  res.json({
    success: true,
    message: `تم حفظ المعاملة للوكالة رقم ${agency.agencyNumber} بنجاح.`,
    agency
  });
});

// Upload attachment file (e.g. Scanned Agency or ID photo)
app.post('/api/attachments/upload', (req, res) => {
  const { localTicketId, fileName, fileBase64, fileType } = req.body;
  if (!fileName || !fileBase64) {
    return res.status(400).json({ error: 'الملف والمحتوى مطلوبان.' });
  }

  try {
    const attachment = syncService.saveAttachmentLocally(
      localTicketId || '',
      fileName,
      fileBase64,
      fileType || 'image/jpeg'
    );

    res.json({
      success: true,
      message: 'تم حفظ الملف محلياً وإدراجه في طابور الرفع السحابي.',
      attachment
    });
  } catch (err: any) {
    res.status(500).json({ error: `فشل حفظ المرفق: ${err.message}` });
  }
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
  if (!fs.existsSync(DIST_DIR)) {
    try {
      console.log('Building app distribution for production...');
      execSync('npm run build', { stdio: 'inherit' });
    } catch (e) {
      console.error('Auto build warning:', e);
    }
  }
  const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(DIST_DIR);
  
  if (!isProduction) {
    try {
      const viteModule = await import('vite');
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('Failed to create Vite server:', e);
    }
  }

  if (fs.existsSync(DIST_DIR)) {
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
  // Ensure static/middleware is set up for serverless invocation
  const DIST_DIR = join(__dirname, 'dist');
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }
}

export default app;
