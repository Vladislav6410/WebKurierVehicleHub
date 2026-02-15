import express from "express";
import path from "path";
import fs from "fs";
import { store } from "../../data/store.js";
import { chainAppend, hashFileSha256 } from "../../services/chain/chain-client.js";
import { stopTelemetryLoggingForMission } from "../ws/telemetry-logger.js";

const router = express.Router();
const DATA_DIR = process.env.DATA_DIR || "./data";
const TELE_DIR = path.join(DATA_DIR, "telemetry");
fs.mkdirSync(TELE_DIR, { recursive: true });

// POST /api/missions/:id/flight/finish  body: { note?, summary? }
router.post("/:id/flight/finish", async (req, res) => {
  const missionId = req.params.id;
  const mission = store.getMission(missionId);
  if (!mission) return res.status(404).json({ error: "MISSION_NOT_FOUND" });

  // stop logger (no-op if not running)
  stopTelemetryLoggingForMission(missionId);

  const filePath = path.join(TELE_DIR, `${missionId}.jsonl`);
  if (!fs.existsSync(filePath)) return res.status(400).json({ error: "TELEMETRY_LOG_NOT_FOUND" });

  try {
    const sha256 = await hashFileSha256(filePath);

    await chainAppend({
      event: "FLIGHT_FINISHED",
      at: new Date().toISOString(),
      mission: { id: missionId, name: mission.name },
      telemetry: {
        file: `/files/telemetry/${missionId}.jsonl`,
        sha256
      },
      note: req.body?.note || null,
      summary: req.body?.summary || null
    });

    res.json({ ok: true, sha256 });
  } catch (e) {
    res.status(500).json({ error: "FLIGHT_FINISH_FAILED", details: String(e?.message || e) });
  }
});

export default router;