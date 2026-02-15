import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "fs";

import { v4 as uuidv4 } from "uuid";
import { store } from "../../data/store.js";
import { parseAoiFileToFeatureCollection, computeAreaKm2 } from "../../services/aoi/aoi.js";
import { planMissionFromAoi } from "../../services/planner/planner.js";
import { startProcessingJob } from "../../services/processing/webodm.js";
import { chainAppend, hashFileSha256 } from "../../services/chain/chain-client.js";

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || "./data";
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const RESULTS_DIR = path.join(DATA_DIR, "results");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${Date.now()}_${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// GET /api/missions
router.get("/", (_, res) => {
  res.json({ items: store.listMissions() });
});

// GET /api/missions/:id
router.get("/:id", (req, res) => {
  const mission = store.getMission(req.params.id);
  if (!mission) return res.status(404).json({ error: "MISSION_NOT_FOUND" });
  res.json(mission);
});

// POST /api/missions (multipart: aoi + params)
router.post("/", upload.single("aoi"), async (req, res) => {
  try {
    const { name, camera, gsd, overlap, speed } = req.body;

    if (!name) return res.status(400).json({ error: "NAME_REQUIRED" });
    if (!req.file) return res.status(400).json({ error: "AOI_FILE_REQUIRED" });

    const aoiPath = req.file.path;
    const aoiFc = await parseAoiFileToFeatureCollection(aoiPath, req.file.originalname);
    const areaKm2 = computeAreaKm2(aoiFc);

    const plan = planMissionFromAoi({
      aoiFeatureCollection: aoiFc,
      cameraId: camera || "sony_a6000_16mm",
      gsdCmPerPx: Number(gsd || 3.0),
      overlapPct: Number(overlap || 80),
      speedMps: Number(speed || 10),
    });

    const mission = store.createMission({
      name,
      status: "planned",
      createdAt: new Date().toISOString(),
      areaKm2,
      gsdCmPerPx: Number(gsd || 3.0),
      overlapPct: Number(overlap || 80),
      speedMps: Number(speed || 10),
      camera: camera || "sony_a6000_16mm",
      aoiFile: {
        originalName: req.file.originalname,
        storedName: path.basename(aoiPath),
        url: `/files/uploads/${path.basename(aoiPath)}`,
      },
      plan,
      processing: { state: "idle", outputs: {} },
    });

    // --- Chain audit: MISSION_CREATED ---
    try {
      const aoiStoredPath = req.file.path;
      const aoiHash = await hashFileSha256(aoiStoredPath);

      await chainAppend({
        event: "MISSION_CREATED",
        at: new Date().toISOString(),
        mission: {
          id: mission.id,
          name: mission.name,
          areaKm2: mission.areaKm2,
          camera: mission.camera,
          gsdCmPerPx: mission.gsdCmPerPx,
          overlapPct: mission.overlapPct,
          speedMps: mission.speedMps,
        },
        aoi: {
          originalName: req.file.originalname,
          storedName: path.basename(aoiStoredPath),
          sha256: aoiHash,
        },
        plan: mission.plan?.derived || null,
      });
    } catch (e) {
      console.warn("[Chain] MISSION_CREATED append failed:", e?.message || e);
    }

    res.status(201).json(mission);
  } catch (e) {
    console.error("[missions.create] error:", e);
    res.status(500).json({ error: "MISSION_CREATE_FAILED", details: String(e?.message || e) });
  }
});

// POST /api/missions/:id/process (body: {type:'ortho'|'dsm'|'model'})
router.post("/:id/process", async (req, res) => {
  const missionId = req.params.id;
  const { type } = req.body;

  const mission = store.getMission(missionId);
  if (!mission) return res.status(404).json({ error: "MISSION_NOT_FOUND" });

  const allowed = new Set(["ortho", "dsm", "model"]);
  if (!allowed.has(type)) return res.status(400).json({ error: "INVALID_PROCESSING_TYPE" });

  try {
    const job = await startProcessingJob({ missionId, type });
    res.json({ ok: true, job });
  } catch (e) {
    console.error("[missions.process] error:", e);
    res.status(500).json({ error: "PROCESSING_START_FAILED", details: String(e?.message || e) });
  }
});

export default router;
