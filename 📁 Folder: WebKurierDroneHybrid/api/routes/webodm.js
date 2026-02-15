import { chainAppend } from "../../services/chain/chain-client.js";
// --- Chain audit: PROCESSING_DONE ---
if (task.status === "COMPLETED") {
  try {
    await chainAppend({
      event: "PROCESSING_DONE",
      at: new Date().toISOString(),
      mission: { id: missionId, name: mission.name },
      webodm: {
        projectId: mission.webodm?.projectId,
        taskId: task.id,
        taskName: task.name,
        options: task.options || null
      },
      outputs: outputs || null
    });
  } catch (e) {
    console.warn("[Chain] PROCESSING_DONE append failed:", e?.message || e);
  }
}