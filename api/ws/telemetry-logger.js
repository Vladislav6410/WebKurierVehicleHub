import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const TELE_DIR = path.join(DATA_DIR, "telemetry");
fs.mkdirSync(TELE_DIR, { recursive: true });

// in-memory switch
const active = new Set();

export function startTelemetryLoggingForMission(missionId) {
  active.add(missionId);
}

export function stopTelemetryLoggingForMission(missionId) {
  active.delete(missionId);
}

export function appendTelemetry(missionId, telemetryObj) {
  if (!active.has(missionId)) return;

  const fp = path.join(TELE_DIR, `${missionId}.jsonl`);
  const line = JSON.stringify({ ts: Date.now(), ...telemetryObj }) + "\n";
  fs.appendFileSync(fp, line, "utf-8");
}