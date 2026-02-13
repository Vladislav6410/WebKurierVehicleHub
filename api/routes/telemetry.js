import express from "express";
import { telemetryState } from "../ws/telemetry-ws.js";

const router = express.Router();

// GET /api/telemetry (snapshot)
router.get("/", (_, res) => {
  res.json({ ...telemetryState, ts: Date.now() });
});

export default router;