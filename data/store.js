import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const STORE_PATH = path.join(DATA_DIR, "missions.json");

// in-memory cache
let state = {
  missions: {},
};

/* =========================
   Utils
========================= */

function safeId(id) {
  const s = String(id || "");
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(s)) return null;
  return s;
}

function genId() {
  return crypto.randomBytes(12).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromDisk() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    persist();
    return;
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state = parsed;
    }
  } catch (e) {
    console.warn("[Store] failed to load missions.json:", e?.message || e);
  }
}

function persist() {
  ensureDataDir();
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.warn("[Store] persist failed:", e?.message || e);
  }
}

/* =========================
   Public API
========================= */

loadFromDisk();

export const store = {
  /* Create mission */
  createMission(payload) {
    const id = genId();

    const mission = {
      id,
      ...payload,
      updatedAt: nowIso(),
    };

    state.missions[id] = mission;
    persist();
    return mission;
  },

  /* Get one mission */
  getMission(id) {
    const sid = safeId(id);
    if (!sid) return null;
    return state.missions[sid] || null;
  },

  /* List missions */
  listMissions() {
    return Object.values(state.missions).sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
  },

  /* Patch mission */
  patchMission(id, patch) {
    const sid = safeId(id);
    if (!sid || !state.missions[sid]) return null;

    state.missions[sid] = {
      ...state.missions[sid],
      ...patch,
      updatedAt: nowIso(),
    };

    persist();
    return state.missions[sid];
  },

  /* Processing helper */
  setProcessingState(id, processingPatch) {
    const sid = safeId(id);
    if (!sid || !state.missions[sid]) return null;

    state.missions[sid].processing = {
      ...(state.missions[sid].processing || {}),
      ...processingPatch,
    };

    state.missions[sid].updatedAt = nowIso();
    persist();
    return state.missions[sid];
  },

  /* Append images helper (optional) */
  appendImages(id, images = []) {
    const sid = safeId(id);
    if (!sid || !state.missions[sid]) return null;

    state.missions[sid].images = [
      ...(state.missions[sid].images || []),
      ...images,
    ];

    state.missions[sid].updatedAt = nowIso();
    persist();
    return state.missions[sid];
  },

  /* Danger zone: reset store (dev only) */
  _resetAll() {
    state = { missions: {} };
    persist();
  },
};