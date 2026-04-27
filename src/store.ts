import * as THREE from "three";
import { create } from "zustand";
import { SensorItem, SensorProfile, TruckProfile } from "./types";

export function getTruckTransform(d: number) {
  const straightL = 60;
  const radius = 10;
  const curveL = Math.PI * radius;
  const totalL = straightL * 2 + curveL * 2;
  d = ((d % totalL) + totalL) % totalL;

  if (d < straightL) {
    return {
      position: new THREE.Vector3(0, 0, -straightL / 2 + d),
      rotation: new THREE.Euler(0, Math.PI, 0),
    };
  } else if (d < straightL + curveL) {
    const a = ((d - straightL) / curveL) * Math.PI;
    return {
      position: new THREE.Vector3(
        -radius + radius * Math.cos(a),
        0,
        straightL / 2 + radius * Math.sin(a),
      ),
      rotation: new THREE.Euler(0, Math.PI - a, 0),
    };
  } else if (d < straightL * 2 + curveL) {
    return {
      position: new THREE.Vector3(
        -radius * 2,
        0,
        straightL / 2 - (d - straightL - curveL),
      ),
      rotation: new THREE.Euler(0, 0, 0),
    };
  } else {
    const a = ((d - straightL * 2 - curveL) / curveL) * Math.PI;
    return {
      position: new THREE.Vector3(
        -radius - radius * Math.cos(a),
        0,
        -straightL / 2 - radius * Math.sin(a),
      ),
      rotation: new THREE.Euler(0, -a, 0),
    };
  }
}

export function raycastScene(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxR: number,
  truckTransform: { position: THREE.Vector3; rotation: THREE.Euler },
  truckDim: { width: number; height: number; length: number },
) {
  let closestT = maxR;
  let closestNormal: THREE.Vector3 | null = null;
  let hitType: "none" | "floor" | "truck" = "none";

  // Floor intersection (y = 0)
  if (dir.y < -0.0001) {
    const tFloor = -origin.y / dir.y;
    if (tFloor > 0 && tFloor < closestT) {
      closestT = tFloor;
      closestNormal = new THREE.Vector3(0, 1, 0);
      hitType = "floor";
    }
  }

  // Transform ray to truck local space
  const matrix = new THREE.Matrix4()
    .makeRotationFromEuler(truckTransform.rotation)
    .setPosition(truckTransform.position);
  const inverseMatrix = new THREE.Matrix4().copy(matrix).invert();

  const localOrigin = origin.clone().applyMatrix4(inverseMatrix);
  // Direction is a vector, we extract rotation matrix
  const localDir = dir.clone().transformDirection(inverseMatrix);

  const truckMin = new THREE.Vector3(
    -truckDim.width / 2,
    0,
    -truckDim.length / 2,
  );
  const truckMax = new THREE.Vector3(
    truckDim.width / 2,
    truckDim.height,
    truckDim.length / 2,
  );
  const truckBox = new THREE.Box3(truckMin, truckMax);

  const localRay = new THREE.Ray(localOrigin, localDir);
  const hitTarget = new THREE.Vector3();

  if (localRay.intersectBox(truckBox, hitTarget)) {
    const dist = localOrigin.distanceTo(hitTarget);
    if (dist >= 0.0 && dist < closestT) {
      closestT = dist;
      hitType = "truck";
      const epsilon = 0.001;
      closestNormal = new THREE.Vector3();
      if (Math.abs(hitTarget.x - truckMin.x) < epsilon)
        closestNormal.set(-1, 0, 0);
      else if (Math.abs(hitTarget.x - truckMax.x) < epsilon)
        closestNormal.set(1, 0, 0);
      else if (Math.abs(hitTarget.y - truckMin.y) < epsilon)
        closestNormal.set(0, -1, 0);
      else if (Math.abs(hitTarget.y - truckMax.y) < epsilon)
        closestNormal.set(0, 1, 0);
      else if (Math.abs(hitTarget.z - truckMin.z) < epsilon)
        closestNormal.set(0, 0, -1);
      else if (Math.abs(hitTarget.z - truckMax.z) < epsilon)
        closestNormal.set(0, 0, 1);

      // Transform normal back to world space
      closestNormal.transformDirection(matrix).normalize();
    }
  }

  if (closestNormal) {
    return { hit: true, hitType, distance: closestT, normal: closestNormal };
  }
  return {
    hit: false,
    hitType,
    distance: maxR,
    normal: dir.clone().multiplyScalar(-1),
  }; // fallback
}

