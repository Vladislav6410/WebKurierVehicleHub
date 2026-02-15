import { getActiveMissionId } from "./telemetry-active-mission.js";
import { appendTelemetry } from "./telemetry-logger.js";
if (msg?.type === "telemetry" && msg?.data) {
  Object.assign(telemetryState, msg.data);

  const mid = getActiveMissionId();
  if (mid) appendTelemetry(mid, msg.data);
}