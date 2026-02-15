import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const TELE_DIR = path.join(DATA_DIR, "telemetry");
fs.mkdirSync(TELE_DIR, { recursive: true });

// in-memory switch (which missions are currently logging)
const active = new Set();

function safeMissionId(missionId) {
  // Prevent path traversal and weird filenames
  // Allows letters, digits, dash, underscore only
  const id = String(missionId || "");
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  return id;
}

export function startTelemetryLoggingForMission(missionId) {
  const id = safeMissionId(missionId);
  if (!id) return;
  active.add(id);
}

export function stopTelemetryLoggingForMission(missionId) {
  const id = safeMissionId(missionId);
  if (!id) return;
  active.delete(id);
}

export function appendTelemetry(missionId, telemetryObj) {
  const id = safeMissionId(missionId);
  if (!id) return;
  if (!active.has(id)) return;

  try {
    const fp = path.join(TELE_DIR, `${id}.jsonl`);
    const payload =
      telemetryObj && typeof telemetryObj === "object" ? telemetryObj : { value: telemetryObj };

    const line = JSON.stringify({ ts: Date.now(), ...payload }) + "\n";
    fs.appendFileSync(fp, line, "utf-8");
  } catch (e) {
    console.warn("[TelemetryLogger] append failed:", e?.message || e);
  }
}
}