let currentMissionId = null;

export function setActiveMissionId(id) {
  currentMissionId = id;
}

export function getActiveMissionId() {
  return currentMissionId;
}