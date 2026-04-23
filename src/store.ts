import * as THREE from "three";
import { create } from "zustand";
import { SensorItem, SensorProfile, TruckProfile } from "./types";

export function raycastScene(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxR: number,
  truckMin: THREE.Vector3,
  truckMax: THREE.Vector3,
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

  const truckBox = new THREE.Box3(truckMin, truckMax);
  const ray = new THREE.Ray(origin, dir);
  const hitTarget = new THREE.Vector3();

  if (ray.intersectBox(truckBox, hitTarget)) {
    const dist = origin.distanceTo(hitTarget);
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
  {
    id: "kontainer",
    name: "Truk Kontainer",
    length: 16,
    width: 2.5,
    height: 4.0,
  },
  { id: "gandeng", name: "Truk Gandeng", length: 20, width: 2.5, height: 3.5 },
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
    id: "high-tilt",
    name: "High 6m Tilted",
    height: 6,
    beamWidth: 10,
    tiltVertical: 25,
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
  truck: { z: number; width: number; height: number; length: number };
  setTruckDimensions: (
    d: Partial<{ width: number; height: number; length: number }>,
  ) => void;
  moveTruck: (dz: number) => void;
  truckProfiles: TruckProfile[];
  addTruckProfile: (p: TruckProfile) => void;

  // Sensors
  sensors: SensorItem[];
  sensorProfiles: SensorProfile[];
  addSensorRaw: (s: SensorItem) => void;
  addSensorItem: (profile?: SensorProfile) => void;
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

  truck: { z: (16 / 2) * 2.0, width: 2.4, height: 2.8, length: 7 }, // Starts at 200%
  setTruckDimensions: (d) => set((s) => ({ truck: { ...s.truck, ...d } })),
  moveTruck: (dz) =>
    set((s) => ({
      truck: { ...s.truck, z: Math.round((s.truck.z + dz) * 10) / 10 },
    })),
  truckProfiles: ((): TruckProfile[] => {
    try {
      const saved = localStorage.getItem("truckProfiles");
      return saved ? JSON.parse(saved) : DEFAULT_TRUCK_PROFILES;
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
      id: "s-front-l",
      name: "JSN-SR04T",
      z: 0,
      height: 2.5,
      beamWidth: 50,
      tiltVertical: 0,
      tiltHorizontal: 0,
      maxRange: 4.5,
      placement: "left",
    },
  ],
  sensorProfiles: ((): SensorProfile[] => {
    try {
      const saved = localStorage.getItem("sensorProfiles");
      return saved ? JSON.parse(saved) : DEFAULT_SENSOR_PROFILES;
    } catch {
      return DEFAULT_SENSOR_PROFILES;
    }
  })(),
  addSensorRaw: (sens) => set((s) => ({ sensors: [...s.sensors, sens] })),
  addSensorItem: (profile) =>
    set((s) => {
      const p = profile || s.sensorProfiles[0];
      return {
        sensors: [
          ...s.sensors,
          {
            id: `s-${Date.now()}`,
            name: p ? p.name : "Unknown Sensor",
            z: 0,
            height: p ? p.height : 2.5,
            beamWidth: p ? p.beamWidth : 50,
            tiltVertical: p ? p.tiltVertical : 0,
            tiltHorizontal: p ? p.tiltHorizontal : 0,
            maxRange: p && p.maxRange ? p.maxRange : 4.5,
            placement: "left",
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
      if (saved) {
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

  const truckZMin = truck.z - truck.length / 2;
  const truckZMax = truck.z + truck.length / 2;

  let overallZMin = Infinity;
  let overallZMax = -Infinity;

  const debugSensors: any[] = [];

  const readings = sensors.map((s) => {
    // Backward compatibility for saved profiles
    const tiltV = s.tiltVertical ?? (s as any).tilt ?? 0;
    const tiltH = s.tiltHorizontal ?? 0;
    const beamW = s.beamWidth ?? 50;
    const maxR = s.maxRange || 4.5;

    const tiltVRads = (tiltV * Math.PI) / 180;
    const tiltHRads = (tiltH * Math.PI) / 180;

    const poleX = (scale.width / 2 + 0.3) * (s.placement === "left" ? -1 : 1);

    // Direction vectors
    const xDir = s.placement === "left" ? 1 : -1;
    const dirX = xDir * Math.cos(tiltVRads) * Math.cos(tiltHRads);
    const dirZ = xDir * Math.cos(tiltVRads) * Math.sin(tiltHRads);
    // Note: y is down
    const dirY = -Math.sin(tiltVRads);

    let hit = false;
    let distance = Infinity;
    let dx = Math.abs(poleX) - truck.width / 2;
    let overallZMinLocal = Infinity;
    let overallZMaxLocal = -Infinity;

    const origin = new THREE.Vector3(poleX, s.height, s.z);
    const dir = new THREE.Vector3(dirX, dirY, dirZ).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    const minX = -truck.width / 2;
    const maxX = truck.width / 2;
    const minY = 0;
    const maxY = truck.height;
    const truckMin = new THREE.Vector3(minX, minY, truckZMin);
    const truckMax = new THREE.Vector3(maxX, maxY, truckZMax);

    let right = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (right.lengthSq() < 0.001) right = new THREE.Vector3(1, 0, 0);
    const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();

    const halfAngle = ((beamW / 2) * Math.PI) / 180;
    const raysCount = 32;
    const testDirs = [dir];
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

    let hitNormalVec: THREE.Vector3 | null = null;

    for (const testDir of testDirs) {
      const d = testDir.clone();
      const res = raycastScene(origin, d, maxR, truckMin, truckMax);

      // Only detecting truck for the UI calculation. Floor hits don't count as vehicle detection!
      if (res.hitType === "truck") {
        // SOUND REFLECTION LOGIC:
        // The sound reflects off the surface. A specular reflection creates a cone
        // bouncing away. We check if the sensor's origin is within this reflected cone.
        const rDir = d
          .clone()
          .sub(res.normal.clone().multiplyScalar(2 * d.dot(res.normal)))
          .normalize();
        const toSensor = d.clone().negate();
        const bounceAngle = rDir.angleTo(toSensor);

        // Realistically, the signal must bounce back and hit the physical geometry of the sensor origin.
        // We restrict the acceptance angle tightly.
        if (bounceAngle <= halfAngle * 0.9) {
          hit = true;
          distance = Math.min(distance, res.distance);

          const hitPt = origin.clone().add(d.multiplyScalar(res.distance));
          overallZMinLocal = Math.min(overallZMinLocal, hitPt.z);
          overallZMaxLocal = Math.max(overallZMaxLocal, hitPt.z);

          if (testDir === dir) {
            // if the center ray hits, save its normal for debugging
            hitNormalVec = res.normal;
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
      maxRange: maxR,
      poleX,
      dx,
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
    };
  });

  let sensorCenter = null;
  if (overallZMin <= overallZMax && overallZMin !== Infinity) {
    sensorCenter = (overallZMin + overallZMax) / 2;
  }

  return {
    readings,
    sensorCenter,
    truthCenter: truck.z,
    calcDetails: {
      truckZMin,
      truckZMax,
      overallZMin,
      overallZMax,
      debugSensors,
    },
  };
}
