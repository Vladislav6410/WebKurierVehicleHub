import crypto from "crypto";

const CHAIN_URL = process.env.CHAIN_URL || "http://localhost:4100";
const SECRET = process.env.CHAIN_HMAC_SECRET || "";

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmacHex(data) {
  if (!SECRET) throw new Error("CHAIN_HMAC_SECRET is empty");
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

export function signPayload(payload) {
  const ts = Date.now();
  const nonce = crypto.randomBytes(12).toString("hex");
  const payloadHash = sha256Hex(JSON.stringify(payload));
  const sig = hmacHex(`${payloadHash}|${ts}|${nonce}`);
  return { payload, payloadHash, ts, nonce, sig };
}

export async function chainAppend(payload) {
  const envelope = signPayload(payload);

  const r = await fetch(`${CHAIN_URL}/api/chain/append`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelope }),
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`CHAIN_APPEND_FAILED: ${r.status} ${text}`);
  return JSON.parse(text);
}

/** Helper: hash a file without loading into memory */
export async function hashFileSha256(filePath) {
  const fs = await import("fs");
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(filePath);
    s.on("data", (d) => h.update(d));
    s.on("error", reject);
    s.on("end", () => resolve(h.digest("hex")));
  });
}