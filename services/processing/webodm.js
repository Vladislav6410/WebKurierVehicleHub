import path from "path";
import fs from "fs";
import { store } from "../../data/store.js";

const DATA_DIR = process.env.DATA_DIR || "./data";
const RESULTS_DIR = path.join(DATA_DIR, "results");
fs.mkdirSync(RESULTS_DIR, { recursive: true });

function mkResultFile(missionId, type) {
  const filename = `${missionId}_${type}_${Date.now()}.json`;
  const abs = path.join(RESULTS_DIR, filename);
  const url = `/files/results/${filename}`;
  return { abs, url, filename };
}

/**
 * Сейчас: MOCK job, чтобы всё работало сразу.
 * Позже: подключим WebODM REST API (create project / upload images / run task).
 */
export async function startProcessingJob({ missionId, type }) {
  const mission = store.getMission(missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");

  store.setProcessingState(missionId, { state: "running", lastType: type, startedAt: new Date().toISOString() });

  // mock delay
  setTimeout(() => {
    const out = mkResultFile(missionId, type);
    const payload = {
      missionId,
      type,
      status: "done",
      createdAt: new Date().toISOString(),
      note: "MOCK output. Replace with WebODM integration.",
      outputs: {
        // в реале будут GeoTIFF/OBJ/GLB/LAZ etc.
        previewUrl: type === "ortho"
          ? "https://placehold.co/900x600/4F46E5/FFFFFF?text=Ortho+Map"
          : type === "dsm"
          ? "https://placehold.co/900x600/059669/FFFFFF?text=DSM"
          : "https://placehold.co/900x600/DC2626/FFFFFF?text=3D+Model",
      },
    };

    fs.writeFileSync(out.abs, JSON.stringify(payload, null, 2), "utf-8");

    store.setProcessingState(missionId, {
      state: "done",
      finishedAt: new Date().toISOString(),
      outputs: {
        ...(mission.processing?.outputs || {}),
        [type]: { url: out.url, kind: "json", previewUrl: payload.outputs.previewUrl },
      },
    });
  }, 1200);

  return { missionId, type, state: "running" };
}