export const DEFAULT_TRUCK_PROFILES: TruckProfile[] = [
  { id: "cde", name: "Truk CDE (4 roda)", length: 3, width: 1.8, height: 2.2 },
  {
    id: "cdd",
    name: "Truk CDD (6 roda)",
    length: 4.5,
    width: 2.0,
    height: 2.5,
  },
  { id: "fuso", name: "Truk Fuso", length: 7, width: 2.4, height: 2.8 },
  {
    id: "tronton",
    name: "Truk Tronton (3 Sumbu)",
    length: 9,
    width: 2.5,
    height: 3.0,
  },
  {
    id: "trinton",
    name: "Truk Trinton (4 Sumbu)",
    length: 12,
    width: 2.5,
    height: 3.0,
  },
];

export const DEFAULT_SENSOR_PROFILES: SensorProfile[] = [
  {
    id: "jsn-sr04t",
    name: "JSN-SR04T",
    height: 2.5,
    beamWidth: 50,
    tiltVertical: 0,
    tiltHorizontal: 0,
    maxRange: 4.5,
  },
  {
    id: "laser-sensor",
    name: "Laser Beam",
    height: 1.0,
    beamWidth: 2,
    tiltVertical: 0,
    tiltHorizontal: 0,
    maxRange: 10,
  },
];

interface GameState {
  // Road
  road: { width: number; length: number };
  setRoad: (r: Partial<{ width: number; length: number }>) => void;

  // Scale
  scale: { width: number; length: number };
  setScale: (s: Partial<{ width: number; length: number }>) => void;

  // Truck
  truck: {
    d: number;
    width: number;
    height: number;
    length: number;
    truthTolerance: number;
    selectedProfileId: string;
    flowState:
      | "approaching"
      | "entry_opening"
      | "entering"
      | "sensor_prep"
      | "weighing"
      | "weighing_complete"
      | "exit_opening"
      | "exiting"
      | "driving";
  };
  setTruckDimensions: (
    d: Partial<{
      d: number;
      width: number;
      height: number;
      length: number;
      truthTolerance: number;
      selectedProfileId: string;
      flowState:
        | "approaching"
        | "entry_opening"
        | "entering"
        | "sensor_prep"
        | "weighing"
        | "weighing_complete"
        | "exit_opening"
        | "exiting"
        | "driving";
    }>,
  ) => void;
  moveTruck: (dz: number) => void;
  resetTruck: () => void;
  truckProfiles: TruckProfile[];
  addTruckProfile: (p: TruckProfile) => void;

  // Sensors
  sensors: SensorItem[];
  sensorProfiles: SensorProfile[];
  addSensorRaw: (s: SensorItem) => void;
  addSensorItem: (profile?: Partial<SensorItem> | SensorProfile) => void;
  updateSensor: (id: string, s: Partial<SensorItem>) => void;
  removeSensorItem: (id: string) => void;
  addSensorProfile: (p: SensorProfile) => void;

  // Config
  saveWorldConfig: () => void;
  loadWorldConfig: () => void;
  importWorldConfig: (jsonStr: string) => void;
  exportWorldConfig: () => string;

  // Interaction
  draggingSensorId: string | null;
  setDraggingSensor: (id: string | null) => void;

  selectedEntity: string | null;
  setSelectedEntity: (e: string | null) => void;

