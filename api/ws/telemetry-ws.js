import { WebSocketServer } from "ws";

export const telemetryState = {
  altitude: 120,
  speed: 8.5,
  battery: 78,
  gps: "RTK Fixed",
  heading: 142,
};

function jitter(n, amp) {
  return n + (Math.random() * 2 - 1) * amp;
}

function tickMock() {
  telemetryState.altitude = Math.max(0, jitter(telemetryState.altitude, 0.8));
  telemetryState.speed = Math.max(0, jitter(telemetryState.speed, 0.2));
  telemetryState.battery = Math.max(0, telemetryState.battery - Math.random() * 0.02);
  telemetryState.heading = (telemetryState.heading + Math.random() * 2) % 360;

  // GPS status pseudo
  const r = Math.random();
  telemetryState.gps = r < 0.92 ? "RTK Fixed" : r < 0.98 ? "RTK Float" : "3D Fix";
}

export function attachTelemetryWs(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/telemetry" });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "telemetry", data: telemetryState, ts: Date.now() }));

    ws.on("message", (raw) => {
      // future: allow client subscriptions, rate control, etc.
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === "ping") ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      } catch (_) {}
    });
  });

  // broadcast loop
  setInterval(() => {
    tickMock();
    const payload = JSON.stringify({ type: "telemetry", data: telemetryState, ts: Date.now() });
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }, 500);

  console.log("[DroneHybrid] WS telemetry ready at /ws/telemetry");
}