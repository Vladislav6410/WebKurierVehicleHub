import { WebSocketServer } from "ws";
import { startTelemetryUdpIngest } from "./telemetry-udp-ingest.js";

export const telemetryState = {
  altitude: 0,
  speed: 0,
  battery: 0,
  gps: "—",
  heading: 0,
};

/**
 * WebSocket endpoint:
 *   ws://host:port/ws/telemetry
 *
 * telemetryState обновляется ТОЛЬКО через telemetry-udp-ingest.js
 * (Python MAVLink bridge -> UDP JSON -> here)
 */
export function attachTelemetryWs(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws/telemetry",
  });

  // start UDP ingest (from mavlink_bridge.py)
  startTelemetryUdpIngest();

  wss.on("connection", (ws) => {
    // send current snapshot immediately
    ws.send(
      JSON.stringify({
        type: "telemetry",
        data: telemetryState,
        ts: Date.now(),
      })
    );

    ws.on("message", (raw) => {
      // future: subscriptions / rate control / commands
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        }
      } catch (_) {}
    });
  });

  // broadcast loop (pure relay, NO MOCKING)
  setInterval(() => {
    const payload = JSON.stringify({
      type: "telemetry",
      data: telemetryState,
      ts: Date.now(),
    });

    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }, 250); // ~4 Hz to UI

  console.log("[DroneHybrid] WS telemetry ready at /ws/telemetry");
}