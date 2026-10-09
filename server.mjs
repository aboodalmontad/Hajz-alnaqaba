// server.ts
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { execSync } from "child_process";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var app = express();
app.use(express.json());
var server = createServer(app);
var io;
try {
  if (!process.env.VERCEL) {
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
      }
    });
  } else {
    io = { emit: () => {
    }, on: () => {
    } };
  }
} catch (e) {
  io = { emit: () => {
  }, on: () => {
  } };
}
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 3e3;
var DATA_DIR = process.env.VERCEL ? join(os.tmpdir(), "queue_data") : join(__dirname, "data");
var DB_FILE = join(DATA_DIR, "queue_db.json");
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.accessSync(DATA_DIR, fs.constants.W_OK);
} catch (err) {
  DATA_DIR = join(os.tmpdir(), "queue_data");
  DB_FILE = join(DATA_DIR, "queue_db.json");
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
    }
  }
}
var getTodayDateString = () => (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
var defaultSettings = {
  departmentTitle: "\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u2013 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 \u0628\u062D\u0644\u0628",
  departmentSubtitle: "\u0634\u0627\u0634\u0629 \u0639\u0631\u0636 \u0623\u062F\u0648\u0627\u0631\u064A \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u064A\u0646 \u0641\u064A \u0635\u0627\u0644\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
  tickerMessage: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0628\u0627\u0647 \u0625\u0644\u0649 \u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u062F\u0648\u0631 \u0648\u0638\u0647\u0648\u0631\u0647\u0627 \u0639\u0644\u0649 \u0634\u0627\u0634\u0629 \u0627\u0644\u0634\u0628\u0627\u0628\u064A\u0643 \u0639\u0646\u062F \u0627\u0644\u0646\u062F\u0627\u0621 \u0627\u0644\u0635\u0648\u062A\u064A. \u0623\u0647\u0644\u0627\u064B \u0628\u0643\u0645 \u0641\u064A \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 \u0628\u062D\u0644\u0628.",
  soundAlertsEnabled: true,
  workingHoursStart: "08:30",
  workingHoursEnd: "15:00",
  ticketSequence: 0,
  adminPin: "9999",
  categories: [
    { id: "general", prefix: "A", name: "\u0648\u0643\u0627\u0644\u0627\u062A \u0639\u0627\u0645\u0629", desc: "\u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0633\u062D\u0628 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629" },
    { id: "special", prefix: "B", name: "\u0648\u0643\u0627\u0644\u0627\u062A \u062E\u0627\u0635\u0629", desc: "\u0648\u0643\u0627\u0644\u0627\u062A \u0627\u0644\u0628\u064A\u0639\u060C \u0627\u0644\u0641\u0631\u0627\u063A\u060C \u0627\u0644\u0625\u062F\u0627\u0631\u0629\u060C \u0648\u0627\u0644\u062A\u0635\u0631\u0641" },
    { id: "attestation", prefix: "C", name: "\u062A\u0635\u062F\u064A\u0642 \u0627\u0644\u0639\u0642\u0648\u062F", desc: "\u062A\u0635\u062F\u064A\u0642 \u0648\u062A\u062B\u0628\u064A\u062A \u0627\u0644\u0639\u0642\u0648\u062F \u0648\u0627\u0644\u0627\u062A\u0641\u0627\u0642\u064A\u0627\u062A \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629" },
    { id: "inquiry", prefix: "D", name: "\u0627\u0644\u0627\u0633\u062A\u0639\u0644\u0627\u0645\u0627\u062A \u0648\u0627\u0644\u062F\u0639\u0645", desc: "\u0627\u0644\u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0639\u0646 \u0627\u0644\u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0648\u0627\u0644\u0631\u0633\u0648\u0645 \u0627\u0644\u0646\u0642\u0627\u0628\u064A\u0629" }
  ]
};
var defaultDb = {
  date: getTodayDateString(),
  ticketSequence: 0,
  issuancePaused: false,
  settings: defaultSettings,
  tickets: [],
  staff: [
    { id: "staff-1", name: "\u0623\u062D\u0645\u062F \u0627\u0644\u0645\u062D\u0645\u0648\u062F", pin: "1234", counterId: "", active: true, role: "staff" },
    { id: "staff-2", name: "\u0641\u0627\u0637\u0645\u0629 \u0627\u0644\u062E\u0637\u064A\u0628", pin: "2345", counterId: "", active: true, role: "staff" },
    { id: "staff-3", name: "\u0645\u062D\u0645\u062F \u0627\u0644\u0646\u062C\u0627\u0631", pin: "3456", counterId: "", active: true, role: "staff" }
  ],
  counters: [
    { id: "counter-1", name: "\u0627\u0644\u0634\u0628\u0627\u0643 1 (\u0648\u0643\u0627\u0644\u0627\u062A \u0639\u0627\u0645\u0629)", isOpen: true, isPaused: false },
    { id: "counter-2", name: "\u0627\u0644\u0634\u0628\u0627\u0643 2 (\u0648\u0643\u0627\u0644\u0627\u062A \u062E\u0627\u0635\u0629)", isOpen: true, isPaused: false },
    { id: "counter-3", name: "\u0627\u0644\u0634\u0628\u0627\u0643 3 (\u062A\u0635\u062F\u064A\u0642 \u0627\u0644\u0639\u0642\u0648\u062F)", isOpen: true, isPaused: false },
    { id: "counter-4", name: "\u0627\u0644\u0634\u0628\u0627\u0643 4 (\u0627\u0644\u0627\u0633\u062A\u0639\u0644\u0627\u0645\u0627\u062A)", isOpen: true, isPaused: false }
  ],
  counterSessions: [],
  auditLogs: [
    {
      id: `log-${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      action: "\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0646\u0638\u0627\u0645",
      details: "\u062A\u0645 \u0628\u062F\u0621 \u062A\u0634\u063A\u064A\u0644 \u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062F\u0648\u0631 \u0628\u0646\u062C\u0627\u062D",
      user: "\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0622\u0644\u064A",
      category: "system"
    }
  ]
};
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("Error creating data directory:", err);
  }
}
function loadDb() {
  try {
    ensureDataDir();
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      const loaded = JSON.parse(data);
      if (!loaded.settings) loaded.settings = { ...defaultSettings };
      if (!loaded.settings.categories) loaded.settings.categories = defaultSettings.categories;
      if (!loaded.settings.adminPin) loaded.settings.adminPin = "9999";
      if (!loaded.settings.departmentTitle) loaded.settings.departmentTitle = defaultSettings.departmentTitle;
      if (!loaded.settings.departmentSubtitle) loaded.settings.departmentSubtitle = defaultSettings.departmentSubtitle;
      if (!loaded.settings.tickerMessage) loaded.settings.tickerMessage = defaultSettings.tickerMessage;
      if (typeof loaded.settings.soundAlertsEnabled !== "boolean") loaded.settings.soundAlertsEnabled = true;
      if (!loaded.auditLogs) loaded.auditLogs = [];
      if (!loaded.counterSessions) loaded.counterSessions = [];
      loaded.counters = loaded.counters.map((c) => ({
        ...c,
        isPaused: typeof c.isPaused === "boolean" ? c.isPaused : false
      }));
      return loaded;
    }
  } catch (err) {
    console.error("Error loading DB, using default:", err);
  }
  saveDb(defaultDb);
  return defaultDb;
}
function saveDb(currentDb) {
  try {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(currentDb, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving DB:", err);
  }
}
var db = loadDb();
var activeAdminTokens = /* @__PURE__ */ new Set();
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name];
    if (netInterface) {
      for (const net of netInterface) {
        if (net.family === "IPv4" && !net.internal) {
          ips.push(net.address);
        }
      }
    }
  }
  if (ips.length === 0) ips.push("127.0.0.1");
  return ips;
}
function broadcastState() {
  io.emit("state_update", {
    tickets: db.tickets,
    staff: db.staff.map((s) => ({ ...s, pin: "****" })),
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
function logAudit(action, details, user = "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", category = "system") {
  const log = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    action,
    details,
    user,
    category
  };
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 2e3) {
    db.auditLogs = db.auditLogs.slice(0, 2e3);
  }
  saveDb(db);
  io.emit("audit_log_added", log);
}
function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const tokenHeader = req.headers["x-admin-token"];
    let token = tokenHeader;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    if (!token) {
      return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D: \u0644\u0645 \u064A\u062A\u0645 \u062A\u0642\u062F\u064A\u0645 \u0631\u0645\u0632 \u0627\u0644\u062A\u0648\u062B\u064A\u0642." });
    }
    if (activeAdminTokens.has(token)) {
      return next();
    }
    if (db && Array.isArray(db.activeTokens) && db.activeTokens.includes(token)) {
      activeAdminTokens.add(token);
      return next();
    }
    return res.status(401).json({
      error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u0644\u0645 \u064A\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0635\u0641\u062A\u0643 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645."
    });
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(401).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629." });
  }
}
app.use("/api", (req, res, next) => {
  if (req.path.length > 1 && req.path.endsWith("/")) {
    req.url = req.url.replace(/\/+$/, "");
  }
  next();
});
app.get("/api/ping", (req, res) => {
  res.json({
    status: "ok",
    connected: true,
    message: "Local server is active and ready",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/state", (req, res) => {
  res.json({
    tickets: db.tickets,
    staff: db.staff.map((s) => ({ ...s, pin: "****" })),
    counters: db.counters,
    counterSessions: db.counterSessions,
    issuancePaused: db.issuancePaused,
    date: db.date,
    localIPs: getLocalIPs(),
    port: PORT,
    appUrl: process.env.APP_URL || "",
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
app.get("/api/network-info", (req, res) => {
  res.json({
    localIPs: getLocalIPs(),
    port: PORT,
    appUrl: process.env.APP_URL || "",
    host: req.headers.host || "",
    protocol: req.headers["x-forwarded-proto"] || req.protocol || "http"
  });
});
app.get("/api/staff/list", (req, res) => {
  res.json(db.staff.map((s) => ({
    id: s.id,
    name: s.name,
    counterId: s.counterId,
    active: s.active,
    allowedCounterIds: s.allowedCounterIds
  })));
});
app.post("/api/staff/login", (req, res) => {
  const { staffId, pin } = req.body;
  const staff = db.staff.find((s) => s.id === staffId);
  if (!staff) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645." });
  }
  if (!staff.active) {
    return res.status(403).json({ error: "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645." });
  }
  if (staff.pin !== pin) {
    return res.status(401).json({ error: "\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0634\u062E\u0635\u064A (PIN) \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
  }
  const currentCounter = db.counters.find((c) => c.currentStaffId === staff.id);
  if (currentCounter) {
    staff.counterId = currentCounter.id;
  }
  logAudit("\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0645\u0648\u0638\u0641", `\u0642\u0627\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 ${staff.name} \u0628\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0639\u0628\u0631 \u0627\u0644\u0647\u0627\u062A\u0641`, staff.name, "auth");
  res.json({
    success: true,
    staff: {
      id: staff.id,
      name: staff.name,
      counterId: staff.counterId || (currentCounter ? currentCounter.id : ""),
      role: staff.role,
      allowedCounterIds: staff.allowedCounterIds
    },
    currentCounter: currentCounter || null
  });
});
app.post("/api/staff/claim-counter", (req, res) => {
  const { staffId, counterId } = req.body;
  const staff = db.staff.find((s) => s.id === staffId);
  if (!staff) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645." });
  }
  if (!staff.active) {
    return res.status(403).json({ error: "\u062D\u0633\u0627\u0628\u0643 \u0645\u0648\u0642\u0648\u0641 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
  }
  const targetCounter = db.counters.find((c) => c.id === counterId);
  if (!targetCounter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  if (!targetCounter.isOpen) {
    return res.status(400).json({ error: "\u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u063A\u0644\u0642 \u062D\u0627\u0644\u064A\u0627\u064B \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
  }
  if (staff.allowedCounterIds && staff.allowedCounterIds.length > 0) {
    if (!staff.allowedCounterIds.includes(counterId)) {
      return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643 \u0648\u0641\u0642 \u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
    }
  }
  if (targetCounter.currentStaffId && targetCounter.currentStaffId !== staffId) {
    return res.status(409).json({
      error: `\u0639\u0630\u0631\u0627\u064B\u060C \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0634\u063A\u0648\u0644 \u062D\u0627\u0644\u064A\u0627\u064B \u0648\u064A\u0639\u0645\u0644 \u0639\u0644\u064A\u0647 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${targetCounter.currentStaffName || "\u0632\u0645\u064A\u0644 \u0622\u062E\u0631"}). \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0634\u0628\u0627\u0643 \u0645\u062A\u0627\u062D.`
    });
  }
  const previousCounter = db.counters.find((c) => c.currentStaffId === staffId && c.id !== counterId);
  if (previousCounter) {
    const activeServingTicket = db.tickets.find((t) => t.staffId === staffId && t.status === "serving");
    if (activeServingTicket) {
      return res.status(400).json({
        error: `\u0644\u062F\u064A\u0643 \u0645\u0631\u0627\u062C\u0639 \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629 (${activeServingTicket.displayNumber}) \u0639\u0644\u0649 ${previousCounter.name}. \u064A\u062C\u0628 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0623\u0648 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631 \u0623\u0648\u0644\u0627\u064B \u0642\u0628\u0644 \u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644.`
      });
    }
    previousCounter.currentStaffId = void 0;
    previousCounter.currentStaffName = void 0;
    previousCounter.isPaused = false;
    previousCounter.claimedAt = void 0;
    const openSession = db.counterSessions.find((cs) => cs.staffId === staffId && cs.counterId === previousCounter.id && !cs.endedAt);
    if (openSession) {
      openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    logAudit("\u062A\u0628\u062F\u064A\u0644 \u0627\u0644\u0634\u0628\u0627\u0643", `\u0642\u0627\u0645 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff.name} \u0628\u0645\u063A\u0627\u062F\u0631\u0629 ${previousCounter.name} \u0648\u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0625\u0644\u0649 ${targetCounter.name}`, staff.name, "counter");
  }
  targetCounter.currentStaffId = staffId;
  targetCounter.currentStaffName = staff.name;
  targetCounter.isPaused = false;
  targetCounter.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
  staff.counterId = targetCounter.id;
  const newSession = {
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
  logAudit("\u0628\u062F\u0621 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0627\u0643", `\u0642\u0627\u0645 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff.name} \u0628\u062D\u062C\u0632 \u0648\u0628\u062F\u0621 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 ${targetCounter.name}`, staff.name, "counter");
  res.json({
    success: true,
    counter: targetCounter,
    message: `\u062A\u0645 \u062D\u062C\u0632 ${targetCounter.name} \u0628\u0646\u062C\u0627\u062D\u060C \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u064A\u0646.`
  });
});
app.post("/api/staff/release-counter", (req, res) => {
  const { staffId, counterId } = req.body;
  const staff = db.staff.find((s) => s.id === staffId);
  const counter = db.counters.find((c) => c.id === counterId);
  if (!staff || !counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u0623\u0648 \u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const activeServing = db.tickets.find((t) => t.staffId === staffId && t.status === "serving");
  if (activeServing) {
    return res.status(400).json({
      error: `\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0627\u0643 \u0623\u062B\u0646\u0627\u0621 \u0648\u062C\u0648\u062F \u0645\u0639\u0627\u0645\u0644\u0629 \u062C\u0627\u0631\u064A\u0629 (${activeServing.displayNumber}). \u064A\u0631\u062C\u0649 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062E\u062F\u0645\u0629 \u0623\u0648 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631 \u0623\u0648\u0644\u0627\u064B.`
    });
  }
  const openSession = db.counterSessions.find((cs) => cs.staffId === staffId && cs.counterId === counterId && !cs.endedAt);
  if (openSession) {
    openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  counter.currentStaffId = void 0;
  counter.currentStaffName = void 0;
  counter.isPaused = false;
  counter.claimedAt = void 0;
  staff.counterId = "";
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0627\u0643", `\u0623\u0646\u0647\u0649 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff.name} \u0639\u0645\u0644\u0647 \u0639\u0644\u0649 ${counter.name}`, staff.name, "counter");
  res.json({
    success: true,
    message: `\u062A\u0645 \u062A\u062D\u0631\u064A\u0631 ${counter.name} \u0628\u0646\u062C\u0627\u062D\u060C \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0627\u062E\u062A\u064A\u0627\u0631 \u0634\u0628\u0627\u0643 \u0622\u062E\u0631.`
  });
});
app.post("/api/staff/toggle-pause", (req, res) => {
  const { staffId, counterId } = req.body;
  const counter = db.counters.find((c) => c.id === counterId);
  const staff = db.staff.find((s) => s.id === staffId);
  if (!counter || counter.currentStaffId !== staffId) {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u062E\u0648\u0644 \u0628\u0627\u0644\u062A\u062D\u0643\u0645 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643." });
  }
  counter.isPaused = !counter.isPaused;
  saveDb(db);
  broadcastState();
  logAudit(
    counter.isPaused ? "\u0625\u064A\u0642\u0627\u0641 \u0645\u0624\u0642\u062A \u0644\u0644\u0634\u0628\u0627\u0643" : "\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0639\u0645\u0644 \u0627\u0644\u0634\u0628\u0627\u0643",
    `\u0642\u0627\u0645 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff?.name || "\u0627\u0644\u0645\u0648\u0638\u0641"} \u0628\u0640 ${counter.isPaused ? "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0639\u0645\u0644 \u0645\u0624\u0642\u062A\u0627\u064B \u0639\u0644\u0649" : "\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649"} ${counter.name}`,
    staff?.name || "\u0645\u0648\u0638\u0641",
    "counter"
  );
  res.json({
    success: true,
    isPaused: counter.isPaused,
    message: counter.isPaused ? "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0624\u0642\u062A\u0627\u064B \u0644\u0644\u0627\u0633\u062A\u0631\u0627\u062D\u0629." : "\u062A\u0645 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u064A\u0646."
  });
});
app.post("/api/staff/start-documenting", (req, res) => {
  const { ticketId, staffId } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  const staff = db.staff.find((s) => s.id === staffId);
  if (!ticket || ticket.status !== "serving") {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062F\u0639\u0627\u0621." });
  }
  ticket.documentingStartedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0628\u062F\u0621 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0648\u0643\u0627\u0644\u0629",
    `\u0628\u062F\u0623 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff?.name || "\u0627\u0644\u0645\u0648\u0638\u0641"} \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0648\u0643\u0627\u0644\u0629 \u0644\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0639\u0644\u0649 ${ticket.counterName}`,
    staff?.name || "\u0645\u0648\u0638\u0641",
    "ticket"
  );
  res.json({ success: true, ticket });
});
app.post("/api/tickets", (req, res) => {
  const { category = "general" } = req.body;
  if (db.issuancePaused) {
    return res.status(400).json({ error: "\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0645\u062A\u0648\u0642\u0641 \u0645\u0624\u0642\u062A\u064B\u0627 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
  }
  const today = getTodayDateString();
  if (db.date !== today) {
    db.date = today;
  }
  db.ticketSequence += 1;
  const num = db.ticketSequence;
  const paddedNum = String(num).padStart(3, "0");
  const catConfig = db.settings.categories.find((c) => c.id === category) || {
    id: category,
    prefix: "A",
    name: "\u0648\u0643\u0627\u0644\u0627\u062A \u0639\u0627\u0645\u0629",
    desc: ""
  };
  const newTicket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    number: num,
    displayNumber: `${catConfig.prefix}-${paddedNum}`,
    category: catConfig.id,
    categoryNameArabic: catConfig.name,
    status: "waiting",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.tickets.unshift(newTicket);
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0625\u0635\u062F\u0627\u0631 \u062A\u0630\u0643\u0631\u0629",
    `\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0631\u0642\u0645 ${newTicket.displayNumber} (${catConfig.name})`,
    "\u062C\u0647\u0627\u0632 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631",
    "ticket"
  );
  res.json(newTicket);
});
app.post("/api/staff/call-next", (req, res) => {
  const { staffId, counterId } = req.body;
  const staffMember = db.staff.find((s) => s.id === staffId);
  const counter = db.counters.find((c) => c.id === counterId);
  if (!staffMember || !counter || !counter.isOpen) {
    return res.status(400).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u063A\u0644\u0642." });
  }
  if (counter.isPaused) {
    return res.status(400).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u0641\u064A \u062D\u0627\u0644\u0629 \u0625\u064A\u0642\u0627\u0641 \u0645\u0624\u0642\u062A. \u064A\u0631\u062C\u0649 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0627\u0644\u0639\u0645\u0644 \u0623\u0648\u0644\u0627\u064B." });
  }
  if (counter.currentStaffId && counter.currentStaffId !== staffId) {
    return res.status(403).json({ error: "\u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0633\u0646\u062F \u0644\u0645\u0646\u062F\u0648\u0628 \u0622\u062E\u0631." });
  }
  const currentServing = db.tickets.find((t) => t.staffId === staffId && t.status === "serving");
  if (currentServing) {
    return res.status(400).json({ error: "\u0644\u062F\u064A\u0643 \u0645\u0631\u0627\u062C\u0639 \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u064A\u0631\u062C\u0649 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062E\u062F\u0645\u0629 \u0623\u0648 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631 \u0623\u0648\u0644\u0627\u064B." });
  }
  const nextTicket = db.tickets.slice().reverse().find((t) => t.status === "waiting");
  if (!nextTicket) {
    return res.status(404).json({ error: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0630\u0627\u0643\u0631 \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u062D\u0627\u0644\u064A\u0627\u064B." });
  }
  nextTicket.status = "serving";
  nextTicket.calledAt = (/* @__PURE__ */ new Date()).toISOString();
  nextTicket.counterId = counter.id;
  nextTicket.counterName = counter.name;
  nextTicket.staffId = staffMember.id;
  nextTicket.staffName = staffMember.name;
  nextTicket.documentingStartedAt = void 0;
  saveDb(db);
  broadcastState();
  io.emit("ticket_called", {
    ticket: nextTicket,
    counter: counter.name,
    timestamp: nextTicket.calledAt
  });
  logAudit(
    "\u0627\u0633\u062A\u062F\u0639\u0627\u0621 \u0645\u0631\u0627\u062C\u0639",
    `\u0627\u0644\u0645\u0648\u0638\u0641 ${staffMember.name} \u0639\u0644\u0649 ${counter.name} \u0627\u0633\u062A\u062F\u0639\u0649 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${nextTicket.displayNumber}`,
    staffMember.name,
    "ticket"
  );
  res.json(nextTicket);
});
app.post("/api/staff/recall", (req, res) => {
  const { ticketId, staffId } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.status !== "serving") {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629." });
  }
  io.emit("ticket_called", {
    ticket,
    counter: ticket.counterName || "\u0627\u0644\u0634\u0628\u0627\u0643",
    isRecall: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit(
    "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621",
    `\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621 \u0644\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0639\u0644\u0649 ${ticket.counterName}`,
    ticket.staffName || "\u0645\u0648\u0638\u0641",
    "ticket"
  );
  res.json({ success: true, ticket });
});
app.post("/api/staff/complete", (req, res) => {
  const { ticketId } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.status !== "serving") {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629." });
  }
  ticket.status = "completed";
  ticket.completedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0625\u0646\u0647\u0627\u0621 \u062E\u062F\u0645\u0629",
    `\u062A\u0645\u062A \u062E\u062F\u0645\u0629 \u0648\u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0628\u0646\u062C\u0627\u062D \u0639\u0644\u0649 ${ticket.counterName}`,
    ticket.staffName || "\u0645\u0648\u0638\u0641",
    "ticket"
  );
  res.json({ success: true, ticket });
});
app.post("/api/staff/skip", (req, res) => {
  const { ticketId, notes } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.status !== "serving") {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  ticket.status = "skipped";
  ticket.notes = notes || "\u0644\u0645 \u064A\u062D\u0636\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0639\u0646\u062F \u0627\u0644\u0646\u062F\u0627\u0621";
  saveDb(db);
  broadcastState();
  logAudit(
    "\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631",
    `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} - \u0627\u0644\u0633\u0628\u0628: ${ticket.notes}`,
    ticket.staffName || "\u0645\u0648\u0638\u0641",
    "ticket"
  );
  res.json({ success: true, ticket });
});
app.post("/api/staff/return-queue", (req, res) => {
  const { ticketId } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  ticket.status = "waiting";
  ticket.counterId = void 0;
  ticket.counterName = void 0;
  ticket.staffId = void 0;
  ticket.staffName = void 0;
  ticket.documentingStartedAt = void 0;
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0625\u0639\u0627\u062F\u0629 \u0644\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
    `\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0625\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631`,
    "\u0645\u0648\u0638\u0641 \u0627\u0644\u0634\u0628\u0627\u0643",
    "ticket"
  );
  res.json({ success: true, ticket });
});
app.post("/api/admin/login", (req, res) => {
  try {
    const pin = req.body?.pin;
    const correctPin = db?.settings?.adminPin || "9999";
    if (!pin || pin !== correctPin) {
      console.error("Admin login failed: incorrect PIN attempt");
      return res.status(401).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
    }
    const token = `admin-token-${Date.now()}-${crypto.randomBytes(16).toString("hex")}`;
    activeAdminTokens.add(token);
    if (!db.activeTokens) db.activeTokens = [];
    db.activeTokens.push(token);
    if (db.activeTokens.length > 100) {
      db.activeTokens = db.activeTokens.slice(-100);
    }
    saveDb(db);
    try {
      logAudit("\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u062F\u064A\u0631", "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "auth");
    } catch (auditErr) {
      console.error("Audit log error during login:", auditErr);
    }
    return res.json({
      success: true,
      token,
      adminName: "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0644\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A"
    });
  } catch (err) {
    console.error("Admin login error (FUNCTION_INVOCATION_FAILED):", err?.message || err, err?.stack);
    return res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u062E\u0627\u062F\u0645 (500): A server error has occurred" });
  }
});
app.post("/api/admin/change-pin", requireAdmin, (req, res) => {
  const { currentPin, newPin } = req.body;
  const correctPin = db.settings.adminPin || "9999";
  if (currentPin !== correctPin) {
    return res.status(400).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u062D\u0627\u0644\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
  }
  if (!newPin || newPin.length < 4) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0646 4 \u0625\u0644\u0649 8 \u062E\u0627\u0646\u0627\u062A." });
  }
  db.settings.adminPin = newPin;
  saveDb(db);
  logAudit("\u062A\u063A\u064A\u064A\u0631 \u0631\u0645\u0632 \u0627\u0644\u0645\u062F\u064A\u0631", "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A \u0644\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0646\u062C\u0627\u062D", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "auth");
  res.json({ success: true, message: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0631\u0645\u0632 \u0627\u0644\u0645\u062F\u064A\u0631 \u0628\u0646\u062C\u0627\u062D." });
});
app.get("/api/admin/staff", requireAdmin, (req, res) => {
  res.json(db.staff);
});
app.post("/api/admin/staff", requireAdmin, (req, res) => {
  const { id, name, pin, counterId, active, allowedCounterIds } = req.body;
  if (id) {
    const staff = db.staff.find((s) => s.id === id);
    if (!staff) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const oldName = staff.name;
    if (name) staff.name = name;
    if (pin) staff.pin = pin;
    if (counterId !== void 0) staff.counterId = counterId;
    if (typeof active === "boolean") staff.active = active;
    if (allowedCounterIds !== void 0) staff.allowedCounterIds = allowedCounterIds;
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0648\u0638\u0641", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641 ${oldName} (${staff.name})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
    return res.json({ success: true, staff: db.staff });
  } else {
    if (!name || !pin) {
      return res.status(400).json({ error: "\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0634\u062E\u0635\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
    }
    const newStaff = {
      id: `staff-${Date.now()}`,
      name,
      pin,
      counterId: counterId || "",
      active: typeof active === "boolean" ? active : true,
      role: "staff",
      allowedCounterIds: allowedCounterIds || []
    };
    db.staff.push(newStaff);
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641 \u062C\u062F\u064A\u062F", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0648\u0638\u0641 ${newStaff.name} \u0628\u0646\u062C\u0627\u062D`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
    return res.json({ success: true, staff: db.staff, newStaff });
  }
});
app.delete("/api/admin/staff/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.staff.findIndex((s) => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const staffName = db.staff[index].name;
  db.staff.splice(index, 1);
  db.counters.forEach((c) => {
    if (c.currentStaffId === id) {
      c.currentStaffId = void 0;
      c.currentStaffName = void 0;
      c.isPaused = false;
      c.claimedAt = void 0;
    }
  });
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u0645\u0648\u0638\u0641", `\u062A\u0645 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0648\u0638\u0641 ${staffName} \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
  res.json({ success: true, message: `\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0648\u0638\u0641 ${staffName} \u0628\u0646\u062C\u0627\u062D.` });
});
app.post("/api/admin/force-release-counter", requireAdmin, (req, res) => {
  const { counterId } = req.body;
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const staffName = counter.currentStaffName || "\u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u062D\u0627\u0644\u064A";
  const staffId = counter.currentStaffId;
  const openSession = db.counterSessions.find((cs) => cs.counterId === counterId && !cs.endedAt);
  if (openSession) {
    openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  counter.currentStaffId = void 0;
  counter.currentStaffName = void 0;
  counter.isPaused = false;
  counter.claimedAt = void 0;
  if (staffId) {
    const staff = db.staff.find((s) => s.id === staffId);
    if (staff) staff.counterId = "";
  }
  saveDb(db);
  broadcastState();
  logAudit("\u062A\u062D\u0631\u064A\u0631 \u0634\u0628\u0627\u0643 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0625\u0646\u0647\u0627\u0621 \u062D\u062C\u0632 ${counter.name} \u0648\u0641\u0635\u0644\u0647 \u0639\u0646 ${staffName}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u0631\u064A\u0631 ${counter.name} \u0628\u0646\u062C\u0627\u062D.` });
});
app.post("/api/admin/move-staff-counter", requireAdmin, (req, res) => {
  const { staffId, targetCounterId } = req.body;
  const staff = db.staff.find((s) => s.id === staffId);
  const targetCounter = db.counters.find((c) => c.id === targetCounterId);
  if (!staff || !targetCounter) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u0623\u0648 \u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  if (targetCounter.currentStaffId && targetCounter.currentStaffId !== staffId) {
    return res.status(400).json({ error: `\u0627\u0644\u0634\u0628\u0627\u0643 \u0627\u0644\u0647\u062F\u0641 \u0645\u0634\u063A\u0648\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0645\u0646 \u0642\u0628\u0644 ${targetCounter.currentStaffName}.` });
  }
  const oldCounter = db.counters.find((c) => c.currentStaffId === staffId && c.id !== targetCounterId);
  if (oldCounter) {
    oldCounter.currentStaffId = void 0;
    oldCounter.currentStaffName = void 0;
    oldCounter.isPaused = false;
    oldCounter.claimedAt = void 0;
    const openSession = db.counterSessions.find((cs) => cs.staffId === staffId && cs.counterId === oldCounter.id && !cs.endedAt);
    if (openSession) openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  targetCounter.currentStaffId = staff.id;
  targetCounter.currentStaffName = staff.name;
  targetCounter.isPaused = false;
  targetCounter.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
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
  logAudit("\u0646\u0642\u0644 \u0645\u0648\u0638\u0641 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0646\u0642\u0644 \u0627\u0644\u0645\u0648\u0638\u0641 ${staff.name} \u0625\u0644\u0649 ${targetCounter.name}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: `\u062A\u0645 \u0646\u0642\u0644 ${staff.name} \u0625\u0644\u0649 ${targetCounter.name} \u0628\u0646\u062C\u0627\u062D.` });
});
app.get("/api/admin/counter-sessions", requireAdmin, (req, res) => {
  res.json(db.counterSessions);
});
app.get("/api/admin/counters", requireAdmin, (req, res) => {
  res.json(db.counters);
});
app.post("/api/admin/counters", requireAdmin, (req, res) => {
  const { id, name, isOpen, isPaused } = req.body;
  if (id) {
    const counter = db.counters.find((c) => c.id === id);
    if (!counter) {
      return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    if (name) counter.name = name;
    if (typeof isOpen === "boolean") counter.isOpen = isOpen;
    if (typeof isPaused === "boolean") counter.isPaused = isPaused;
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0634\u0628\u0627\u0643", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A ${counter.name} (\u0645\u0641\u062A\u0648\u062D: ${counter.isOpen})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    return res.json({ success: true, counter, counters: db.counters });
  } else {
    if (!name) {
      return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0637\u0644\u0648\u0628." });
    }
    const newCounter = {
      id: `counter-${Date.now()}`,
      name,
      isOpen: true,
      isPaused: false
    };
    db.counters.push(newCounter);
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0636\u0627\u0641\u0629 \u0634\u0628\u0627\u0643 \u062C\u062F\u064A\u062F", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0634\u0628\u0627\u0643 \u062C\u062F\u064A\u062F: ${newCounter.name}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    return res.json({ success: true, counter: newCounter, counters: db.counters });
  }
});
app.delete("/api/admin/counters/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.counters.findIndex((c) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const counterName = db.counters[index].name;
  db.counters.splice(index, 1);
  db.staff.forEach((s) => {
    if (s.counterId === id) {
      s.counterId = "";
    }
  });
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u0634\u0628\u0627\u0643", `\u062A\u0645 \u062D\u0630\u0641 ${counterName} \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: `\u062A\u0645 \u062D\u0630\u0641 ${counterName} \u0628\u0646\u062C\u0627\u062D.` });
});
app.get("/api/admin/tickets", requireAdmin, (req, res) => {
  res.json(db.tickets);
});
app.put("/api/admin/tickets/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { displayNumber, number, status, counterId, staffId, notes, categoryNameArabic } = req.body;
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  if (displayNumber && displayNumber !== ticket.displayNumber) {
    const duplicate = db.tickets.find((t) => t.id !== id && t.displayNumber === displayNumber);
    if (duplicate) {
      return res.status(400).json({ error: `\u0627\u0644\u0631\u0642\u0645 ${displayNumber} \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u062A\u0630\u0643\u0631\u0629 \u0623\u062E\u0631\u0649 \u0627\u0644\u064A\u0648\u0645!` });
    }
    const prevDisplay = ticket.displayNumber;
    ticket.displayNumber = displayNumber;
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0631\u0642\u0645 \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0631\u0642\u0645 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0645\u0646 ${prevDisplay} \u0625\u0644\u0649 ${displayNumber}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  }
  if (typeof number === "number") {
    ticket.number = number;
  }
  if (categoryNameArabic) {
    ticket.categoryNameArabic = categoryNameArabic;
  }
  if (notes !== void 0) {
    ticket.notes = notes;
  }
  if (status && status !== ticket.status) {
    const prevStatus = ticket.status;
    ticket.status = status;
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u062D\u0627\u0644\u0629 \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0645\u0646 (${prevStatus}) \u0625\u0644\u0649 (${status})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  }
  if (counterId !== void 0) {
    const counter = db.counters.find((c) => c.id === counterId);
    ticket.counterId = counterId || void 0;
    ticket.counterName = counter ? counter.name : void 0;
  }
  if (staffId !== void 0) {
    const staff = db.staff.find((s) => s.id === staffId);
    ticket.staffId = staffId || void 0;
    ticket.staffName = staff ? staff.name : void 0;
  }
  saveDb(db);
  broadcastState();
  res.json({ success: true, ticket });
});
app.post("/api/admin/tickets/:id/reassign", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { counterId, staffId } = req.body;
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const staff = staffId ? db.staff.find((s) => s.id === staffId) : void 0;
  const prevCounter = ticket.counterName || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F";
  ticket.counterId = counter.id;
  ticket.counterName = counter.name;
  if (staff) {
    ticket.staffId = staff.id;
    ticket.staffName = staff.name;
  }
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0639\u0627\u062F\u0629 \u0625\u0633\u0646\u0627\u062F \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u0646\u0642\u0644 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0645\u0646 ${prevCounter} \u0625\u0644\u0649 ${counter.name}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  res.json({ success: true, ticket });
});
app.post("/api/admin/tickets/:id/action", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { action, notes } = req.body;
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  if (action === "return_queue") {
    ticket.status = "waiting";
    ticket.counterId = void 0;
    ticket.counterName = void 0;
    ticket.staffId = void 0;
    ticket.staffName = void 0;
    ticket.documentingStartedAt = void 0;
    logAudit("\u0625\u0639\u0627\u062F\u0629 \u062A\u0630\u0643\u0631\u0629 \u0644\u0644\u0627\u0646\u062A\u0638\u0627\u0631", `\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0625\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0628\u0623\u0645\u0631 \u0625\u062F\u0627\u0631\u064A`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  } else if (action === "cancel") {
    ticket.status = "cancelled";
    ticket.notes = notes || "\u062A\u0645 \u0627\u0644\u0625\u0644\u063A\u0627\u0621 \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645";
    logAudit("\u0625\u0644\u063A\u0627\u0621 \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} - \u0645\u0644\u0627\u062D\u0638\u0627\u062A: ${ticket.notes}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  } else if (action === "complete") {
    ticket.status = "completed";
    ticket.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    logAudit("\u0625\u0646\u0647\u0627\u0621 \u062A\u0630\u0643\u0631\u0629 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u062A\u0645 \u0625\u0646\u0647\u0627\u0621 \u0645\u0639\u0627\u0645\u0644\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0625\u062F\u0627\u0631\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  } else if (action === "skip") {
    ticket.status = "skipped";
    ticket.notes = notes || "\u062A\u062C\u0627\u0648\u0632 \u0628\u0623\u0645\u0631 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645";
    logAudit("\u062A\u062C\u0627\u0648\u0632 \u062A\u0630\u0643\u0631\u0629 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0625\u062F\u0627\u0631\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  }
  saveDb(db);
  broadcastState();
  res.json({ success: true, ticket });
});
app.post("/api/admin/tickets/:id/recall", requireAdmin, (req, res) => {
  const { id } = req.params;
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  io.emit("ticket_called", {
    ticket,
    counter: ticket.counterName || "\u0627\u0644\u0634\u0628\u0627\u0643 \u0627\u0644\u0645\u062D\u062F\u062F",
    isRecall: true,
    byAdmin: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit("\u0625\u0639\u0627\u062F\u0629 \u0646\u062F\u0627\u0621 \u0625\u062F\u0627\u0631\u064A", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621 \u0644\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0639\u0644\u0649 ${ticket.counterName || "\u0627\u0644\u0634\u0627\u0634\u0629"}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  res.json({ success: true, message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0646\u062F\u0627\u0621 \u0641\u0648\u0631\u064A \u0644\u0644\u062A\u0630\u0643\u0631\u0629." });
});
app.delete("/api/admin/tickets/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.tickets.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  const ticketNum = db.tickets[index].displayNumber;
  db.tickets.splice(index, 1);
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0631\u0642\u0645 ${ticketNum} \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645 \u0646\u0647\u0627\u0626\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  res.json({ success: true, message: `\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticketNum} \u0628\u0646\u062C\u0627\u062D.` });
});
app.get("/api/admin/settings", requireAdmin, (req, res) => {
  res.json({
    ...db.settings,
    ticketSequence: db.ticketSequence,
    issuancePaused: db.issuancePaused
  });
});
app.put("/api/admin/settings", requireAdmin, (req, res) => {
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
  if (typeof soundAlertsEnabled === "boolean") db.settings.soundAlertsEnabled = soundAlertsEnabled;
  if (workingHoursStart) db.settings.workingHoursStart = workingHoursStart;
  if (workingHoursEnd) db.settings.workingHoursEnd = workingHoursEnd;
  if (Array.isArray(categories)) db.settings.categories = categories;
  if (typeof ticketSequence === "number" && ticketSequence >= 0) {
    db.ticketSequence = ticketSequence;
  }
  saveDb(db);
  broadcastState();
  logAudit("\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645", "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0634\u0627\u0634\u0629 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u062F\u064A\u0631", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, settings: db.settings });
});
app.post("/api/admin/toggle-issuance", requireAdmin, (req, res) => {
  db.issuancePaused = !db.issuancePaused;
  saveDb(db);
  broadcastState();
  logAudit(
    db.issuancePaused ? "\u0625\u064A\u0642\u0627\u0641 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631" : "\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631",
    db.issuancePaused ? "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0645\u0624\u0642\u062A\u0627\u064B" : "\u062A\u0645 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631",
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "system"
  );
  res.json({ success: true, issuancePaused: db.issuancePaused });
});
app.post("/api/admin/new-day", requireAdmin, (req, res) => {
  const prevDate = db.date;
  db.date = getTodayDateString();
  db.ticketSequence = 0;
  db.tickets = [];
  db.issuancePaused = false;
  db.counters.forEach((c) => {
    c.currentStaffId = void 0;
    c.currentStaffName = void 0;
    c.isPaused = false;
    c.claimedAt = void 0;
  });
  db.staff.forEach((s) => {
    s.counterId = "";
  });
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0628\u062F\u0621 \u064A\u0648\u0645 \u0639\u0645\u0644 \u062C\u062F\u064A\u062F",
    `\u062A\u0645 \u0628\u062F\u0621 \u064A\u0648\u0645 \u0639\u0645\u0644 \u062C\u062F\u064A\u062F \u0628\u062A\u0627\u0631\u064A\u062E ${db.date} (\u062A\u0635\u0641\u064A\u0631 \u0627\u0644\u0623\u062F\u0648\u0627\u0631 \u0644\u0644\u064A\u0648\u0645 \u0627\u0644\u0633\u0627\u0628\u0642 ${prevDate})`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "system"
  );
  res.json({ success: true, message: `\u062A\u0645 \u0628\u062F\u0621 \u064A\u0648\u0645 \u0639\u0645\u0644 \u062C\u062F\u064A\u062F \u0628\u0646\u062C\u0627\u062D (${db.date})` });
});
app.get("/api/admin/export-csv", requireAdmin, (req, res) => {
  const BOM = "\uFEFF";
  const headers = ["\u0631\u0642\u0645 \u0627\u0644\u062F\u0648\u0631", "\u0627\u0644\u0641\u0626\u0629", "\u0627\u0644\u062D\u0627\u0644\u0629", "\u0627\u0644\u0634\u0628\u0627\u0643", "\u0627\u0644\u0645\u0648\u0638\u0641", "\u0648\u0642\u062A \u0627\u0644\u0625\u0635\u062F\u0627\u0631", "\u0648\u0642\u062A \u0627\u0644\u0627\u0633\u062A\u062F\u0639\u0627\u0621", "\u0648\u0642\u062A \u0627\u0644\u0625\u0646\u062C\u0627\u0632", "\u0645\u0644\u0627\u062D\u0638\u0627\u062A"];
  const statusTranslations = {
    waiting: "\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
    serving: "\u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629",
    completed: "\u0645\u0643\u062A\u0645\u0644\u0629",
    skipped: "\u0645\u062A\u062C\u0627\u0648\u0632\u0629",
    cancelled: "\u0645\u0644\u063A\u0627\u0629"
  };
  const rows = db.tickets.map((t) => [
    t.displayNumber,
    t.categoryNameArabic,
    statusTranslations[t.status] || t.status,
    t.counterName || "-",
    t.staffName || "-",
    new Date(t.createdAt).toLocaleTimeString("ar-SY"),
    t.calledAt ? new Date(t.calledAt).toLocaleTimeString("ar-SY") : "-",
    t.completedAt ? new Date(t.completedAt).toLocaleTimeString("ar-SY") : "-",
    (t.notes || "").replace(/"/g, '""')
  ]);
  const csvContent = BOM + [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))
  ].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="agency-queue-report-${db.date}.csv"`);
  res.send(csvContent);
});
app.get("/api/admin/backup", requireAdmin, (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=agency-queue-backup-${db.date}.json`);
  res.send(JSON.stringify(db, null, 2));
});
app.post("/api/admin/restore", requireAdmin, (req, res) => {
  try {
    const restored = req.body;
    if (restored && Array.isArray(restored.tickets) && Array.isArray(restored.counters)) {
      db = {
        ...defaultDb,
        ...restored,
        settings: {
          ...defaultSettings,
          ...restored.settings || {}
        }
      };
      saveDb(db);
      broadcastState();
      logAudit("\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629", "\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D \u0645\u0646 \u0645\u0644\u0641 \u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "system");
      return res.json({ success: true, message: "\u062A\u0645 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
    }
    res.status(400).json({ error: "\u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644." });
  } catch (err) {
    res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
  }
});
app.get("/api/admin/logs", requireAdmin, (req, res) => {
  res.json(db.auditLogs);
});
io.on("connection", (socket) => {
  socket.emit("state_update", {
    tickets: db.tickets,
    staff: db.staff.map((s) => ({ ...s, pin: "****" })),
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
  const DIST_DIR = join(__dirname, "dist");
  if (!fs.existsSync(DIST_DIR)) {
    try {
      console.log("Building app distribution for production...");
      execSync("npm run build", { stdio: "inherit" });
    } catch (e) {
      console.error("Auto build warning:", e);
    }
  }
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(DIST_DIR);
  if (!isProduction) {
    try {
      const viteModule = await import("vite");
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to create Vite server:", e);
    }
  }
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }
  app.use(express.static(__dirname));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    const distIndex = join(DIST_DIR, "index.html");
    if (fs.existsSync(distIndex)) {
      res.sendFile(distIndex);
    } else {
      res.sendFile(join(__dirname, "index.html"));
    }
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`==================================================`);
    console.log(` \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 \u0628\u062D\u0644\u0628 - \u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A (\u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0648\u0631)`);
    console.log(` \u0627\u0644\u062E\u0627\u062F\u0645 \u064A\u0639\u0645\u0644 \u0645\u062D\u0644\u064A\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0628\u0648\u0631\u062A: ${PORT}`);
    console.log(` \u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0645\u062D\u0644\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0643\u0629 (Wi-Fi):`);
    getLocalIPs().forEach((ip) => {
      console.log(`   \u{1F449} http://${ip}:${PORT}`);
    });
    console.log(`==================================================`);
  });
}
if (!process.env.VERCEL) {
  startServer();
} else {
  const DIST_DIR = join(__dirname, "dist");
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }
}
var server_default = app;
export {
  server_default as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
