import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import missionsRouter from "./routes/missions.js";
import telemetryRouter from "./routes/telemetry.js";
import flightRouter from "./routes/flight.js";
import telemetryControlRouter from "./routes/telemetry-control.js";
import { attachTelemetryWs } from "./ws/telemetry-ws.js";

// (optional) if you also added WebODM routes:
// import webodmRouter from "./routes/webodm.js";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const DATA_DIR = process.env.DATA_DIR || "./data";

// базовая папка данных + telemetry под неё
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "telemetry"), { recursive: true });

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// serve results, uploaded AOI files and telemetry logs
app.use("/files", express.static(path.resolve(DATA_DIR)));

app.get("/health", (_, res) =>
  res.json({ ok: true, service: "WebKurierDroneHybrid", ts: Date.now() })
);

app.use("/api/missions", missionsRouter);
app.use("/api/missions", telemetryControlRouter);
app.use("/api/missions", flightRouter);

// (optional) WebODM routes mounted under /api/missions/... (if you added them)
// app.use("/api/missions", webodmRouter);

app.use("/api/telemetry", telemetryRouter);

// HTTP server + WebSocket
const server = app.listen(PORT, () => {
  console.log(`[DroneHybrid] API listening on :${PORT}`);
});

attachTelemetryWs(server);

process.on("SIGINT", () => {
  console.log("\n[DroneHybrid] shutting down...");
  server.close(() => process.exit(0));
});

