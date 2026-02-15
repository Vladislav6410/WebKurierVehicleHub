import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { store } from "../../data/store.js";
import {
  createProject,
  createTask,
  getTask,
  getTaskAssets,
  guessOutputsFromAssets,
} from "../../services/processing/webodm-rest.js";

import { chainAppend } from "../../services/chain/chain-client.js";

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || "./data";
const IMAGES_DIR = path.join(DATA_DIR, "images");
fs.mkdirSync(IMAGES_DIR, { recursive: true });

/* ===============================
   Multer config (image uploads)
================================ */
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const missionId = req.params.id;
      const dir = path.join(IMAGES_DIR, missionId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_, file, cb) =>
      cb(null, `${Date.now()}_${file.originalname}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per image
});

/* ===============================
   1) CREATE PROJECT
   POST /api/missions/:id/webodm/project
================================ */
router.post("/:id/webodm/project", async (req, res) => {
  const missionId = req.params.id;
  const mission = store.getMission(missionId);
  if (!mission)
    return res.status(404).json({ error: "MISSION_NOT_FOUND" });

  try {
    const projectName = `WK-${mission.name}-${missionId.slice(0, 8)}`;
    const project = await createProject({ name: projectName });

    const updated = store.patchMission(missionId, {
      webodm: {
        ...(mission.webodm || {}),
        projectId: project.id,
        projectName: project.name,
      },
    });

    res.json({ ok: true, project, mission: updated });
  } catch (e) {
    res.status(500).json({
      error: "WEBODM_PROJECT_CREATE_FAILED",
      details: String(e?.message || e),
    });
  }
});

/* ===============================
   2) UPLOAD IMAGES
   POST /api/missions/:id/webodm/images
================================ */
router.post(
  "/:id/webodm/images",
  upload.array("images", 5000),
  async (req, res) => {
    const missionId = req.params.id;
    const mission = store.getMission(missionId);
    if (!mission)
      return res.status(404).json({ error: "MISSION_NOT_FOUND" });

    const files = req.files || [];
    const rel = files.map((f) => ({
      originalName: f.originalname,
      storedPath: f.path,
      size: f.size,
    }));

    const updated = store.patchMission(missionId, {
      images: [...(mission.images || []), ...rel],
    });

    res.json({ ok: true, added: rel.length, mission: updated });
  }
);

/* ===============================
   3) CREATE TASK
   POST /api/missions/:id/webodm/task
================================ */
router.post("/:id/webodm/task", async (req, res) => {
  const missionId = req.params.id;
  const mission = store.getMission(missionId);
  if (!mission)
    return res.status(404).json({ error: "MISSION_NOT_FOUND" });

  const projectId = mission.webodm?.projectId;
  if (!projectId)
    return res.status(400).json({ error: "WEBODM_PROJECT_REQUIRED" });

  if (!mission.images?.length)
    return res.status(400).json({ error: "NO_IMAGES_UPLOADED" });

  try {
    const taskName =
      req.body?.name ||
      `Task-${mission.name}-${new Date().toISOString()}`;

    const options = req.body?.options || null;

    const task = await createTask({
      projectId,
      name: taskName,
      imagePaths: mission.images.map((x) => x.storedPath),
      options,
    });

    const updated = store.patchMission(missionId, {
      webodm: {
        ...(mission.webodm || {}),
        lastTaskId: task.id,
        lastTaskName: task.name,
      },
      processing: {
        ...(mission.processing || {}),
        state: "running",
        startedAt: new Date().toISOString(),
      },
    });

    res.json({ ok: true, task, mission: updated });
  } catch (e) {
    res.status(500).json({
      error: "WEBODM_TASK_CREATE_FAILED",
      details: String(e?.message || e),
    });
  }
});

/* ===============================
   4) GET TASK STATUS
   GET /api/missions/:id/webodm/task/:taskId
================================ */
router.get("/:id/webodm/task/:taskId", async (req, res) => {
  try {
    const task = await getTask({ taskId: req.params.taskId });
    res.json({ ok: true, task });
  } catch (e) {
    res.status(500).json({
      error: "WEBODM_TASK_GET_FAILED",
      details: String(e?.message || e),
    });
  }
});

/* ===============================
   5) SYNC TASK + STORE OUTPUTS
   POST /api/missions/:id/webodm/sync
================================ */
router.post("/:id/webodm/sync", async (req, res) => {
  const missionId = req.params.id;
  const mission = store.getMission(missionId);
  if (!mission)
    return res.status(404).json({ error: "MISSION_NOT_FOUND" });

  const taskId = mission.webodm?.lastTaskId;
  if (!taskId)
    return res.status(400).json({ error: "NO_TASK" });

  try {
    const task = await getTask({ taskId });
    const assets = await getTaskAssets({ taskId });

    const outputs = guessOutputsFromAssets(assets);

    const processingState =
      task.status === "COMPLETED"
        ? {
            state: "done",
            finishedAt: new Date().toISOString(),
            outputs,
          }
        : task.status === "FAILED"
        ? { state: "failed" }
        : { state: "running" };

    const updated = store.setProcessingState(
      missionId,
      processingState
    );

    /* ===============================
       CHAIN AUDIT: PROCESSING_DONE
    ============================== */
    if (task.status === "COMPLETED") {
      try {
        await chainAppend({
          event: "PROCESSING_DONE",
          at: new Date().toISOString(),
          mission: {
            id: missionId,
            name: mission.name,
          },
          webodm: {
            projectId: mission.webodm?.projectId,
            taskId: task.id,
            taskName: task.name,
            options: task.options || null,
          },
          outputs: outputs || null,
        });
      } catch (e) {
        console.warn(
          "[Chain] PROCESSING_DONE append failed:",
          e?.message || e
        );
      }
    }

    res.json({ ok: true, task, outputs, mission: updated });
  } catch (e) {
    res.status(500).json({
      error: "WEBODM_SYNC_FAILED",
      details: String(e?.message || e),
    });
  }
});

export default router;