  // UI
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useStore = create<GameState>((set, get) => ({
  road: { width: 5, length: 80 },
  setRoad: (r) => set((s) => ({ road: { ...s.road, ...r } })),

  scale: { width: 3, length: 16 },
  setScale: (newScale) => set((s) => ({ scale: { ...s.scale, ...newScale } })),

  truck: {
    d: 5,
    width: 2.4,
    height: 2.8,
    length: 7,
    truthTolerance: 0.05,
    selectedProfileId: "fuso",
    flowState: "approaching",
  },
  setTruckDimensions: (d) => set((s) => ({ truck: { ...s.truck, ...d } })),
  moveTruck: (dz) => set((s) => ({ truck: { ...s.truck, d: s.truck.d + dz } })),
  resetTruck: () =>
    set((s) => ({ truck: { ...s.truck, d: 5, flowState: "approaching" } })),
  truckProfiles: ((): TruckProfile[] => {
    try {
      const saved = localStorage.getItem("truckProfiles");
      return saved && saved !== "undefined"
        ? JSON.parse(saved)
        : DEFAULT_TRUCK_PROFILES;
    } catch {
      return DEFAULT_TRUCK_PROFILES;
    }
  })(),
  addTruckProfile: (p) =>
    set((s) => {
      const newProfiles = [...s.truckProfiles, p];
      localStorage.setItem("truckProfiles", JSON.stringify(newProfiles));
      return { truckProfiles: newProfiles };
    }),

  sensors: [
    {
      id: "s-exit-laser",
      type: "laser",
      name: "Exit Laser",
      z: 10.5,
      height: 1.0,
      beamWidth: 2,
      tiltVertical: 0,
      tiltHorizontal: 180,
      maxRange: 15,
      placement: "center",
    },
    {
      id: "s-entry-laser",
      type: "laser",
      name: "Entry Laser",
      z: -10.5,
      height: 1.0,
      beamWidth: 2,
      tiltVertical: 0,
      tiltHorizontal: 0,
      maxRange: 15,
      placement: "center",
    },
  ] as SensorItem[],
  sensorProfiles: ((): SensorProfile[] => {
    try {
      const saved = localStorage.getItem("sensorProfiles");
      return saved && saved !== "undefined"
        ? JSON.parse(saved)
        : DEFAULT_SENSOR_PROFILES;
    } catch {
      return DEFAULT_SENSOR_PROFILES;
    }
  })(),
  addSensorRaw: (sens) => set((s) => ({ sensors: [...s.sensors, sens] })),
  addSensorItem: (profile) =>
    set((s) => {
      const p = profile || s.sensorProfiles[0];
      const pItem = p as Partial<SensorItem>;
      return {
        sensors: [
          ...s.sensors,
          {
            id: `s-${Date.now()}`,
            name: p?.name || "Unknown Sensor",
            z: pItem.z ?? 0,
            height: p?.height ?? 2.5,
            beamWidth: p?.beamWidth ?? 50,
            tiltVertical: p?.tiltVertical ?? 0,
            tiltHorizontal: p?.tiltHorizontal ?? 0,
            maxRange: p?.maxRange ?? 4.5,
            placement: pItem.placement ?? "left",
          },
        ],
      };
    }),
  updateSensor: (id, updates) =>
    set((s) => ({
      sensors: s.sensors.map((sn) =>
        sn.id === id ? { ...sn, ...updates } : sn,
      ),
    })),
  removeSensorItem: (id) =>
    set((s) => ({
      sensors: s.sensors.filter((sn) => sn.id !== id),
    })),
  addSensorProfile: (p) =>
    set((s) => {
      const newProfiles = [...s.sensorProfiles, p];
      localStorage.setItem("sensorProfiles", JSON.stringify(newProfiles));
      return { sensorProfiles: newProfiles };
    }),

  // Config Logic
  saveWorldConfig: () => {
    const s = get();
    const data = {
      road: s.road,
      scale: s.scale,
      truck: s.truck,
      sensors: s.sensors,
    };
    localStorage.setItem("worldConfig", JSON.stringify(data));
    alert("World config saved successfully to local storage.");
  },
  loadWorldConfig: () => {
    try {
      const saved = localStorage.getItem("worldConfig");
      if (saved && saved !== "undefined") {
        const data = JSON.parse(saved);
        if (data.road) get().setRoad(data.road);
        if (data.scale) get().setScale(data.scale);
        if (data.truck) get().setTruckDimensions(data.truck);
        if (data.sensors) set({ sensors: data.sensors });
        alert("World config loaded successfully.");
      } else {
        alert("No saved config found in local storage.");
      }
    } catch (e) {
      alert("Failed to load config.");
    }
  },
  importWorldConfig: (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.road) get().setRoad(data.road);
      if (data.scale) get().setScale(data.scale);
      if (data.truck) get().setTruckDimensions(data.truck);
      if (data.sensors) set({ sensors: data.sensors });
      alert("World config imported successfully.");
    } catch (e) {
      alert("Failed to import config. Invalid JSON format.");
    }
  },
  exportWorldConfig: () => {
    const s = get();
    return JSON.stringify(
      { road: s.road, scale: s.scale, truck: s.truck, sensors: s.sensors },
      null,
      2,
    );
  },

  draggingSensorId: null,
  setDraggingSensor: (id) => set({ draggingSensorId: id }),

  selectedEntity: null,
  setSelectedEntity: (e) => set({ selectedEntity: e }),

  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
}));

