import * as turf from "@turf/turf";

/**
 * Camera registry (минимум для расчётов).
 * Для реальности надо: sensorWidthMm, sensorHeightMm, focalMm, imageWidthPx, imageHeightPx
 */
const CAMERAS = {
  sony_a6000_16mm: {
    name: "Sony A6000 (16mm)",
    sensorWidthMm: 23.5,
    sensorHeightMm: 15.6,
    focalMm: 16,
    imageWidthPx: 6000,
    imageHeightPx: 4000,
  },
  sony_rx1r_ii: {
    name: "Sony RX1R II (35mm)",
    sensorWidthMm: 35.9,
    sensorHeightMm: 24.0,
    focalMm: 35,
    imageWidthPx: 7952,
    imageHeightPx: 5304,
  },
  phase_one_ixu: {
    name: "Phase One IXU",
    sensorWidthMm: 53.4,
    sensorHeightMm: 40.0,
    focalMm: 50,
    imageWidthPx: 11608,
    imageHeightPx: 8708,
  },
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// GSD (cm/px) -> altitude (m)
// formula: GSD(m/px) = (H * sensorWidth(m)) / (f(m) * imageWidth(px))
// => H = GSD(m/px) * f(m) * imageWidth(px) / sensorWidth(m)
function altitudeFromGsd({ cam, gsdCmPerPx }) {
  const gsdM = gsdCmPerPx / 100.0;
  const fM = cam.focalMm / 1000.0;
  const sensorWm = cam.sensorWidthMm / 1000.0;
  const H = (gsdM * fM * cam.imageWidthPx) / sensorWm;
  return H;
}

// footprint ground size at altitude: W = H * sensorW / f
function footprintMeters({ cam, altitudeM }) {
  const fM = cam.focalMm / 1000.0;
  const sensorWm = cam.sensorWidthMm / 1000.0;
  const sensorHm = cam.sensorHeightMm / 1000.0;

  const widthM = altitudeM * (sensorWm / fM);
  const heightM = altitudeM * (sensorHm / fM);
  return { widthM, heightM };
}

/**
 * overlapPct: 80 means 80% forward overlap assumed.
 * For grid:
 *  - lineSpacing = footprintWidth * (1 - sideOverlap)
 *  - photoDistance = footprintHeight * (1 - forwardOverlap)
 * photoIntervalSec = photoDistance / speedMps
 */
export function planMissionFromAoi({
  aoiFeatureCollection,
  cameraId,
  gsdCmPerPx,
  overlapPct,
  speedMps,
}) {
  const cam = CAMERAS[cameraId] || CAMERAS.sony_a6000_16mm;

  const forwardOverlap = clamp(overlapPct / 100, 0.5, 0.95); // sane bounds
  const sideOverlap = clamp((overlapPct - 10) / 100, 0.4, 0.9); // simple heuristic: side a bit lower

  const altitudeM = altitudeFromGsd({ cam, gsdCmPerPx });
  const fp = footprintMeters({ cam, altitudeM });

  const lineSpacingM = fp.widthM * (1 - sideOverlap);
  const photoDistanceM = fp.heightM * (1 - forwardOverlap);
  const photoIntervalSec = photoDistanceM / Math.max(0.1, speedMps);

  // AOI bbox + area estimation
  const bbox = turf.bbox(aoiFeatureCollection);
  const bboxPoly = turf.bboxPolygon(bbox);
  const bboxAreaKm2 = turf.area(bboxPoly) / 1_000_000;

  // rough line count estimation
  // approximate AOI width by bbox width in meters at center latitude
  const center = turf.center(bboxPoly);
  const [lon, lat] = center.geometry.coordinates;
  const west = [bbox[0], lat];
  const east = [bbox[2], lat];
  const south = [lon, bbox[1]];
  const north = [lon, bbox[3]];
  const widthM = turf.distance(west, east, { units: "kilometers" }) * 1000;
  const heightM = turf.distance(south, north, { units: "kilometers" }) * 1000;

  const lines = Math.max(1, Math.ceil(widthM / Math.max(1, lineSpacingM)));
  const lineLengthM = heightM;
  const photosPerLine = Math.max(1, Math.ceil(lineLengthM / Math.max(1, photoDistanceM)));
  const estPhotos = lines * photosPerLine;

  const estFlightTimeSec = (lines * lineLengthM) / Math.max(0.1, speedMps);

  return {
    camera: { id: cameraId, ...cam },
    inputs: { gsdCmPerPx, overlapPct, speedMps },
    derived: {
      altitudeM: Math.round(altitudeM * 10) / 10,
      footprint: { widthM: Math.round(fp.widthM * 10) / 10, heightM: Math.round(fp.heightM * 10) / 10 },
      forwardOverlapPct: Math.round(forwardOverlap * 100),
      sideOverlapPct: Math.round(sideOverlap * 100),
      lineSpacingM: Math.round(lineSpacingM * 10) / 10,
      photoDistanceM: Math.round(photoDistanceM * 10) / 10,
      photoIntervalSec: Math.round(photoIntervalSec * 10) / 10,
      bbox: { bbox, bboxAreaKm2: Math.round(bboxAreaKm2 * 1000) / 1000 },
      estimates: {
        lines,
        photosPerLine,
        estPhotos,
        estFlightTimeMin: Math.round((estFlightTimeSec / 60) * 10) / 10,
      },
    },
  };
}