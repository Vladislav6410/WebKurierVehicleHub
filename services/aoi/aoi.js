import fs from "fs/promises";
import path from "path";
import { DOMParser } from "xmldom";
import * as turf from "@turf/turf";

// Minimal KML -> GeoJSON parser (supports Polygon/MultiPolygon/LineString/Point)
// For production можно заменить на полноценный парсер, но этот уже рабочий для AOI-полигонов.
function kmlToGeoJSON(kmlText) {
  const doc = new DOMParser().parseFromString(kmlText, "text/xml");
  const placemarks = Array.from(doc.getElementsByTagName("Placemark"));

  const features = placemarks.map((pm) => {
    const nameEl = pm.getElementsByTagName("name")[0];
    const name = nameEl ? nameEl.textContent : "AOI";

    const poly = pm.getElementsByTagName("Polygon")[0];
    const line = pm.getElementsByTagName("LineString")[0];
    const point = pm.getElementsByTagName("Point")[0];

    const parseCoords = (coordsText) =>
      coordsText
        .trim()
        .split(/\s+/)
        .map((tuple) => tuple.split(",").map(Number))
        .map(([lon, lat]) => [lon, lat]);

    if (poly) {
      const coordsEl = poly.getElementsByTagName("coordinates")[0];
      if (!coordsEl) throw new Error("KML Polygon missing coordinates");
      const ring = parseCoords(coordsEl.textContent);
      // ensure closed ring
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);

      return {
        type: "Feature",
        properties: { name },
        geometry: { type: "Polygon", coordinates: [ring] },
      };
    }

    if (line) {
      const coordsEl = line.getElementsByTagName("coordinates")[0];
      if (!coordsEl) throw new Error("KML LineString missing coordinates");
      const coords = parseCoords(coordsEl.textContent);
      return {
        type: "Feature",
        properties: { name },
        geometry: { type: "LineString", coordinates: coords },
      };
    }

    if (point) {
      const coordsEl = point.getElementsByTagName("coordinates")[0];
      if (!coordsEl) throw new Error("KML Point missing coordinates");
      const [lon, lat] = coordsEl.textContent.trim().split(",").map(Number);
      return {
        type: "Feature",
        properties: { name },
        geometry: { type: "Point", coordinates: [lon, lat] },
      };
    }

    // If nothing matched:
    return null;
  }).filter(Boolean);

  return { type: "FeatureCollection", features };
}

function normalizeToFeatureCollection(geojson) {
  if (!geojson) throw new Error("Empty AOI");
  if (geojson.type === "FeatureCollection") return geojson;
  if (geojson.type === "Feature") return { type: "FeatureCollection", features: [geojson] };
  // Geometry
  if (geojson.type && geojson.coordinates) return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: geojson }] };
  throw new Error("Unsupported AOI GeoJSON structure");
}

export async function parseAoiFileToFeatureCollection(filePath, originalName = "") {
  const ext = (path.extname(originalName || filePath) || "").toLowerCase();

  const raw = await fs.readFile(filePath, "utf-8");

  if (ext === ".geojson" || ext === ".json") {
    const parsed = JSON.parse(raw);
    return normalizeToFeatureCollection(parsed);
  }

  if (ext === ".kml") {
    return normalizeToFeatureCollection(kmlToGeoJSON(raw));
  }

  throw new Error(`Unsupported AOI format: ${ext}. Use .geojson/.json or .kml`);
}

export function computeAreaKm2(featureCollection) {
  // Sum polygon areas; for non-polygons, area ~0
  let sum = 0;
  for (const f of featureCollection.features || []) {
    try {
      const geom = f?.geometry;
      if (!geom) continue;

      if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
        const areaM2 = turf.area(f);
        sum += areaM2;
      }
    } catch (_) {
      // ignore malformed features
    }
  }
  const km2 = sum / 1_000_000;
  return Math.round(km2 * 1000) / 1000; // 0.001 km² precision
}