// Derived hooks for specific logic to maintain performance
export function useSensorCalculations() {
  const truck = useStore((s) => s.truck);
  const sensors = useStore((s) => s.sensors);
  const scale = useStore((s) => s.scale);

  const tform = getTruckTransform(truck.d);
  // Z equivalent is just the world position Z, roughly.
  // Wait! The user considers Truth Center as the "deviation from z=0". Look at StatsPanel.tsx:
  // "Truth Center Z: truthCenter.toFixed(2)"
  const truthCenter = tform.position.z;

  const truckDim = {
    width: truck.width,
    height: truck.height,
    length: truck.length,
  };

  let overallZMin = Infinity;
  let overallZMax = -Infinity;

  const debugSensors: any[] = [];

  const readings = sensors.map((s) => {
    const tiltV = s.tiltVertical ?? (s as any).tilt ?? 0;
    const tiltH = s.tiltHorizontal ?? 0;
    const beamW = s.beamWidth ?? 50;
    const maxR = s.maxRange || 4.5;
    const isLaser = s.type === "laser";

    const tiltVRads = (tiltV * Math.PI) / 180;
    const tiltHRads = (tiltH * Math.PI) / 180;

    const poleX =
      s.placement === "center"
        ? 0
        : (scale.width / 2 + 0.3) * (s.placement === "left" ? -1 : 1);

    const xDir = s.placement === "left" ? 1 : s.placement === "center" ? 0 : -1;
    const zDirBase =
      s.placement === "center" && tiltH === 0
        ? 1
        : s.placement === "center" && tiltH === 180
          ? -1
          : 0;

    // For general direction
    const dirX =
      s.placement === "center"
        ? 0
        : xDir * Math.cos(tiltVRads) * Math.cos(tiltHRads);
    const dirZ =
      s.placement === "center"
        ? (s.tiltHorizontal === 180 ? -1 : 1) * Math.cos(tiltVRads)
        : xDir * Math.cos(tiltVRads) * Math.sin(tiltHRads);
    const dirY = -Math.sin(tiltVRads);

    let hit = false;
    let distance = Infinity;
    let overallZMinLocal = Infinity;
    let overallZMaxLocal = -Infinity;

    const origin = new THREE.Vector3(poleX, s.height, s.z);
    const dir = new THREE.Vector3(dirX, dirY, dirZ).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    const isLaserActive = isLaser ? truck.flowState === "weighing" : true;

    let right = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (right.lengthSq() < 0.001) right = new THREE.Vector3(1, 0, 0);
    const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();

    const halfAngle = ((beamW / 2) * Math.PI) / 180;
    const raysCount = isLaser ? 1 : 32;
    let effectiveMaxR = isLaser && !isLaserActive ? 0 : maxR;
    const testDirs = [dir];
    let hitNormalVec: THREE.Vector3 | null = null;

    if (isLaserActive) {
      if (!isLaser) {
        for (let i = 0; i < raysCount; i++) {
          const theta = (i / raysCount) * Math.PI * 2;
          const sinHalf = Math.sin(halfAngle);
          const cosHalf = Math.cos(halfAngle);

          const d_x = Math.cos(theta) * sinHalf;
          const d_y = Math.sin(theta) * sinHalf;
          const d_z = cosHalf;

          const rDir = new THREE.Vector3()
            .addScaledVector(right, d_x)
            .addScaledVector(realUp, d_y)
            .addScaledVector(dir, d_z)
            .normalize();
          testDirs.push(rDir);
        }
      }

      for (const testDir of testDirs) {
        const d = testDir.clone();
        const res = raycastScene(origin, d, effectiveMaxR, tform, truckDim);

        if (res.hitType === "truck") {
          const rDir = d
            .clone()
            .sub(res.normal.clone().multiplyScalar(2 * d.dot(res.normal)))
            .normalize();
          const toSensor = d.clone().negate();
          const bounceAngle = rDir.angleTo(toSensor);

          if (isLaser || bounceAngle <= halfAngle * 0.9) {
            hit = true;
            distance = Math.min(distance, res.distance);

            const hitPt = origin.clone().add(d.multiplyScalar(res.distance));
            overallZMinLocal = Math.min(overallZMinLocal, hitPt.z);
            overallZMaxLocal = Math.max(overallZMaxLocal, hitPt.z);

            if (testDir === dir) {
              hitNormalVec = res.normal;
            }
          }
        }
      }
    }

    if (hit) {
      overallZMin = Math.min(overallZMin, overallZMinLocal);
      overallZMax = Math.max(overallZMax, overallZMaxLocal);
    }

    const t = distance;
    const hitY = s.height + dirY * distance;
    const hitZ = s.z + dirZ * distance;
    const spreadRadius = distance * Math.tan(((beamW / 2) * Math.PI) / 180);
    const sZMin = overallZMinLocal;
    const sZMax = overallZMaxLocal;
    const overlapMin = overallZMinLocal;
    const overlapMax = overallZMaxLocal;
    const hitNormalArr = hitNormalVec
      ? [hitNormalVec.x, hitNormalVec.y, hitNormalVec.z]
      : [0, 0, 0];

    debugSensors.push({
      name: s.name,
      id: s.id,
      z: s.z,
      height: s.height,
      tiltVertical: tiltV,
      tiltHorizontal: tiltH,
      beamWidth: beamW,
      maxRange: effectiveMaxR,
      poleX,
      dx: 0,
      t,
      hitY,
      hitZ,
      spreadRadius,
      sZMin,
      sZMax,
      overlapMin,
      overlapMax,
      hit,
    });

    return {
      ...s,
      hit,
      distance,
      hitNormal: hitNormalArr,
      dir: [dirX, dirY, dirZ],
      effectiveMaxR,
      isActive: isLaser ? isLaserActive : true,
    };
  });

  let sensorCenter = null;
  let hasLaserHits = false;
  let entryDist = 0;
  let exitDist = 0;

  const entryLaser = readings.find((r) => r.id === "s-entry-laser");
  const exitLaser = readings.find((r) => r.id === "s-exit-laser");

  if (entryLaser && exitLaser && entryLaser.hit && exitLaser.hit) {
    sensorCenter = (entryLaser.distance - exitLaser.distance) / 2;
    hasLaserHits = true;
    entryDist = entryLaser.distance;
    exitDist = exitLaser.distance;
  }

  return {
    readings,
    sensorCenter,
    truthCenter,
    calcDetails: {
      overallZMin,
      overallZMax,
      debugSensors,
      farthestTop: 0,
      farthestBottom: 0,
      hasLaserHits,
      entryDist,
      exitDist,
    },
  };
}
