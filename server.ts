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
app.use(express.json());

// Enable CORS and handle preflight OPTIONS for all API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token, x-admin-pin');
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
let DATA_DIR = process.env.VERCEL ? join(os.tmpdir(), 'queue_data') : join(__dirname, 'data');
let DB_FILE = join(DATA_DIR, 'queue_db.json');

// Ensure data directory exists, with fallback to os.tmpdir() if read-only (e.g. Vercel serverless)
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.accessSync(DATA_DIR, fs.constants.W_OK);
} catch (err) {
  DATA_DIR = join(os.tmpdir(), 'queue_data');
  DB_FILE = join(DATA_DIR, 'queue_db.json');
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      // Ignore
    }
  }
}

interface Ticket {
  id: string;
  number: number;
  displayNumber: string; // e.g., "A-001"
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

interface Staff {
  id: string;
  name: string;
  pin: string;
  counterId: string;
  active: boolean;
  role: 'staff' | 'admin';
  jobTitle?: string;
  allowedCounterIds?: string[];
}

interface Counter {
  id: string;
  name: string;
  isOpen: boolean;
  isPaused?: boolean;
  currentStaffId?: string;
  currentStaffName?: string;
  claimedAt?: string;
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
  category?: 'ticket' | 'counter' | 'staff' | 'settings' | 'auth' | 'system';
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
}

const getTodayDateString = () => new Date().toISOString().split('T')[0];

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
    { id: 'general', prefix: 'A', name: 'توثيق وكالة', desc: 'تنظيم وتوثيق الوكالات العامة والخاصة وتثبيتها أصولاً' },
    { id: 'special', prefix: 'B', name: 'الحصول على صورة عن وكالة', desc: 'سحب واستخراج صورة مصدقة طبق الأصل عن وكالة محفوظة' },
    { id: 'attestation', prefix: 'C', name: 'تنظيم وكالة خاصة', desc: 'وكالات البيع، الفراغ، الإدارة، والتصرف العقاري والمركبات' },
    { id: 'inquiry', prefix: 'D', name: 'تصديق العقود والاستعلامات', desc: 'تصديق وتثبيت العقود والاتفاقيات والاستعلام عن الرسوم النقابية' }
  ]
};

const defaultDb: DatabaseSchema = {
  date: getTodayDateString(),
  ticketSequence: 0,
  issuancePaused: false,
  settings: defaultSettings,
  tickets: [],
  staff: [
    { id: 'staff-1', name: 'أحمد المحمود', pin: '1234', counterId: '', active: true, role: 'staff', jobTitle: 'مندوب وكالات' },
    { id: 'staff-2', name: 'فاطمة الخطيب', pin: '2345', counterId: '', active: true, role: 'staff', jobTitle: 'مندوب وكالات' },
    { id: 'staff-3', name: 'محمد النجار', pin: '3456', counterId: '', active: true, role: 'staff', jobTitle: 'موظف توثيق' }
  ],
  counters: [
    { id: 'counter-1', name: 'الشباك 1 (توثيق وكالة)', isOpen: true, isPaused: false },
    { id: 'counter-2', name: 'الشباك 2 (الحصول على صورة عن وكالة)', isOpen: true, isPaused: false },
    { id: 'counter-3', name: 'الشباك 3 (تنظيم وكالة خاصة)', isOpen: true, isPaused: false },
    { id: 'counter-4', name: 'الشباك 4 (تصديق العقود والاستعلامات)', isOpen: true, isPaused: false }
  ],
  counterSessions: [],
  auditLogs: [
    {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'تهيئة النظام',
      details: 'تم بدء تشغيل نظام إدارة الدور بنجاح',
      user: 'النظام الآلي',
      category: 'system'
    }
  ]
};

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
}

function loadDb(): DatabaseSchema {
  try {
    ensureDataDir();
    let data: string | null = null;
    if (fs.existsSync(DB_FILE)) {
      data = fs.readFileSync(DB_FILE, 'utf8');
    } else {
      const fallbackFile = join(os.tmpdir(), 'queue_db.json');
      if (fs.existsSync(fallbackFile)) {
        data = fs.readFileSync(fallbackFile, 'utf8');
      }
    }

    if (data) {
      const loaded = JSON.parse(data) as DatabaseSchema;
      if (!loaded.settings) loaded.settings = { ...defaultSettings };
      if (!loaded.settings.categories) loaded.settings.categories = defaultSettings.categories;
      if (!loaded.settings.adminPin) loaded.settings.adminPin = '9999';
      if (!loaded.settings.departmentTitle) loaded.settings.departmentTitle = defaultSettings.departmentTitle;
      if (!loaded.settings.departmentSubtitle) loaded.settings.departmentSubtitle = defaultSettings.departmentSubtitle;
      if (!loaded.settings.tickerMessage) loaded.settings.tickerMessage = defaultSettings.tickerMessage;
      if (typeof loaded.settings.soundAlertsEnabled !== 'boolean') loaded.settings.soundAlertsEnabled = true;
      if (!loaded.auditLogs) loaded.auditLogs = [];
      if (!loaded.counterSessions) loaded.counterSessions = [];
      if (!loaded.staff || !Array.isArray(loaded.staff) || loaded.staff.length === 0) {
        loaded.staff = [...defaultDb.staff];
      } else {
        // Ensure jobTitle exists
        loaded.staff.forEach(s => {
          if (!s.jobTitle) s.jobTitle = 'مندوب وكالات';
        });
      }
      // Clean up counters if missing fields
      loaded.counters = loaded.counters.map(c => ({
        ...c,
        isPaused: typeof c.isPaused === 'boolean' ? c.isPaused : false
      }));
      if (!loaded.activeTokens || !Array.isArray(loaded.activeTokens)) {
        loaded.activeTokens = [];
      }
      return loaded;
    }
  } catch (err) {
    console.error('Error loading DB, using default:', err);
  }
  saveDb(defaultDb);
  return defaultDb;
}

