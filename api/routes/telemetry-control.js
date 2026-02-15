import express from "express";
import { store } from "../../data/store.js";
import { setActiveMissionId } from "../ws/telemetry-active-mission.js";
import { startTelemetryLoggingForMission } from "../ws/telemetry-logger.js";

const router = express.Router();

// POST /api/missions/:id/telemetry/start
router.post("/:id/telemetry/start", (req, res) => {
  const missionId = req.params.id;
  const mission = store.getMission(missionId);
  if (!mission) return res.status(404).json({ error: "MISSION_NOT_FOUND" });

  setActiveMissionId(missionId);
  startTelemetryLoggingForMission(missionId);

  res.json({ ok: true, activeMissionId: missionId });
});

export default router;