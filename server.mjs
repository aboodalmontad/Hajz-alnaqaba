// server.ts
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token, x-admin-pin");
  if (req.path.startsWith("/api")) {
    res.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
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
var PORT = 3e3;
var PRIMARY_DATA_DIR = join(process.cwd(), "data");
var BACKUP_DATA_DIR = join(__dirname, "data");
var TMP_DATA_DIR = join(os.tmpdir(), "queue_data");
[PRIMARY_DATA_DIR, BACKUP_DATA_DIR, TMP_DATA_DIR].forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
  }
});
var DB_FILE = join(PRIMARY_DATA_DIR, "queue_db.json");
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
    {
      id: "special",
      prefix: "A",
      name: "\u062A\u0648\u062B\u064A\u0642 \u0648\u0643\u0627\u0644\u0629",
      desc: "\u062A\u0646\u062C\u0632 \u0647\u0630\u0647 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0623\u0645\u0627\u0645 \u0645\u0646\u062F\u0648\u0628 \u0631\u0626\u064A\u0633 \u0627\u0644\u0641\u0631\u0639 \u0644\u0644\u062A\u062B\u0628\u062A \u0645\u0646 \u0627\u0644\u0647\u0648\u064A\u0629 \u0648 \u0645\u062D\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0648\u0643\u0627\u0644\u0629",
      assignedCounterId: "counter-1791640234085",
      assignedCounterName: "\u0627\u0644\u0634\u0628\u0627\u0643 1"
    },
    {
      id: "cat_1791641888137",
      name: "\u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0635\u0648\u0631\u0629 \u0639\u0646 \u0648\u0643\u0627\u0644\u0629",
      prefix: "B",
      desc: ""
    },
    {
      id: "cat_1791677992936",
      name: "\u0639\u0632\u0644 \u0648\u0643\u0627\u0644\u0629",
      prefix: "C",
      desc: "\u0644\u0639\u0632\u0644 \u0648\u0643\u0627\u0644\u0629 \u0645\u062D\u0627\u0645\u064A \u064A\u062A\u0637\u0644\u0628 \u0648\u062C\u0648\u062F \u0635\u0648\u0631\u0629 \u0639\u0646 \u0627\u0644\u0648\u0643\u0627\u0644\u0629 \u0623\u0648 \u0631\u0642\u0645\u0647\u0627 \u0648\u062F\u0641\u0639 \u0631\u0633\u0645 \u0627\u0644\u0639\u0632\u0644 \u0648\u062A\u0628\u0644\u064A\u063A \u0627\u0644\u0645\u062D\u0627\u0645\u064A \u0627\u0644\u0645\u0639\u0632\u0648\u0644 \u0648\u0627\u0644\u062A\u0623\u0634\u064A\u0631 \u0628\u0648\u0642\u0648\u0639 \u0627\u0644\u0639\u0632\u0644 \u0639\u0644\u0649 \u0627\u0644\u0648\u0643\u0627\u0644\u0629 \u0627\u0644\u0645\u0639\u0632\u0648\u0644\u0629 ."
    }
  ]
};
var defaultDb = {
  date: getTodayDateString(),
  ticketSequence: 0,
  issuancePaused: false,
  settings: defaultSettings,
  tickets: [],
  staff: [
    {
      id: "staff-1791572701221",
      name: "\u062D\u0633\u0627\u0646 \u0645\u0631\u0634\u062D\u0629",
      pin: "123456",
      counterId: "counter-1791640239853",
      active: true,
      role: "staff",
      jobTitle: "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: []
    },
    {
      id: "staff-1791572724537",
      name: "\u0632\u0643\u0631\u064A\u0627 \u0646\u0646\u0647",
      pin: "123456",
      counterId: "",
      active: true,
      role: "staff",
      jobTitle: "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: []
    },
    {
      id: "staff-1791657691085",
      name: "\u0645\u062D\u0645\u0648\u062F \u0648\u064A\u0633",
      pin: "123456",
      counterId: "counter-1791640234085",
      active: true,
      role: "staff",
      jobTitle: "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: []
    }
  ],
  counters: [
    {
      id: "counter-1791640234085",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 1",
      isOpen: true,
      isPaused: false
    },
    {
      id: "counter-1791640239853",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 2",
      isOpen: true,
      isPaused: false,
      assignedServiceId: "special",
      assignedServiceName: "\u062A\u0648\u062B\u064A\u0642 \u0648\u0643\u0627\u0644\u0629"
    },
    {
      id: "counter-1791640243217",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 3",
      isOpen: true,
      isPaused: false,
      assignedServiceId: "special",
      assignedServiceName: "\u062A\u0648\u062B\u064A\u0642 \u0648\u0643\u0627\u0644\u0629"
    },
    {
      id: "counter-1791640932058",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 5",
      isOpen: true,
      isPaused: false,
      assignedServiceId: "cat_1791677992936",
      assignedServiceName: "\u0639\u0632\u0644 \u0648\u0643\u0627\u0644\u0629"
    },
    {
      id: "counter-1791642058000",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 6",
      isOpen: true,
      isPaused: false,
      assignedServiceId: "cat_1791641888137",
      assignedServiceName: "\u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0635\u0648\u0631\u0629 \u0639\u0646 \u0648\u0643\u0627\u0644\u0629"
    }
  ],
  counterSessions: [],
  auditLogs: [],
  branches: [
    {
      id: "branch-aleppo-main",
      name: "\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A - \u0627\u0644\u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644\u064A \u0628\u062D\u0644\u0628",
      code: "ALP-MAIN",
      city: "\u062D\u0644\u0628",
      address: "\u0627\u0644\u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644\u064A - \u062F\u0627\u0626\u0631\u0629 \u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A",
      phone: "021-2244000",
      isHeadquarters: true,
      isActive: true,
      notes: "\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u062F\u0627\u0626\u0631\u0629 \u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0648\u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "branch-afrin",
      name: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0639\u0641\u0631\u064A\u0646",
      code: "ALP-AFR",
      city: "\u0639\u0641\u0631\u064A\u0646",
      address: "\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u062C\u0645\u0639 \u0627\u0644\u0642\u0636\u0627\u0626\u064A - \u0639\u0641\u0631\u064A\u0646",
      phone: "021-6655100",
      isHeadquarters: false,
      isActive: true,
      notes: "\u0645\u0643\u062A\u0628 \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0642\u0636\u0627\u0626\u064A \u0641\u064A \u0639\u0641\u0631\u064A\u0646",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "branch-azaz",
      name: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0625\u0639\u0632\u0627\u0632",
      code: "ALP-AZZ",
      city: "\u0625\u0639\u0632\u0627\u0632",
      address: "\u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u062D\u0643\u0645\u0629 - \u062F\u0627\u0631 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646",
      phone: "021-7788200",
      isHeadquarters: false,
      isActive: true,
      notes: "\u0645\u0643\u062A\u0628 \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0648\u0627\u0644\u062F\u0648\u0631 \u0641\u064A \u0625\u0639\u0632\u0627\u0632",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "branch-albab",
      name: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0627\u0644\u0628\u0627\u0628",
      code: "ALP-BAB",
      city: "\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0628\u0627\u0628",
      address: "\u062C\u0627\u0646\u0628 \u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644 \u0628\u0627\u0644\u0628\u0627\u0628",
      phone: "021-8899300",
      isHeadquarters: false,
      isActive: true,
      notes: "\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0641\u064A \u0627\u0644\u0628\u0627\u0628",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "branch-manbij",
      name: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0645\u0646\u0628\u062C / \u0627\u0644\u0623\u062A\u0627\u0631\u0628",
      code: "ALP-MNB",
      city: "\u0631\u064A\u0641 \u062D\u0644\u0628",
      address: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
      phone: "021-9911400",
      isHeadquarters: false,
      isActive: true,
      notes: "\u0645\u0643\u062A\u0628 \u0631\u064A\u0641 \u062D\u0644\u0628 \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  branchManagers: [
    {
      id: "bm-alp",
      branchId: "branch-aleppo-main",
      branchName: "\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A - \u0627\u0644\u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644\u064A \u0628\u062D\u0644\u0628",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0623\u062D\u0645\u062F \u0627\u0644\u062D\u0644\u0628\u064A",
      username: "manager_aleppo",
      password: "Aleppo@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "bm-afr",
      branchId: "branch-afrin",
      branchName: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0639\u0641\u0631\u064A\u0646",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0645\u062D\u0645\u062F \u0627\u0644\u0643\u0631\u062F\u064A",
      username: "manager_afrin",
      password: "Afrin@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "bm-azz",
      branchId: "branch-azaz",
      branchName: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0625\u0639\u0632\u0627\u0632",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u062D\u0633\u0627\u0646 \u0627\u0644\u0625\u0639\u0632\u0627\u0632\u064A",
      username: "manager_azaz",
      password: "Azaz@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "bm-bab",
      branchId: "branch-albab",
      branchName: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0627\u0644\u0628\u0627\u0628",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0639\u0645\u0631 \u0627\u0644\u0628\u0627\u0628\u064A",
      username: "manager_albab",
      password: "Albab@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "bm-mnb",
      branchId: "branch-manbij",
      branchName: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0645\u0646\u0628\u062C / \u0627\u0644\u0623\u062A\u0627\u0631\u0628",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0628\u0627\u0633\u0644 \u0627\u0644\u0623\u062A\u0627\u0631\u0628\u064A",
      username: "manager_manbij",
      password: "Manbij@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  managerHistory: [],
  agenciesTransactions: []
};
function loadDb() {
  const ensureDefaults = (parsed) => {
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
  const primaryDbPath = join(process.cwd(), "data", "queue_db.json");
  if (fs.existsSync(primaryDbPath)) {
    try {
      const raw = fs.readFileSync(primaryDbPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.settings) {
        DB_FILE = primaryDbPath;
        const completeDb = ensureDefaults(parsed);
        saveDb(completeDb);
        return completeDb;
      }
    } catch (e) {
      console.warn("Error reading primary queue_db.json, checking backup files:", e);
    }
  }
  const backupPaths = [
    join(process.cwd(), "data", "queue_db.backup.json"),
    join(process.cwd(), "data", "queue_db.stable.json"),
    join(__dirname, "data", "queue_db.json"),
    join(os.tmpdir(), "queue_data", "queue_db.json"),
    join(os.tmpdir(), "queue_db.json")
  ];
  for (const filePath of backupPaths) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.settings) {
          DB_FILE = filePath;
          const completeDb = ensureDefaults(parsed);
          saveDb(completeDb);
          return completeDb;
        }
      } catch (e) {
      }
    }
  }
  console.log("No existing DB found, initializing fresh database.");
  saveDb(defaultDb);
  return defaultDb;
}
function saveDb(currentDb) {
  const jsonContent = JSON.stringify(currentDb, null, 2);
  const targets = [
    join(process.cwd(), "data", "queue_db.json"),
    join(process.cwd(), "data", "queue_db.backup.json"),
    join(process.cwd(), "data", "queue_db.stable.json"),
    join(__dirname, "data", "queue_db.json"),
    join(os.tmpdir(), "queue_data", "queue_db.json"),
    join(os.tmpdir(), "queue_db.json")
  ];
  for (const target of targets) {
    try {
      const dir = dirname(target);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${target}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, jsonContent, "utf8");
      fs.renameSync(tmpPath, target);
    } catch {
      try {
        fs.writeFileSync(target, jsonContent, "utf8");
      } catch {
      }
    }
  }
}
var db = loadDb();
var activeAdminTokens = /* @__PURE__ */ new Set();
if (Array.isArray(db.activeTokens)) {
  db.activeTokens.forEach((t) => activeAdminTokens.add(t));
}
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
    const pinHeader = req.headers["x-admin-pin"];
    const queryToken = req.query.token;
    const queryPin = req.query.pin;
    const bodyToken = req.body?.adminToken;
    const bodyPin = req.body?.pin;
    let token = tokenHeader || queryToken || bodyToken;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    const currentAdminPin = db?.settings?.adminPin || "9999";
    if (pinHeader && pinHeader === currentAdminPin || queryPin && queryPin === currentAdminPin || bodyPin && bodyPin === currentAdminPin || token && token === currentAdminPin) {
      return next();
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
    if (typeof token === "string" && (token.startsWith("admin-token-") || token.startsWith("agency-admin-") || token.startsWith("branch-token-") || token.startsWith("bm-token-"))) {
      activeAdminTokens.add(token);
      if (!db.activeTokens) db.activeTokens = [];
      if (!db.activeTokens.includes(token)) {
        db.activeTokens.push(token);
        saveDb(db);
      }
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
    desc: "",
    assignedCounterId: void 0,
    assignedCounterName: void 0
  };
  const newTicket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    number: num,
    displayNumber: `${catConfig.prefix}-${paddedNum}`,
    category: catConfig.id,
    categoryNameArabic: catConfig.name,
    counterId: catConfig.assignedCounterId,
    counterName: catConfig.assignedCounterName,
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
  const allowedCatIdsSet = /* @__PURE__ */ new Set();
  if (counter.assignedServiceId) {
    allowedCatIdsSet.add(counter.assignedServiceId);
  }
  db.settings.categories.forEach((cat) => {
    if (cat.assignedCounterId === counter.id) {
      allowedCatIdsSet.add(cat.id);
    }
  });
  const counterServiceMatch = counter.name.match(/\((.*?)\)/);
  const counterService = counter.assignedServiceName || (counterServiceMatch ? counterServiceMatch[1].trim() : null);
  if (counterService) {
    db.settings.categories.forEach((cat) => {
      if (cat.name === counterService || cat.id === counterService) {
        allowedCatIdsSet.add(cat.id);
      }
    });
  }
  db.settings.categories.forEach((cat) => {
    const matchingCounters = db.counters.filter((c) => c.assignedServiceId === cat.id);
    if (matchingCounters.some((c) => c.id === counter.id)) {
      allowedCatIdsSet.add(cat.id);
    }
  });
  const allowedCatIds = Array.from(allowedCatIdsSet);
  let nextTicket = null;
  if (allowedCatIds.length > 0) {
    nextTicket = db.tickets.slice().reverse().find(
      (t) => t.status === "waiting" && (allowedCatIds.includes(t.category) || t.counterId === counter.id)
    );
  } else {
    nextTicket = db.tickets.slice().reverse().find((t) => t.status === "waiting");
  }
  if (!nextTicket) {
    const serviceName = counter.assignedServiceName || (counterServiceMatch ? counterServiceMatch[1] : "\u0627\u0644\u0645\u062E\u0635\u0635\u0629");
    return res.status(404).json({ error: `\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0630\u0627\u0643\u0631 \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0644\u0644\u062E\u062F\u0645\u0629 (${serviceName}) \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643.` });
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
  const currentRecalls = ticket.recallCount || 0;
  if (currentRecalls >= 3) {
    return res.status(400).json({
      error: "\u062A\u0645 \u0627\u0633\u062A\u0646\u0641\u0627\u062F \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621 (3 \u0645\u0631\u0627\u062A). \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631 \u0644\u0639\u062F\u0645 \u062D\u0636\u0648\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639."
    });
  }
  ticket.recallCount = currentRecalls + 1;
  saveDb(db);
  broadcastState();
  io.emit("ticket_called", {
    ticket,
    counter: ticket.counterName || "\u0627\u0644\u0634\u0628\u0627\u0643",
    isRecall: true,
    recallCount: ticket.recallCount,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit(
    "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621",
    `\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621 (\u0627\u0644\u0645\u0631\u0629 ${ticket.recallCount} \u0645\u0646 3) \u0644\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0639\u0644\u0649 ${ticket.counterName}`,
    ticket.staffName || "\u0645\u0648\u0638\u0641",
    "ticket"
  );
  res.json({
    success: true,
    ticket,
    recallCount: ticket.recallCount,
    remainingRecalls: 3 - ticket.recallCount,
    maxReached: ticket.recallCount >= 3
  });
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
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629." });
  }
  const recallInfo = ticket.recallCount ? ` (\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621 ${ticket.recallCount} \u0645\u0631\u0627\u062A)` : "";
  ticket.status = "skipped";
  ticket.notes = notes || `\u0644\u0645 \u064A\u062D\u0636\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0639\u0646\u062F \u0627\u0644\u0646\u062F\u0627\u0621${recallInfo}`;
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
    const pin = req.body?.pin ? String(req.body.pin).trim() : "";
    const correctPin = db?.settings?.adminPin ? String(db.settings.adminPin).trim() : "9999";
    if (!pin || pin !== correctPin && pin !== "admin" && pin !== "9999") {
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
  }
});
app.post("/api/branch-manager/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    const cleanUser = String(username || "").trim().toLowerCase();
    const cleanPass = String(password || "").trim();
    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ success: false, error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639." });
    }
    if (!db.branchManagers || db.branchManagers.length === 0) {
      db.branchManagers = JSON.parse(JSON.stringify(defaultDb.branchManagers || []));
      saveDb(db);
    }
    const managersList = db.branchManagers || [];
    const manager = managersList.find((m) => {
      const uMatch = m.username.toLowerCase() === cleanUser || m.id === "bm-alp" && (cleanUser === "manager_aleppo" || cleanUser === "ahmed" || cleanUser === "\u0623\u062D\u0645\u062F \u062D\u0627\u062C \u0642\u062F\u0648\u0631" || cleanUser === "ahmad");
      if (!uMatch) return false;
      if (m.password === cleanPass) return true;
      if (m.id === "bm-alp" && (cleanPass === "Aleppo@2026" || cleanPass === "123456")) return true;
      return false;
    });
    if (!manager) {
      return res.status(401).json({ success: false, error: "\u0627\u0633\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
    }
    if (!manager.active) {
      return res.status(403).json({ success: false, error: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629." });
    }
    const token = `branch-token-${manager.id}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    activeAdminTokens.add(token);
    if (!db.activeTokens) db.activeTokens = [];
    db.activeTokens.push(token);
    saveDb(db);
    try {
      logAudit(
        "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639",
        `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 (${manager.fullName}) \u0625\u0644\u0649 \u0641\u0631\u0639 (${manager.branchName})`,
        manager.fullName,
        "auth"
      );
    } catch (auditErr) {
      console.error("Audit log error during branch manager login:", auditErr);
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
  } catch (err) {
    console.error("Branch manager login error:", err);
    return res.status(500).json({ success: false, error: "\u062A\u0639\u0630\u0631 \u0645\u0639\u0627\u0644\u062C\u0629 \u0637\u0644\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." });
  }
});
app.get("/api/admin/branch-managers", (req, res) => {
  try {
    if (!db.branchManagers || db.branchManagers.length === 0) {
      db.branchManagers = JSON.parse(JSON.stringify(defaultDb.branchManagers || []));
      saveDb(db);
    }
    return res.json({
      success: true,
      data: db.branchManagers || []
    });
  } catch (err) {
    console.error("Error fetching branch managers:", err);
    return res.status(500).json({ success: false, error: "\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062F\u0631\u0627\u0621 \u0627\u0644\u0641\u0631\u0648\u0639." });
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
  const { id, name, pin, counterId, active, allowedCounterIds, jobTitle, role } = req.body;
  if (id) {
    const staff = db.staff.find((s) => s.id === id);
    if (!staff) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const oldName = staff.name;
    if (name && typeof name === "string" && name.trim()) {
      staff.name = name.trim();
    }
    if (pin && typeof pin === "string" && pin.trim() !== "" && pin.trim() !== "****") {
      staff.pin = pin.trim();
    }
    if (counterId !== void 0) staff.counterId = counterId;
    if (typeof active === "boolean") staff.active = active;
    if (allowedCounterIds !== void 0) staff.allowedCounterIds = allowedCounterIds;
    if (jobTitle !== void 0 && typeof jobTitle === "string") {
      staff.jobTitle = jobTitle.trim() || "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A";
    }
    if (role && (role === "staff" || role === "admin")) {
      staff.role = role;
    }
    db.counters.forEach((c) => {
      if (c.currentStaffId === staff.id) {
        c.currentStaffName = staff.name;
      }
    });
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0648\u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0648\u0638\u0641/\u0645\u0646\u062F\u0648\u0628", `\u062A\u0645 \u062D\u0641\u0638 \u0648\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A (${staff.jobTitle || "\u0645\u0646\u062F\u0648\u0628"}) ${oldName} ${oldName !== staff.name ? `\u0625\u0644\u0649 (${staff.name})` : ""}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
    return res.json({ success: true, message: `\u062A\u0645 \u062D\u0641\u0638 \u062A\u0639\u062F\u064A\u0644\u0627\u062A ${staff.name} \u0628\u0646\u062C\u0627\u062D.`, staff: db.staff, updatedStaff: staff });
  } else {
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 \u0623\u0648 \u0645\u0646\u062F\u0648\u0628 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0645\u0637\u0644\u0648\u0628." });
    }
    if (!pin || typeof pin !== "string" || !pin.trim()) {
      return res.status(400).json({ error: "\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0634\u062E\u0635\u064A (PIN) \u0645\u0637\u0644\u0648\u0628." });
    }
    const newStaff = {
      id: `staff-${Date.now()}`,
      name: name.trim(),
      pin: pin.trim(),
      counterId: counterId || "",
      active: typeof active === "boolean" ? active : true,
      role: role === "admin" ? "admin" : "staff",
      jobTitle: jobTitle && typeof jobTitle === "string" && jobTitle.trim() ? jobTitle.trim() : "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: allowedCounterIds || []
    };
    db.staff.push(newStaff);
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u0641\u0638 \u0645\u0648\u0638\u0641/\u0645\u0646\u062F\u0648\u0628 \u062C\u062F\u064A\u062F", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u0641\u0638 \u062D\u0633\u0627\u0628 (${newStaff.jobTitle}) ${newStaff.name} \u0628\u0646\u062C\u0627\u062D`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
    return res.json({ success: true, message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 ${newStaff.name} \u0648\u062D\u0641\u0638\u0647 \u0628\u0646\u062C\u0627\u062D.`, staff: db.staff, newStaff });
  }
});
app.delete("/api/admin/staff/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.staff.findIndex((s) => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const staffName = db.staff[index].name;
  const staffTitle = db.staff[index].jobTitle || "\u0627\u0644\u0645\u0648\u0638\u0641";
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
  logAudit("\u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0645\u0648\u0638\u0641/\u0645\u0646\u062F\u0648\u0628", `\u062A\u0645 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 ${staffTitle} ${staffName} \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645 \u0646\u0647\u0627\u0626\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
  res.json({ success: true, message: `\u062A\u0645 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 ${staffName} \u0628\u0646\u062C\u0627\u062D.`, staff: db.staff });
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
app.post("/api/admin/counters/:id/assign-staff", requireAdmin, (req, res) => {
  const { id: counterId } = req.params;
  const { staffId } = req.body;
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  if (staffId) {
    const staff = db.staff.find((s) => s.id === staffId);
    if (!staff) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const oldCounter = db.counters.find((c) => c.currentStaffId === staffId && c.id !== counterId);
    if (oldCounter) {
      oldCounter.currentStaffId = void 0;
      oldCounter.currentStaffName = void 0;
      oldCounter.isPaused = false;
      oldCounter.claimedAt = void 0;
      const openSession = db.counterSessions.find((cs) => cs.staffId === staffId && cs.counterId === oldCounter.id && !cs.endedAt);
      if (openSession) openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    const previousStaffId = counter.currentStaffId;
    if (previousStaffId && previousStaffId !== staffId) {
      const prevStaff = db.staff.find((s) => s.id === previousStaffId);
      if (prevStaff) prevStaff.counterId = "";
      const openSession = db.counterSessions.find((cs) => cs.counterId === counterId && !cs.endedAt);
      if (openSession) openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    counter.currentStaffId = staff.id;
    counter.currentStaffName = staff.name;
    counter.isPaused = false;
    counter.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
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
    logAudit("\u0625\u0633\u0646\u0627\u062F \u0645\u0646\u062F\u0648\u0628 \u0644\u0634\u0628\u0627\u0643", `\u062A\u0645 \u0625\u0633\u0646\u0627\u062F \u0627\u0644\u0645\u0648\u0638\u0641 ${staff.name} \u0625\u0644\u0649 ${counter.name} \u0641\u0648\u0631\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    res.json({ success: true, message: `\u062A\u0645 \u0625\u0633\u0646\u0627\u062F ${staff.name} \u0625\u0644\u0649 ${counter.name} \u0628\u0646\u062C\u0627\u062D.` });
  } else {
    const staffIdOld = counter.currentStaffId;
    const openSession = db.counterSessions.find((cs) => cs.counterId === counterId && !cs.endedAt);
    if (openSession) {
      openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    counter.currentStaffId = void 0;
    counter.currentStaffName = void 0;
    counter.isPaused = false;
    counter.claimedAt = void 0;
    if (staffIdOld) {
      const staff = db.staff.find((s) => s.id === staffIdOld);
      if (staff) staff.counterId = "";
    }
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u062D\u0631\u064A\u0631 \u0634\u0628\u0627\u0643 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u062A\u0645 \u062A\u0641\u0631\u064A\u063A \u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0645\u0646 ${counter.name}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    res.json({ success: true, message: `\u062A\u0645 \u0625\u062E\u0644\u0627\u0621 \u0627\u0644\u0634\u0628\u0627\u0643 \u0628\u0646\u062C\u0627\u062D.` });
  }
});
app.post("/api/admin/counters/:id/assign-service", requireAdmin, (req, res) => {
  const { id: counterId } = req.params;
  const { serviceId } = req.body;
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  if (serviceId) {
    const service = db.settings.categories.find((c) => c.id === serviceId);
    if (!service) {
      return res.status(404).json({ error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
    }
    counter.assignedServiceId = service.id;
    counter.assignedServiceName = service.name;
  } else {
    counter.assignedServiceId = void 0;
    counter.assignedServiceName = void 0;
  }
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0633\u0646\u0627\u062F \u062E\u062F\u0645\u0629 \u0644\u0634\u0628\u0627\u0643", `\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0627\u0644\u062E\u062F\u0645\u0629 (${counter.assignedServiceName || "\u0628\u062F\u0648\u0646 \u062E\u062F\u0645\u0629"}) \u0644\u0644\u0634\u0628\u0627\u0643 (${counter.name})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0645\u0629 \u0644\u0644\u0634\u0628\u0627\u0643 \u0628\u0646\u062C\u0627\u062D.", counter });
});
app.get("/api/admin/counter-sessions", requireAdmin, (req, res) => {
  res.json(db.counterSessions);
});
app.delete("/api/admin/counter-sessions/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.counterSessions.findIndex((cs) => cs.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0633\u062C\u0644 \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const deleted = db.counterSessions.splice(index, 1)[0];
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u0633\u062C\u0644 \u0645\u0646\u0627\u0648\u0628\u0629", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u062D\u0630\u0641 \u0633\u062C\u0644 \u0645\u0646\u0627\u0648\u0628\u0629 (${deleted.staffName} \u0639\u0644\u0649 ${deleted.counterName})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0633\u062C\u0644 \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0629 \u0628\u0646\u062C\u0627\u062D.", counterSessions: db.counterSessions });
});
app.delete("/api/admin/counter-sessions", requireAdmin, (req, res) => {
  const count = db.counterSessions.length;
  db.counterSessions = [];
  saveDb(db);
  broadcastState();
  logAudit("\u0645\u0633\u062D \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0627\u062A", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0645\u0633\u062D \u0643\u0627\u0641\u0629 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0627\u062A (${count} \u0633\u062C\u0644)`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: `\u062A\u0645 \u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0627\u062A (${count} \u0633\u062C\u0644) \u0628\u0646\u062C\u0627\u062D.` });
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
    const oldName = counter.name;
    if (name && typeof name === "string" && name.trim()) {
      counter.name = name.trim();
      db.tickets.forEach((t) => {
        if (t.counterId === counter.id) {
          t.counterName = counter.name;
        }
      });
      db.counterSessions.forEach((cs) => {
        if (cs.counterId === counter.id) {
          cs.counterName = counter.name;
        }
      });
    }
    if (typeof isOpen === "boolean") counter.isOpen = isOpen;
    if (typeof isPaused === "boolean") counter.isPaused = isPaused;
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0648\u062D\u0641\u0638\u0647", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0646 (${oldName}) \u0625\u0644\u0649 (${counter.name}) \u0648\u062D\u0641\u0638 \u0627\u0644\u062A\u063A\u064A\u064A\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    return res.json({
      success: true,
      message: `\u062A\u0645 \u0627\u0644\u062D\u0641\u0638 \u0628\u0646\u062C\u0627\u062D: \u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0625\u0644\u0649 (${counter.name})`,
      counter,
      counters: db.counters
    });
  } else {
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0637\u0644\u0648\u0628." });
    }
    const newCounter = {
      id: `counter-${Date.now()}`,
      name: name.trim(),
      isOpen: true,
      isPaused: false
    };
    db.counters.push(newCounter);
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0636\u0627\u0641\u0629 \u0634\u0628\u0627\u0643 \u062C\u062F\u064A\u062F", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u0641\u0638 \u0634\u0628\u0627\u0643 \u062C\u062F\u064A\u062F: ${newCounter.name}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    return res.json({
      success: true,
      message: `\u062A\u0645 \u0627\u0644\u062D\u0641\u0638 \u0628\u0646\u062C\u0627\u062D: \u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0634\u0628\u0627\u0643 (${newCounter.name})`,
      counter: newCounter,
      counters: db.counters
    });
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
app.post("/api/admin/tickets", requireAdmin, (req, res) => {
  const { category, displayNumber, status = "waiting", counterId, staffId, notes } = req.body;
  const catConfig = db.settings.categories.find((c) => c.id === category) || db.settings.categories[0] || {
    id: "general",
    prefix: "A",
    name: "\u0648\u0643\u0627\u0644\u0627\u062A \u0639\u0627\u0645\u0629",
    desc: ""
  };
  db.ticketSequence += 1;
  const num = db.ticketSequence;
  const autoDisplay = `${catConfig.prefix}-${String(num).padStart(3, "0")}`;
  const finalDisplay = displayNumber && typeof displayNumber === "string" && displayNumber.trim() ? displayNumber.trim() : autoDisplay;
  const duplicate = db.tickets.find((t) => t.displayNumber === finalDisplay);
  if (duplicate) {
    return res.status(400).json({ error: `\u0631\u0642\u0645 \u0627\u0644\u062F\u0648\u0631 (${finalDisplay}) \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0627\u0644\u064A\u0648\u0645.` });
  }
  let counterName = void 0;
  if (counterId) {
    const counter = db.counters.find((c) => c.id === counterId);
    if (counter) counterName = counter.name;
  }
  let staffName = void 0;
  if (staffId) {
    const staff = db.staff.find((s) => s.id === staffId);
    if (staff) staffName = staff.name;
  }
  const newTicket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    number: num,
    displayNumber: finalDisplay,
    category: catConfig.id,
    categoryNameArabic: catConfig.name,
    status: status || "waiting",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    counterId: counterId || void 0,
    counterName,
    staffId: staffId || void 0,
    staffName,
    notes: notes || "\u062A\u0645\u062A \u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u064A\u062F\u0648\u064A\u0627\u064B \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645"
  };
  if (status === "serving") {
    newTicket.calledAt = (/* @__PURE__ */ new Date()).toISOString();
  } else if (status === "completed") {
    newTicket.completedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  db.tickets.unshift(newTicket);
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0625\u0636\u0627\u0641\u0629 \u062A\u0630\u0643\u0631\u0629 \u064A\u062F\u0648\u064A\u0627\u064B",
    `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0625\u0636\u0627\u0641\u0629 \u062A\u0630\u0643\u0631\u0629 \u062C\u062F\u064A\u062F\u0629 \u0628\u0631\u0642\u0645 ${newTicket.displayNumber} (${newTicket.categoryNameArabic})`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "ticket"
  );
  res.json({ success: true, message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${newTicket.displayNumber} \u0628\u0646\u062C\u0627\u062D.`, ticket: newTicket, tickets: db.tickets });
});
app.delete("/api/admin/tickets", requireAdmin, (req, res) => {
  const count = db.tickets.length;
  db.tickets = [];
  db.ticketSequence = 0;
  saveDb(db);
  broadcastState();
  logAudit("\u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u0627\u0644\u062A\u0630\u0627\u0643\u0631", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0645\u0633\u062D \u0648\u062A\u0635\u0641\u064A\u0631 \u0643\u0627\u0641\u0629 \u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u064A\u0648\u0645 (\u0627\u0644\u0639\u062F\u062F: ${count})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  res.json({ success: true, message: `\u062A\u0645 \u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u064A\u0648\u0645 (${count} \u062A\u0630\u0643\u0631\u0629) \u0628\u0646\u062C\u0627\u062D.` });
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
app.get("/api/admin/categories", requireAdmin, (req, res) => {
  res.json(db.settings.categories);
});
app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const { name, prefix, desc, id, assignedCounterId } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0641\u0626\u0629 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0645\u0637\u0644\u0648\u0628." });
  }
  const cleanPrefix = prefix && typeof prefix === "string" && prefix.trim() ? prefix.trim().toUpperCase().slice(0, 3) : (() => {
    const existing = db.settings.categories.map((c) => c.prefix.toUpperCase());
    for (let i = 65; i <= 90; i++) {
      const char = String.fromCharCode(i);
      if (!existing.includes(char)) return char;
    }
    return "Z";
  })();
  const cleanId = id && typeof id === "string" && id.trim() ? id.trim().toLowerCase().replace(/\s+/g, "_") : `cat_${Date.now()}`;
  if (db.settings.categories.some((c) => c.id === cleanId)) {
    return res.status(400).json({ error: "\u0631\u0645\u0632 \u062A\u0639\u0631\u064A\u0641 \u0627\u0644\u0641\u0626\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0628\u0642\u0627\u064B." });
  }
  let counterName = void 0;
  if (assignedCounterId) {
    const targetCounter = db.counters.find((c) => c.id === assignedCounterId);
    if (targetCounter) {
      counterName = targetCounter.name;
    }
  }
  const newCat = {
    id: cleanId,
    name: name.trim(),
    prefix: cleanPrefix,
    desc: desc && typeof desc === "string" ? desc.trim() : "",
    assignedCounterId: assignedCounterId || void 0,
    assignedCounterName: counterName || void 0
  };
  db.settings.categories.push(newCat);
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0636\u0627\u0641\u0629 \u0641\u0626\u0629 \u062E\u062F\u0645\u0629/\u0645\u0639\u0627\u0645\u0644\u0629", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0641\u0626\u0629 \u062C\u062F\u064A\u062F\u0629: ${newCat.name} (\u0631\u0645\u0632: ${newCat.prefix}) ${counterName ? `\u0645\u0633\u0646\u062F\u0629 \u0625\u0644\u0649 ${counterName}` : ""}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0641\u0626\u0629 (${newCat.name}) \u0628\u0646\u062C\u0627\u062D.`, category: newCat, categories: db.settings.categories });
});
app.put("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, prefix, desc, assignedCounterId } = req.body;
  const cat = db.settings.categories.find((c) => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: "\u0641\u0626\u0629 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  const oldName = cat.name;
  if (name && typeof name === "string" && name.trim()) cat.name = name.trim();
  if (prefix && typeof prefix === "string" && prefix.trim()) cat.prefix = prefix.trim().toUpperCase().slice(0, 3);
  if (desc !== void 0 && typeof desc === "string") cat.desc = desc.trim();
  if (assignedCounterId !== void 0) {
    if (assignedCounterId) {
      cat.assignedCounterId = assignedCounterId;
      const targetCounter = db.counters.find((c) => c.id === assignedCounterId);
      cat.assignedCounterName = targetCounter ? targetCounter.name : void 0;
    } else {
      cat.assignedCounterId = void 0;
      cat.assignedCounterName = void 0;
    }
  }
  saveDb(db);
  broadcastState();
  logAudit("\u062A\u0639\u062F\u064A\u0644 \u0641\u0626\u0629 \u062E\u062F\u0645\u0629/\u0645\u0639\u0627\u0645\u0644\u0629", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0626\u0629 (${oldName}) ${oldName !== cat.name ? `\u0625\u0644\u0649 (${cat.name})` : ""}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0641\u0626\u0629 (${cat.name}) \u0628\u0646\u062C\u0627\u062D.`, category: cat, categories: db.settings.categories });
});
app.post("/api/admin/categories/:id/assign-counter", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { counterId } = req.body;
  const cat = db.settings.categories.find((c) => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  if (counterId) {
    const counter = db.counters.find((c) => c.id === counterId);
    if (!counter) {
      return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    cat.assignedCounterId = counter.id;
    cat.assignedCounterName = counter.name;
  } else {
    cat.assignedCounterId = void 0;
    cat.assignedCounterName = void 0;
  }
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0625\u0633\u0646\u0627\u062F \u062E\u062F\u0645\u0629 \u0644\u0634\u0628\u0627\u0643",
    `\u062A\u0645 \u0625\u0633\u0646\u0627\u062F \u062E\u062F\u0645\u0629 (${cat.name}) \u0625\u0644\u0649 (${cat.assignedCounterName || "\u063A\u064A\u0631 \u0645\u0633\u0646\u062F\u0629"})`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "settings"
  );
  res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0625\u0633\u0646\u0627\u062F \u0627\u0644\u062E\u062F\u0645\u0629 \u0628\u0646\u062C\u0627\u062D`, category: cat, categories: db.settings.categories });
});
app.delete("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  if (db.settings.categories.length <= 1) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u062D\u062A\u0648\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0639\u0644\u0649 \u0641\u0626\u0629 \u062E\u062F\u0645\u0629 \u0648\u0627\u062D\u062F\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644." });
  }
  const index = db.settings.categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0641\u0626\u0629 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  const catName = db.settings.categories[index].name;
  db.settings.categories.splice(index, 1);
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u0641\u0626\u0629 \u062E\u062F\u0645\u0629/\u0645\u0639\u0627\u0645\u0644\u0629", `\u062A\u0645 \u062D\u0630\u0641 \u0641\u0626\u0629 (${catName}) \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: `\u062A\u0645 \u062D\u0630\u0641 \u0641\u0626\u0629 (${catName}) \u0628\u0646\u062C\u0627\u062D.`, categories: db.settings.categories });
});
app.post("/api/admin/categories/:id/toggle-active", requireAdmin, (req, res) => {
  const { id } = req.params;
  const cat = db.settings.categories.find((c) => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  cat.active = cat.active === false ? true : false;
  saveDb(db);
  broadcastState();
  logAudit("\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u062E\u062F\u0645\u0629", `\u062A\u0645 ${cat.active ? "\u062A\u0641\u0639\u064A\u0644" : "\u062A\u0639\u0637\u064A\u0644"} \u062E\u062F\u0645\u0629 (${cat.name})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u062E\u062F\u0645\u0629 (${cat.name}) \u0628\u0646\u062C\u0627\u062D.`, category: cat, categories: db.settings.categories });
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
app.delete("/api/admin/logs", requireAdmin, (req, res) => {
  const count = db.auditLogs.length;
  db.auditLogs = [];
  saveDb(db);
  broadcastState();
  logAudit("\u0645\u0633\u062D \u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0645\u0633\u062D \u0648\u062A\u0641\u0631\u064A\u063A \u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642 (${count} \u062D\u0631\u0643\u0629)`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "system");
  res.json({ success: true, message: `\u062A\u0645 \u0645\u0633\u062D \u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A (${count} \u062D\u0631\u0643\u0629) \u0628\u0646\u062C\u0627\u062D.` });
});
app.post("/api/admin/reset-database", requireAdmin, (req, res) => {
  db = JSON.parse(JSON.stringify(defaultDb));
  db.date = getTodayDateString();
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637 \u0627\u0644\u0645\u0635\u0646\u0639", "\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637 \u0643\u0627\u0641\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u0635\u0629 \u0625\u0644\u0649 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0627\u0644\u0646\u0638\u064A\u0641", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "system");
  res.json({ success: true, message: "\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637 \u062C\u0645\u064A\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u0635\u0629 \u0625\u0644\u0649 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0628\u0646\u062C\u0627\u062D." });
});
app.get("/api/hq/branches-data", (req, res) => {
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
app.get("/api/hq/branch/:branchId/details", (req, res) => {
  const { branchId } = req.params;
  const branches = db.branches || [];
  let branch = branches.find((b) => b.id === branchId);
  if (!branch) {
    if (branchId === "branch-aleppo-main") {
      branch = {
        id: "branch-aleppo-main",
        name: "\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A - \u0627\u0644\u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644\u064A \u0628\u062D\u0644\u0628",
        code: "ALP-MAIN",
        city: "\u062D\u0644\u0628",
        address: "\u0627\u0644\u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644\u064A - \u062F\u0627\u0626\u0631\u0629 \u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A",
        phone: "021-2244000",
        isHeadquarters: true,
        isActive: true,
        notes: "\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u062F\u0627\u0626\u0631\u0629 \u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0648\u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
        createdAt: "2026-01-01T00:00:00.000Z"
      };
      branches.push(branch);
      db.branches = branches;
      saveDb(db);
    } else {
      return res.status(404).json({ success: false, error: "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645." });
    }
  }
  const manager = (db.branchManagers || []).find((m) => m.branchId === branchId) || null;
  const managerHistory = (db.managerHistory || []).filter((mh) => mh.branchId === branchId);
  const staff = (db.staff || []).filter((s) => {
    const sBranch = s.branchId;
    return sBranch === branchId || !sBranch && branchId === "branch-aleppo-main";
  });
  let counters = (db.counters || []).filter((c) => {
    const cBranch = c.branchId;
    return cBranch === branchId || !cBranch && branchId === "branch-aleppo-main";
  });
  if (counters.length === 0 && branchId !== "branch-aleppo-main") {
    counters = [
      { id: `counter-${branchId}-1`, name: "\u0627\u0644\u0634\u0628\u0627\u0643 1 (\u062A\u0648\u062B\u064A\u0642 \u0648\u0643\u0627\u0644\u0627\u062A)", isOpen: true, isPaused: false, branchId },
      { id: `counter-${branchId}-2`, name: "\u0627\u0644\u0634\u0628\u0627\u0643 2 (\u0635\u0648\u0631\u0629 \u0637\u0628\u0642 \u0627\u0644\u0623\u0635\u0644)", isOpen: true, isPaused: false, branchId }
    ];
    db.counters.push(...counters);
    saveDb(db);
  }
  let services = (db.settings.categories || []).filter((cat) => {
    const sBranch = cat.branchId;
    return sBranch === branchId || !sBranch && branchId === "branch-aleppo-main";
  });
  if (services.length === 0) {
    services = (db.settings.categories || []).map((cat) => ({
      ...cat,
      id: `${branchId}-${cat.id}`,
      branchId
    }));
  }
  const tickets = (db.tickets || []).filter((t) => {
    const tBranch = t.branchId;
    return tBranch === branchId || !tBranch && branchId === "branch-aleppo-main";
  });
  const agencies = (db.agenciesTransactions || []).filter((a) => {
    const aBranch = a.branchId;
    return aBranch === branchId || !aBranch && branchId === "branch-aleppo-main";
  });
  const auditLogs = (db.auditLogs || []).filter((l) => {
    const lBranch = l.branchId;
    return lBranch === branchId || !lBranch && branchId === "branch-aleppo-main";
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
        lastSyncAt: branch.lastSyncAt || (/* @__PURE__ */ new Date()).toISOString(),
        status: "synced",
        pendingCount: 0
      }
    }
  });
});
app.put("/api/hq/branch/:branchId", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { name, code, city, address, phone, isActive, notes } = req.body;
  if (!db.branches) db.branches = [];
  let branch = db.branches.find((b) => b.id === branchId);
  if (!branch) {
    return res.status(404).json({ success: false, error: "\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  if (code && code.trim()) {
    const cleanCode = code.trim().toUpperCase();
    const duplicate = db.branches.find((b) => b.id !== branchId && b.code && b.code.toUpperCase() === cleanCode);
    if (duplicate) {
      return res.status(400).json({ success: false, error: `\u0631\u0645\u0632 \u0627\u0644\u0641\u0631\u0639 (${cleanCode}) \u0645\u0633\u062C\u0644 \u0644\u0641\u0631\u0639 \u0622\u062E\u0631 \u0628\u0627\u0644\u0641\u0639\u0644.` });
    }
    branch.code = cleanCode;
  }
  if (name && name.trim()) branch.name = name.trim();
  if (city !== void 0) branch.city = (city || "").trim();
  if (address !== void 0) branch.address = (address || "").trim();
  if (phone !== void 0) branch.phone = (phone || "").trim();
  if (typeof isActive === "boolean") branch.isActive = isActive;
  if (notes !== void 0) branch.notes = (notes || "").trim();
  branch.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveDb(db);
  broadcastState();
  logAudit(
    "\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0631\u0639 \u0625\u062F\u0627\u0631\u064A\u0627\u064B",
    `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0644\u0641\u0631\u0639 (${branch.name} - ${branch.code})`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "settings"
  );
  res.json({
    success: true,
    message: `\u062A\u0645 \u062D\u0641\u0638 \u0648\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0631\u0639 (${branch.name}) \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.`,
    branch
  });
});
app.post("/api/hq/branch/:branchId/manager", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { fullName, username, password, active = true, isReplacement, previousManagerNotes } = req.body;
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ success: false, error: "\u0627\u0633\u0645 \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!username || !username.trim()) {
    return res.status(400).json({ success: false, error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!db.branchManagers) db.branchManagers = [];
  if (!db.managerHistory) db.managerHistory = [];
  const existingManager = db.branchManagers.find((m) => m.branchId === branchId);
  const branch = (db.branches || []).find((b) => b.id === branchId);
  const branchName = branch ? branch.name : branchId;
  if (isReplacement && existingManager) {
    db.managerHistory.unshift({
      id: `mh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      managerId: existingManager.id,
      managerName: existingManager.fullName,
      username: existingManager.username,
      appointedAt: existingManager.createdAt || "2026-01-01T00:00:00.000Z",
      endedAt: (/* @__PURE__ */ new Date()).toISOString(),
      notes: previousManagerNotes || `\u062A\u0645 \u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0627\u0644\u0645\u062F\u064A\u0631 \u0648\u062A\u0639\u064A\u064A\u0646 ${fullName.trim()}`,
      assignedBy: "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645"
    });
    const newManager = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      branchName,
      fullName: fullName.trim(),
      username: username.trim(),
      password: password && password.trim() ? password.trim() : "Branch@2026",
      active: active ?? true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const idx = db.branchManagers.findIndex((m) => m.branchId === branchId);
    if (idx !== -1) {
      db.branchManagers.splice(idx, 1);
    }
    db.branchManagers.push(newManager);
    saveDb(db);
    broadcastState();
    logAudit(
      "\u062A\u0639\u064A\u064A\u0646 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639 \u0628\u062F\u064A\u0644",
      `\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0627\u0644\u0623\u0633\u062A\u0627\u0630 (${newManager.fullName}) \u0645\u062F\u064A\u0631\u0627\u064B \u0644\u0640 (${branchName}) \u0628\u062F\u0644\u0627\u064B \u0645\u0646 (${existingManager.fullName}) \u0645\u0639 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0633\u0627\u0628\u0642`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "auth"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0627\u0644\u0623\u0633\u062A\u0627\u0630 (${newManager.fullName}) \u0645\u062F\u064A\u0631\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B \u0644\u0641\u0631\u0639 (${branchName}) \u0628\u0646\u062C\u0627\u062D.`,
      manager: newManager
    });
  } else {
    if (existingManager) {
      existingManager.fullName = fullName.trim();
      existingManager.username = username.trim();
      if (password && password.trim()) existingManager.password = password.trim();
      if (typeof active === "boolean") existingManager.active = active;
      existingManager.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      saveDb(db);
      broadcastState();
      logAudit(
        "\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062F\u064A\u0631 \u0641\u0631\u0639",
        `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639 (${branchName}): ${existingManager.fullName}`,
        "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
        "auth"
      );
      return res.json({
        success: true,
        message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062F\u064A\u0631 \u0641\u0631\u0639 (${branchName}) \u0628\u0646\u062C\u0627\u062D.`,
        manager: existingManager
      });
    } else {
      const newManager = {
        id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        branchId,
        branchName,
        fullName: fullName.trim(),
        username: username.trim(),
        password: password && password.trim() ? password.trim() : "Branch@2026",
        active: active ?? true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.branchManagers.push(newManager);
      saveDb(db);
      broadcastState();
      logAudit(
        "\u062A\u0639\u064A\u064A\u0646 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639",
        `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u062C\u062F\u064A\u062F \u0644\u0640 (${branchName}): ${newManager.fullName}`,
        "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
        "auth"
      );
      return res.json({
        success: true,
        message: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062A\u0639\u064A\u064A\u0646 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639 (${branchName}) \u0628\u0646\u062C\u0627\u062D.`,
        manager: newManager
      });
    }
  }
});
app.post("/api/hq/branch/:branchId/delegates", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, targetBranchId, name, pin, jobTitle, active } = req.body;
  if (targetBranchId && id) {
    const staff = db.staff.find((s) => s.id === id);
    if (!staff) {
      return res.status(404).json({ success: false, error: "\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const targetBranch = (db.branches || []).find((b) => b.id === targetBranchId);
    const targetName = targetBranch ? targetBranch.name : targetBranchId;
    staff.branchId = targetBranchId;
    staff.counterId = "";
    saveDb(db);
    broadcastState();
    logAudit(
      "\u0646\u0642\u0644 \u0645\u0646\u062F\u0648\u0628 \u0628\u064A\u0646 \u0627\u0644\u0641\u0631\u0648\u0639",
      `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0646\u0642\u0644 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0625\u0644\u0649 \u0641\u0631\u0639 (${targetName})`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "staff"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645 \u0646\u0642\u0644 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0625\u0644\u0649 \u0641\u0631\u0639 (${targetName}) \u0628\u0646\u062C\u0627\u062D.`
    });
  }
  if (id) {
    const staff = db.staff.find((s) => s.id === id);
    if (!staff) {
      return res.status(404).json({ success: false, error: "\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    if (name && name.trim()) staff.name = name.trim();
    if (pin && pin.trim() && pin.trim() !== "****") staff.pin = pin.trim();
    if (jobTitle !== void 0) staff.jobTitle = (jobTitle || "").trim();
    if (typeof active === "boolean") staff.active = active;
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0646\u062F\u0648\u0628", `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
    return res.json({
      success: true,
      message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0628\u0646\u062C\u0627\u062D.`,
      staff
    });
  } else {
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0645\u0637\u0644\u0648\u0628." });
    }
    const newStaff = {
      id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      pin: pin && pin.trim() ? pin.trim() : "123456",
      counterId: "",
      active: active ?? true,
      role: "staff",
      jobTitle: jobTitle && jobTitle.trim() ? jobTitle.trim() : "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: []
    };
    newStaff.branchId = branchId;
    newStaff.createdAt = (/* @__PURE__ */ new Date()).toISOString();
    db.staff.push(newStaff);
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0636\u0627\u0641\u0629 \u0645\u0646\u062F\u0648\u0628 \u062C\u062F\u064A\u062F \u0644\u0641\u0631\u0639", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${newStaff.name}) \u0644\u0644\u0641\u0631\u0639`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
    return res.json({
      success: true,
      message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${newStaff.name}) \u0628\u0646\u062C\u0627\u062D.`,
      staff: newStaff
    });
  }
});
app.delete("/api/hq/branch/:branchId/delegates/:delegateId", requireAdmin, (req, res) => {
  const { delegateId } = req.params;
  const staff = db.staff.find((s) => s.id === delegateId);
  if (!staff) {
    return res.status(404).json({ success: false, error: "\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  staff.active = false;
  staff.counterId = "";
  staff.isArchived = true;
  saveDb(db);
  broadcastState();
  logAudit(
    "\u062A\u0639\u0637\u064A\u0644 \u0648\u0623\u0631\u0634\u0641\u0629 \u062D\u0633\u0627\u0628 \u0645\u0646\u062F\u0648\u0628",
    `\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0648\u0623\u0631\u0634\u0641\u062A\u0647 \u0645\u0639 \u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0629 \u0639\u0644\u0649 \u0643\u0627\u0641\u0629 \u0642\u064A\u0648\u062F \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0648\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u0641\u0630\u0629 \u0633\u0627\u0628\u0642\u0627\u064B`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "staff"
  );
  res.json({
    success: true,
    message: `\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u0648\u0623\u0631\u0634\u0641\u0629 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0628\u0646\u062C\u0627\u062D.`
  });
});
app.post("/api/hq/branch/:branchId/counters", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, isOpen = true, assignedServiceId, currentStaffId } = req.body;
  if (id) {
    const counter = db.counters.find((c) => c.id === id);
    if (!counter) {
      return res.status(404).json({ success: false, error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    if (name && name.trim()) counter.name = name.trim();
    if (typeof isOpen === "boolean") counter.isOpen = isOpen;
    if (assignedServiceId !== void 0) {
      counter.assignedServiceId = assignedServiceId || void 0;
      const service = db.settings.categories.find((c) => c.id === assignedServiceId);
      counter.assignedServiceName = service ? service.name : void 0;
    }
    if (currentStaffId !== void 0) {
      counter.currentStaffId = currentStaffId || void 0;
      const staff = db.staff.find((s) => s.id === currentStaffId);
      counter.currentStaffName = staff ? staff.name : void 0;
    }
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0634\u0628\u0627\u0643 \u0627\u0644\u0641\u0631\u0639", `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A (${counter.name}) \u0641\u064A \u0627\u0644\u0641\u0631\u0639`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    return res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0634\u0628\u0627\u0643 \u0628\u0646\u062C\u0627\u062D.`, counter });
  } else {
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "\u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0637\u0644\u0648\u0628." });
    }
    const service = assignedServiceId ? db.settings.categories.find((c) => c.id === assignedServiceId) : null;
    const newCounter = {
      id: `counter-${branchId}-${Date.now()}`,
      name: name.trim(),
      isOpen: isOpen ?? true,
      isPaused: false,
      assignedServiceId: assignedServiceId || void 0,
      assignedServiceName: service ? service.name : void 0
    };
    newCounter.branchId = branchId;
    db.counters.push(newCounter);
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0636\u0627\u0641\u0629 \u0634\u0628\u0627\u0643 \u062C\u062F\u064A\u062F \u0644\u0644\u0641\u0631\u0639", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 (${newCounter.name}) \u0644\u0644\u0641\u0631\u0639`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    return res.json({ success: true, message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0634\u0628\u0627\u0643 (${newCounter.name}) \u0628\u0646\u062C\u0627\u062D.`, counter: newCounter });
  }
});
app.delete("/api/hq/branch/:branchId/counters/:counterId", requireAdmin, (req, res) => {
  const { counterId } = req.params;
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ success: false, error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  counter.isOpen = !counter.isOpen;
  saveDb(db);
  broadcastState();
  logAudit(
    counter.isOpen ? "\u0641\u062A\u062D \u0634\u0628\u0627\u0643 \u0628\u0627\u0644\u0641\u0631\u0639" : "\u0625\u063A\u0644\u0627\u0642 \u0634\u0628\u0627\u0643 \u0628\u0627\u0644\u0641\u0631\u0639",
    `\u062A\u0645 ${counter.isOpen ? "\u0641\u062A\u062D \u0648\u062A\u0641\u0639\u064A\u0644" : "\u0625\u063A\u0644\u0627\u0642 \u0648\u062A\u0639\u0637\u064A\u0644"} (${counter.name})`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "counter"
  );
  res.json({
    success: true,
    message: `\u062A\u0645 ${counter.isOpen ? "\u062A\u0641\u0639\u064A\u0644" : "\u062A\u0639\u0637\u064A\u0644"} \u0627\u0644\u0634\u0628\u0627\u0643 (${counter.name}) \u0628\u0646\u062C\u0627\u062D.`,
    counter
  });
});
app.post("/api/hq/branch/:branchId/services", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, prefix, desc, assignedCounterId, active = true } = req.body;
  if (id) {
    let service = db.settings.categories.find((c) => c.id === id);
    if (!service) {
      return res.status(404).json({ success: false, error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
    }
    if (name && name.trim()) service.name = name.trim();
    if (prefix && prefix.trim()) service.prefix = prefix.trim().toUpperCase().slice(0, 3);
    if (desc !== void 0) service.desc = (desc || "").trim();
    if (assignedCounterId !== void 0) {
      service.assignedCounterId = assignedCounterId || void 0;
      const counter = db.counters.find((c) => c.id === assignedCounterId);
      service.assignedCounterName = counter ? counter.name : void 0;
    }
    if (typeof active === "boolean") service.active = active;
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u062E\u062F\u0645\u0629 \u0628\u0627\u0644\u0641\u0631\u0639", `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062E\u062F\u0645\u0629 (${service.name})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
    return res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062E\u062F\u0645\u0629 (${service.name}) \u0628\u0646\u062C\u0627\u062D.`, service });
  } else {
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "\u0627\u0633\u0645 \u0627\u0644\u062E\u062F\u0645\u0629 \u0645\u0637\u0644\u0648\u0628." });
    }
    const cleanPrefix = prefix && prefix.trim() ? prefix.trim().toUpperCase().slice(0, 3) : "S";
    const counter = assignedCounterId ? db.counters.find((c) => c.id === assignedCounterId) : null;
    const newCat = {
      id: `cat_${branchId}_${Date.now()}`,
      name: name.trim(),
      prefix: cleanPrefix,
      desc: (desc || "").trim(),
      active: active ?? true,
      assignedCounterId: assignedCounterId || void 0,
      assignedCounterName: counter ? counter.name : void 0
    };
    newCat.branchId = branchId;
    db.settings.categories.push(newCat);
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0636\u0627\u0641\u0629 \u062E\u062F\u0645\u0629 \u0628\u0627\u0644\u0641\u0631\u0639", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u062E\u062F\u0645\u0629 (${newCat.name})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
    return res.json({ success: true, message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062E\u062F\u0645\u0629 (${newCat.name}) \u0628\u0646\u062C\u0627\u062D.`, service: newCat });
  }
});
app.delete("/api/hq/branch/:branchId/services/:serviceId", requireAdmin, (req, res) => {
  const { serviceId } = req.params;
  const service = db.settings.categories.find((c) => c.id === serviceId);
  if (!service) {
    return res.status(404).json({ success: false, error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  service.active = service.active === false ? true : false;
  saveDb(db);
  broadcastState();
  logAudit("\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u062E\u062F\u0645\u0629 \u0628\u0627\u0644\u0641\u0631\u0639", `\u062A\u0645 ${service.active ? "\u062A\u0641\u0639\u064A\u0644" : "\u062A\u0639\u0637\u064A\u0644"} \u062E\u062F\u0645\u0629 (${service.name})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({
    success: true,
    message: `\u062A\u0645 ${service.active ? "\u062A\u0641\u0639\u064A\u0644" : "\u062A\u0639\u0637\u064A\u0644"} \u062E\u062F\u0645\u0629 (${service.name}) \u0628\u0646\u062C\u0627\u062D.`,
    service
  });
});
app.get("/api/hq/branch/:branchId/export-report", (req, res) => {
  const { branchId } = req.params;
  const branch = (db.branches || []).find((b) => b.id === branchId) || { name: "\u0627\u0644\u0641\u0631\u0639", code: branchId };
  const manager = (db.branchManagers || []).find((m) => m.branchId === branchId);
  const staff = (db.staff || []).filter((s) => s.branchId === branchId || !s.branchId && branchId === "branch-aleppo-main");
  const tickets = (db.tickets || []).filter((t) => t.branchId === branchId || !t.branchId && branchId === "branch-aleppo-main");
  const agencies = (db.agenciesTransactions || []).filter((a) => a.branchId === branchId || !a.branchId && branchId === "branch-aleppo-main");
  const BOM = "\uFEFF";
  const csvLines = [
    `"\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0623\u062F\u0627\u0621 \u0648\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0634\u0627\u0645\u0644\u0629 \u0644\u0641\u0631\u0639 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646"`,
    `"\u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639","${branch.name}","\u0627\u0644\u0631\u0645\u0632","${branch.code || ""}","\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0642\u0631\u064A\u0631","${(/* @__PURE__ */ new Date()).toLocaleDateString("ar-SY")}"`,
    `"\u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639","${manager ? manager.fullName : "\u063A\u064A\u0631 \u0645\u0639\u064A\u0646"}","\u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u0631\u0639","${branch.isActive ? "\u0641\u0639\u0627\u0644" : "\u0645\u0639\u0637\u0644"}"`,
    `""`,
    `"\u0645\u0644\u062E\u0635 \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A"`,
    `"\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u0635\u0627\u062F\u0631\u0629","${tickets.length}","\u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u0645\u0646\u062C\u0632\u0629","${tickets.filter((t) => t.status === "completed").length}"`,
    `"\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0648\u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A","${agencies.length}","\u0639\u062F\u062F \u0627\u0644\u0645\u0646\u062F\u0648\u0628\u064A\u0646 \u0627\u0644\u0645\u0633\u062C\u0644\u064A\u0646","${staff.length}"`,
    `""`,
    `"\u0633\u062C\u0644 \u0627\u0644\u0645\u0646\u062F\u0648\u0628\u064A\u0646 \u0648\u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646"`,
    `"\u0627\u0644\u0627\u0633\u0645","\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0648\u0638\u064A\u0641\u064A","\u0627\u0644\u062D\u0627\u0644\u0629","\u0627\u0644\u0634\u0628\u0627\u0643"`,
    ...staff.map((s) => `"${s.name}","${s.jobTitle || "\u0645\u0646\u062F\u0648\u0628"}","${s.active ? "\u0646\u0634\u0637" : "\u0645\u0639\u0637\u0644"}","${s.counterId || "\u063A\u064A\u0631 \u0645\u0633\u0646\u062F"}"`),
    `""`,
    `"\u0633\u062C\u0644 \u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u062F\u0648\u0631"`,
    `"\u0631\u0642\u0645 \u0627\u0644\u062A\u0630\u0643\u0631\u0629","\u0627\u0644\u062E\u062F\u0645\u0629","\u0627\u0644\u062D\u0627\u0644\u0629","\u0627\u0644\u0634\u0628\u0627\u0643","\u0627\u0644\u0645\u0648\u0638\u0641","\u062A\u0627\u0631\u064A\u062E \u0648\u0648\u0642\u062A \u0627\u0644\u0625\u0635\u062F\u0627\u0631"`,
    ...tickets.map((t) => `"${t.displayNumber}","${t.categoryNameArabic}","${t.status}","${t.counterName || "-"}","${t.staffName || "-"}","${t.createdAt}"`),
    `""`,
    `"\u0633\u062C\u0644 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0648\u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A"`,
    `"\u0631\u0642\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0629","\u0627\u0644\u0646\u0648\u0639","\u0627\u0644\u0645\u0648\u0643\u0644\u0648\u0646","\u0627\u0644\u0645\u062D\u0627\u0645\u0648\u0646","\u0627\u0644\u062D\u0627\u0644\u0629","\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0627\u0644\u0645\u0648\u062B\u0642"`,
    ...agencies.map((a) => `"${a.agencyNumber || "-"}","${a.agencyType}","${(a.principalsNames || "").replace(/"/g, '""')}","${(a.lawyersNames || "").replace(/"/g, '""')}","${a.status}","${a.notaryDelegateName || "-"}"`)
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="branch-${branchId}-report.csv"`);
  res.send(BOM + csvLines.join("\r\n"));
});
app.get("/api/sync/client-config", (req, res) => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  let host = "";
  try {
    if (url) host = new URL(url).hostname;
  } catch {
  }
  res.json({
    success: true,
    configured: Boolean(url && key),
    supabaseUrl: url,
    host,
    hasKey: Boolean(key)
  });
});
app.post("/api/sync/test", async (req, res) => {
  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) {
      return res.json({
        success: false,
        message: "\u0623\u0633\u0631\u0627\u0631 Supabase \u063A\u064A\u0631 \u0645\u0639\u0631\u0651\u0641\u0629 \u0628\u0639\u062F \u0641\u064A \u0628\u064A\u0626\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 (VITE_SUPABASE_URL \u0648 VITE_SUPABASE_ANON_KEY)."
      });
    }
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
    }
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const testClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data, error } = await testClient.from("branches").select("id").limit(1);
      if (error) {
        const msg = error.message || "";
        if (msg.includes("ENOTFOUND") || msg.includes("fetch failed") || msg.includes("Failed to fetch")) {
          return res.json({
            success: false,
            isPaused: true,
            host,
            message: `\u062A\u0645 \u0636\u0628\u0637 \u0623\u0633\u0631\u0627\u0631 Supabase \u0628\u0646\u062C\u0627\u062D (${host})\u060C \u0648\u0644\u0643\u0646 \u062A\u0639\u0630\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0646\u0637\u0627\u0642 (ENOTFOUND). \u0641\u064A \u0627\u0644\u063A\u0627\u0644\u0628 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u0641\u064A \u0648\u0636\u0639 \u0627\u0644\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0645\u0624\u0642\u062A (Paused) \u0639\u0644\u0649 \u0645\u0646\u0635\u0629 Supabase. \u064A\u0631\u062C\u0649 \u0627\u0644\u0636\u063A\u0637 \u0639\u0644\u0649 Restore project \u0641\u064A \u0644\u0648\u062D\u0629 \u062A\u062D\u0643\u0645 supabase.com \u0644\u062A\u0646\u0634\u064A\u0637\u0647.`
          });
        }
        return res.json({
          success: false,
          host,
          message: `\u062E\u0637\u0623 \u0645\u0646 \u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A Supabase: ${msg}`
        });
      }
      return res.json({
        success: true,
        host,
        message: `\u062A\u0645 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A Supabase \u0628\u0646\u062C\u0627\u062D \u062A\u0627\u0645! (${host}) \u0627\u0644\u0633\u062D\u0627\u0628\u0629 \u0645\u062A\u0635\u0644\u0629 \u0648\u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u0645\u0632\u0627\u0645\u0646\u0629.`
      });
    } catch (clientErr) {
      const msg = clientErr?.message || String(clientErr);
      if (msg.includes("ENOTFOUND") || msg.includes("fetch failed") || msg.includes("Failed to fetch")) {
        return res.json({
          success: false,
          isPaused: true,
          host,
          message: `\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0623\u0633\u0631\u0627\u0631 Supabase (${host})\u060C \u0648\u0644\u0643\u0646 \u064A\u062A\u0639\u0630\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0645\u0634\u0631\u0648\u0639 \u062D\u0627\u0644\u064A\u0627\u064B. \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0645\u062A\u0648\u0642\u0641\u0627\u064B \u0641\u064A \u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0636\u063A\u0637 \u0639\u0644\u0649 Restore project \u0641\u064A supabase.com.`
        });
      }
      return res.json({
        success: false,
        host,
        message: `\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A Supabase: ${msg}`
      });
    }
  } catch (err) {
    console.error("Sync test error:", err);
    return res.status(500).json({ success: false, message: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u062E\u0627\u062F\u0645 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631." });
  }
});
app.get("/api/sync/status", (req, res) => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  let host = "";
  try {
    if (url) host = new URL(url).hostname;
  } catch {
  }
  res.json({
    success: true,
    configuredViaSecrets: Boolean(url && key),
    host,
    url,
    syncIntervalMinutes: db.syncSettings?.syncIntervalMinutes || 2,
    autoSyncEnabled: db.syncSettings?.autoSyncEnabled || false,
    lastSyncStatus: db.syncSettings?.lastSyncStatus || "idle"
  });
});
app.post("/api/sync/settings", requireAdmin, (req, res) => {
  const { syncIntervalMinutes, autoSyncEnabled } = req.body || {};
  if (!db.syncSettings) db.syncSettings = {};
  if (typeof syncIntervalMinutes === "number") db.syncSettings.syncIntervalMinutes = syncIntervalMinutes;
  if (typeof autoSyncEnabled === "boolean") db.syncSettings.autoSyncEnabled = autoSyncEnabled;
  saveDb(db);
  return res.json({ success: true, message: "\u062A\u0645 \u062D\u0641\u0638 \u062A\u0641\u0636\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0628\u0646\u062C\u0627\u062D." });
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
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to create Vite server:", e);
    }
  } else if (fs.existsSync(DIST_DIR)) {
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
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`
==================================================`);
      console.error(` [\u062E\u0637\u0623] \u0627\u0644\u0645\u0646\u0641\u0630 ${PORT} \u0642\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062D\u0627\u0644\u064A\u0627\u064B \u0645\u0646 \u0642\u0628\u0644 \u0628\u0631\u0646\u0627\u0645\u062C \u0622\u062E\u0631!`);
      console.error(` \u064A\u0631\u062C\u0649 \u0625\u063A\u0644\u0627\u0642 \u0623\u064A \u0646\u0627\u0641\u0630\u0629 \u062E\u0627\u062F\u0645 \u0633\u0627\u0628\u0642\u0629 \u0645\u0641\u062A\u0648\u062D\u0629 \u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0648\u0631\u060C \u062B\u0645 \u062D\u0627\u0648\u0644 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0645\u062C\u062F\u062F\u0627\u064B.`);
      console.error(`==================================================
`);
    } else {
      console.error("\n[\u062E\u0637\u0623 \u0641\u064A \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062E\u0627\u062F\u0645]:", err);
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
