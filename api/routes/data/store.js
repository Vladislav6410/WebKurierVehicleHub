import { v4 as uuidv4 } from "uuid";

const _missions = new Map();

export const store = {
  listMissions() {
    return Array.from(_missions.values()).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  getMission(id) {
    return _missions.get(id) || null;
  },

  createMission(m) {
    const id = uuidv4();
    const mission = { id, ...m };
    _missions.set(id, mission);
    return mission;
  },

  patchMission(id, patch) {
    const cur = _missions.get(id);
    if (!cur) return null;
    const updated = { ...cur, ...patch };
    _missions.set(id, updated);
    return updated;
  },

  setProcessingState(id, processing) {
    const cur = _missions.get(id);
    if (!cur) return null;
    const updated = { ...cur, processing: { ...(cur.processing || {}), ...processing } };
    _missions.set(id, updated);
    return updated;
  },
};