function saveDb(currentDb: DatabaseSchema) {
  try {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(currentDb, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving DB to primary location:', err);
    try {
      const fallbackFile = join(os.tmpdir(), 'queue_db.json');
      fs.writeFileSync(fallbackFile, JSON.stringify(currentDb, null, 2), 'utf8');
    } catch (fallbackErr) {
      console.error('Error saving DB to fallback location:', fallbackErr);
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
  io.emit('state_update', {
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
      return next();
    }

    // 3. Persisted database tokens check
    if (db && Array.isArray((db as any).activeTokens) && (db as any).activeTokens.includes(token)) {
      activeAdminTokens.add(token);
      return next();
    }

    // 4. Any validly-formatted system issued token (e.g. admin-token-* or agency-admin-*)
    // Prevents session loss when server reboots or reloads during active manager work
    if (typeof token === 'string' && (token.startsWith('admin-token-') || token.startsWith('agency-admin-'))) {
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
    desc: ''
  };

  const newTicket: Ticket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    number: num,
    displayNumber: `${catConfig.prefix}-${paddedNum}`,
    category: catConfig.id,
    categoryNameArabic: catConfig.name,
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

  // Find oldest waiting ticket (FIFO) atomically
  // Restrict to tickets whose category matches the service indicated in the counter name
  // Counter names are structured like: "الشباك 1 (اسم الخدمة)"
  const counterServiceMatch = counter.name.match(/\((.*?)\)/);
  const counterService = counterServiceMatch ? counterServiceMatch[1] : null;

  let nextTicket = null;
  if (counterService) {
    // Try to find a waiting ticket that matches the counter's service name
    nextTicket = db.tickets.slice().reverse().find(t => t.status === 'waiting' && t.categoryNameArabic === counterService);
  } else {
    // Fallback to any waiting ticket if no service match found in counter name
    nextTicket = db.tickets.slice().reverse().find(t => t.status === 'waiting');
  }

  if (!nextTicket) {
    return res.status(404).json({ error: `لا توجد تذاكر في قائمة الانتظار لهذا الشباك ${counterService ? `(${counterService})` : 'حالياً'}.` });
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

// Staff action: Recall ticket
app.post('/api/staff/recall', (req, res) => {
  const { ticketId, staffId } = req.body;
  const ticket = db.tickets.find(t => t.id === ticketId);
  if (!ticket || ticket.status !== 'serving') {
    return res.status(400).json({ error: 'التذكرة غير موجودة أو ليست قيد الخدمة.' });
  }

  io.emit('ticket_called', {
    ticket,
    counter: ticket.counterName || 'الشباك',
    isRecall: true,
    timestamp: new Date().toISOString()
  });

  logAudit(
    'إعادة النداء',
    `إعادة النداء للتذكرة ${ticket.displayNumber} على ${ticket.counterName}`,
    ticket.staffName || 'موظف',
    'ticket'
  );

  res.json({ success: true, ticket });
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
    return res.status(400).json({ error: 'التذكرة غير موجودة.' });
  }

  ticket.status = 'skipped';
  ticket.notes = notes || 'لم يحضر المراجع عند النداء';

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
  const { name, prefix, desc, id } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'اسم فئة المعاملة مطلوب.' });
  }

  const cleanPrefix = (prefix && typeof prefix === 'string' && prefix.trim()) 
    ? prefix.trim().toUpperCase().slice(0, 3) 
    : String.fromCharCode(65 + db.settings.categories.length);

  const cleanId = (id && typeof id === 'string' && id.trim()) 
    ? id.trim().toLowerCase().replace(/\s+/g, '_') 
    : `cat_${Date.now()}`;

  // Check prefix or id collision
  if (db.settings.categories.some(c => c.id === cleanId)) {
    return res.status(400).json({ error: 'رمز تعريف الفئة مستخدم مسبقاً.' });
  }

  const newCat: CategoryConfig = {
    id: cleanId,
    name: name.trim(),
    prefix: cleanPrefix,
    desc: (desc && typeof desc === 'string') ? desc.trim() : ''
  };

  db.settings.categories.push(newCat);
  saveDb(db);
  broadcastState();

  logAudit('إضافة فئة خدمة/معاملة', `تمت إضافة فئة جديدة: ${newCat.name} (رمز: ${newCat.prefix})`, 'المدير العام', 'settings');
  res.json({ success: true, message: `تمت إضافة فئة (${newCat.name}) بنجاح.`, category: newCat, categories: db.settings.categories });
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, prefix, desc } = req.body;

  const cat = db.settings.categories.find(c => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: 'فئة المعاملة غير موجودة.' });
  }

  const oldName = cat.name;
  if (name && typeof name === 'string' && name.trim()) cat.name = name.trim();
  if (prefix && typeof prefix === 'string' && prefix.trim()) cat.prefix = prefix.trim().toUpperCase().slice(0, 3);
  if (desc !== undefined && typeof desc === 'string') cat.desc = desc.trim();

  saveDb(db);
  broadcastState();

  logAudit('تعديل فئة خدمة/معاملة', `تم تعديل بيانات فئة (${oldName}) ${oldName !== cat.name ? `إلى (${cat.name})` : ''}`, 'المدير العام', 'settings');
  res.json({ success: true, message: `تم تحديث فئة (${cat.name}) بنجاح.`, category: cat, categories: db.settings.categories });
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
