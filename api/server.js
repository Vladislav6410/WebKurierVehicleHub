import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import missionsRouter from "./routes/missions.js";
import telemetryRouter from "./routes/telemetry.js";
import flightRouter from "./routes/flight.js";
import { attachTelemetryWs } from "./ws/telemetry-ws.js";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const DATA_DIR = process.env.DATA_DIR || "./data";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.use("/api/telemetry", telemetryRouter);
app.use("/api/flight", flightRouter);

// HTTP server + WebSocket
const server = app.listen(PORT, () => {
  console.log(`[DroneHybrid] API listening on :${PORT}`);
});

attachTelemetryWs(server);

process.on("SIGINT", () => {
  console.log("\n[DroneHybrid] shutting down...");
  server.close(() => process.exit(0));
});
