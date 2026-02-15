// WebKurierDroneHybrid/api/ws/telemetry-udp-ingest.js
import dgram from "dgram";
import { telemetryState } from "./telemetry-ws.js";
import { getActiveMissionId } from "./telemetry-active-mission.js";
import { appendTelemetry } from "./telemetry-logger.js";

const PORT = Number(process.env.TELEM_UDP_PORT || 17600);
const HOST = process.env.TELEM_UDP_HOST || "0.0.0.0";

/**
 * Listens for UDP JSON packets (from Python pymavlink bridge) and updates shared telemetryState.
 * Also appends telemetry to a mission log file (jsonl) if an active mission is set.
 *
 * Expected packet format:
 * {
 *   "type": "telemetry",
 *   "data": { altitude, speed, battery, gps, heading },
 *   "ts": 1712345678901
 * }
 */
export function startTelemetryUdpIngest() {
  const sock = dgram.createSocket("udp4");

  sock.on("error", (err) => {
    console.error("[DroneHybrid] UDP telemetry ingest error:", err);
    try { sock.close(); } catch (_) {}
  });

  sock.on("message", (buf, rinfo) => {
    try {
      const raw = buf.toString("utf-8");
      const msg = JSON.parse(raw);

      if (msg?.type === "telemetry" && msg?.data && typeof msg.data === "object") {
        // Update global state (WS broadcaster will push this to clients)
        Object.assign(telemetryState, msg.data);

        // If a mission is active, append telemetry line to file
        const mid = getActiveMissionId();
        if (mid) appendTelemetry(mid, msg.data);
      }
    } catch (e) {
      // Keep it quiet; UDP can be noisy. Uncomment for debugging.
      // console.warn("[DroneHybrid] UDP telemetry parse failed:", e?.message || e, "from", rinfo);
    }
  });

  sock.bind(PORT, HOST, () => {
    console.log(`[DroneHybrid] UDP telemetry ingest on ${HOST}:${PORT}`);
  });

  return sock;
}