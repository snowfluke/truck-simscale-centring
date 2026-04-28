import * as THREE from "three";
import { create } from "zustand";
import { SensorItem, SensorProfile, TruckProfile } from "./types";

export const TRACK_STRAIGHT_L = 120;
export const TRACK_RADIUS = 20;
export const TOTAL_L = TRACK_STRAIGHT_L * 2 + Math.PI * TRACK_RADIUS * 2;

export function getTruckTransform(d: number) {
  const straightL = TRACK_STRAIGHT_L;
  const radius = TRACK_RADIUS;
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
  truckDim: { width: number; height: number; length: number; hasBox?: boolean },
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

  const localRay = new THREE.Ray(localOrigin, localDir);
  const hitTarget = new THREE.Vector3();

  const boxes: { min: THREE.Vector3; max: THREE.Vector3 }[] = [];

  if (truckDim.hasBox === false) {
    // Chassis (full length, height 0.8)
    boxes.push({
      min: new THREE.Vector3(-truckDim.width / 2, 0, -truckDim.length / 2),
      max: new THREE.Vector3(truckDim.width / 2, 0.8, truckDim.length / 2),
    });

    // Cab (front part, tall)
    const cabLength = Math.min(2.5, truckDim.length * 0.35);
    const bodyHeight = truckDim.height - 0.8;
    const cabHeight = bodyHeight * 0.8;
    boxes.push({
      min: new THREE.Vector3(
        (-truckDim.width / 2) * 0.95,
        0.8,
        -truckDim.length / 2,
      ),
      max: new THREE.Vector3(
        (truckDim.width / 2) * 0.95,
        0.8 + cabHeight,
        -truckDim.length / 2 + cabLength,
      ),
    });
  } else {
    boxes.push({
      min: new THREE.Vector3(-truckDim.width / 2, 0, -truckDim.length / 2),
      max: new THREE.Vector3(
        truckDim.width / 2,
        truckDim.height,
        truckDim.length / 2,
      ),
    });
  }

  for (const b of boxes) {
    const box = new THREE.Box3(b.min, b.max);
    if (localRay.intersectBox(box, hitTarget)) {
      const dist = localOrigin.distanceTo(hitTarget);
      if (dist >= 0.0 && dist < closestT) {
        closestT = dist;
        hitType = "truck";
        const epsilon = 0.001;
        const localNormal = new THREE.Vector3();
        if (Math.abs(hitTarget.x - b.min.x) < epsilon)
          localNormal.set(-1, 0, 0);
        else if (Math.abs(hitTarget.x - b.max.x) < epsilon)
          localNormal.set(1, 0, 0);
        else if (Math.abs(hitTarget.y - b.min.y) < epsilon)
          localNormal.set(0, -1, 0);
        else if (Math.abs(hitTarget.y - b.max.y) < epsilon)
          localNormal.set(0, 1, 0);
        else if (Math.abs(hitTarget.z - b.min.z) < epsilon)
          localNormal.set(0, 0, -1);
        else if (Math.abs(hitTarget.z - b.max.z) < epsilon)
          localNormal.set(0, 0, 1);

        // Transform normal back to world space
        closestNormal = localNormal.transformDirection(matrix).normalize();
      }
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
  {
    id: "cde",
    name: "Truk CDE (4 roda)",
    length: 3,
    width: 1.8,
    height: 2.2,
    hasBox: true,
  },
  {
    id: "cdd",
    name: "Truk CDD (6 roda)",
    length: 4.5,
    width: 2.0,
    height: 2.5,
    hasBox: true,
  },
  {
    id: "fuso",
    name: "Truk Fuso",
    length: 7,
    width: 2.4,
    height: 2.8,
    hasBox: true,
  },
  {
    id: "tronton",
    name: "Truk Tronton (3 Sumbu)",
    length: 9,
    width: 2.5,
    height: 3.0,
    hasBox: true,
  },
  {
    id: "trinton",
    name: "Truk Trinton (4 Sumbu)",
    length: 12,
    width: 2.5,
    height: 3.0,
    hasBox: true,
  },
  {
    id: "cde_nobox",
    name: "Truk CDE (Tanpa Box)",
    length: 3,
    width: 1.8,
    height: 2.2,
    hasBox: false,
  },
  {
    id: "cdd_nobox",
    name: "Truk CDD (Tanpa Box)",
    length: 4.5,
    width: 2.0,
    height: 2.5,
    hasBox: false,
  },
  {
    id: "fuso_nobox",
    name: "Truk Fuso (Tanpa Box)",
    length: 7,
    width: 2.4,
    height: 2.8,
    hasBox: false,
  },
  {
    id: "tronton_nobox",
    name: "Truk Tronton (Tanpa Box)",
    length: 9,
    width: 2.5,
    height: 3.0,
    hasBox: false,
  },
  {
    id: "trinton_nobox",
    name: "Truk Trinton (Tanpa Box)",
    length: 12,
    width: 2.5,
    height: 3.0,
    hasBox: false,
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
      | "driving"
      | "facility_exit_approaching"
      | "facility_exit_holding"
      | "facility_exit_leaving";
    hasBox?: boolean;
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
        | "driving"
        | "facility_exit_approaching"
        | "facility_exit_holding"
        | "facility_exit_leaving";
      hasBox?: boolean;
    }>,
  ) => void;
  moveTruck: (dz: number) => void;
  resetTruck: () => void;

  trucks: {
    id: string;
    d: number;
    speed: number;
    timer: number;
    width: number;
    height: number;
    length: number;
    truthTolerance?: number;
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
      | "driving"
      | "facility_exit_approaching"
      | "facility_exit_holding"
      | "facility_exit_leaving";
    hasBox?: boolean;
    logoUrl?: string;
  }[];
  setTrucks: (trucks: any[]) => void;
  updateActiveTruck: (updates: any) => void;

  explosions: {
    id: string;
    x: number;
    y: number;
    z: number;
    timer: number;
    maxTimer: number;
  }[];
  addExplosion: (x: number, y: number, z: number) => void;
  updateExplosions: (dt: number) => void;

  deadTrucks: {
    id: string;
    config: any;
    pos: [number, number, number];
    rot: [number, number, number];
    vel: [number, number, number];
  }[];
  addDeadTruck: (
    config: any,
    pos: [number, number, number],
    rot: [number, number, number],
    vel: [number, number, number],
  ) => void;
  updateDeadTrucks: (dt: number) => void;

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

  sensorStrategy: "lidar_tof" | "3d_lidar";
  toggleSensorStrategy: () => void;
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
    set((s) => {
      const updates = { d: 5, flowState: "approaching", speed: 0 };
      if (!s.trucks || s.trucks.length === 0) {
        return { truck: { ...s.truck, ...updates } as any };
      }
      const newTrucks = [...s.trucks];
      newTrucks[0] = { ...newTrucks[0], ...updates } as any;
      return {
        trucks: newTrucks as any,
        truck: { ...s.truck, ...updates } as any,
      };
    }),

  trucks: [],
  setTrucks: (trucks) => set({ trucks }),
  updateActiveTruck: (updates) =>
    set((s) => {
      if (!s.trucks || s.trucks.length === 0)
        return { truck: { ...s.truck, ...updates } as any };
      const newTrucks = [...s.trucks];
      const activeIdx = newTrucks.findIndex(
        (t) => !["approaching", "driving"].includes(t.flowState),
      );
      if (activeIdx !== -1) {
        newTrucks[activeIdx] = { ...newTrucks[activeIdx], ...updates };
        return { trucks: newTrucks as any };
      }
      newTrucks[0] = { ...newTrucks[0], ...updates } as any;
      return { trucks: newTrucks as any };
    }),
  explosions: [],
  addExplosion: (x, y, z) =>
    set((s) => ({
      explosions: [
        ...s.explosions,
        { id: Math.random().toString(), x, y, z, timer: 0, maxTimer: 1.5 },
      ],
    })),
  updateExplosions: (dt) =>
    set((s) => ({
      explosions: s.explosions
        .map((e) => ({ ...e, timer: e.timer + dt }))
        .filter((e) => e.timer < e.maxTimer),
    })),

  deadTrucks: [],
  addDeadTruck: (config, pos, rot, vel) =>
    set((s) => ({
      deadTrucks: [
        ...s.deadTrucks,
        { id: Math.random().toString(), config, pos, rot, vel },
      ],
    })),
  updateDeadTrucks: (dt) =>
    set((s) => ({
      deadTrucks: s.deadTrucks.map((t) => {
        let [x, y, z] = t.pos;
        let [rx, ry, rz] = t.rot;
        let [vx, vy, vz] = t.vel;

        if (y >= 0 || vy > 0) {
          vy -= 9.81 * 8 * dt; // Gravity
          x += vx * dt;
          y += vy * dt;
          z += vz * dt;

          rx += vx * 0.1 * dt;
          ry += vy * 0.1 * dt;
          rz += vz * 0.1 * dt;
        }

        if (y < 0) {
          y = 0;
          vy = -vy * 0.3; // bounce
          if (Math.abs(vy) < 5) {
            vy = 0;
            vx = 0;
            vz = 0;
          }
          vx *= 0.8;
          vz *= 0.8;
        }

        return { ...t, pos: [x, y, z], rot: [rx, ry, rz], vel: [vx, vy, vz] };
      }),
    })),

  truckProfiles: ((): TruckProfile[] => {
    try {
      const saved = localStorage.getItem("truckProfiles");
      if (saved && saved !== "undefined") {
        const parsed = JSON.parse(saved);
        if (!parsed.some((p: TruckProfile) => p.hasBox === false)) {
          // Missing the no-box profiles, maybe it's from old cache. Return defaults that have them.
          return DEFAULT_TRUCK_PROFILES;
        }
        return parsed;
      }
      return DEFAULT_TRUCK_PROFILES;
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
      name: "ToF Sensor",
      z: 10.5,
      height: 0.6,
      beamWidth: 2,
      tiltVertical: 0,
      tiltHorizontal: 180,
      maxRange: 15,
      placement: "center",
    },
    {
      id: "s-entry-laser",
      type: "laser",
      name: "2D LiDAR",
      z: -10.5,
      height: 0.6,
      beamWidth: 80,
      tiltVertical: 0,
      tiltHorizontal: 0,
      maxRange: 10,
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

  sensorStrategy: "lidar_tof",
  toggleSensorStrategy: () =>
    set((s) => ({
      sensorStrategy:
        s.sensorStrategy === "lidar_tof" ? "3d_lidar" : "lidar_tof",
    })),
}));

export const useActiveTruck = () =>
  useStore((s) => {
    if (!s.trucks || s.trucks.length === 0) return s.truck;
    return (
      s.trucks.find((t) => !["approaching", "driving"].includes(t.flowState)) ||
      s.trucks[0]
    );
  });

// Derived hooks for specific logic to maintain performance
export function useSensorCalculations() {
  const defaultTruck = useStore((s) => s.truck);
  const trucks = useStore((s) => s.trucks);
  const rawSensors = useStore((s) => s.sensors);
  const scale = useStore((s) => s.scale);
  const road = useStore((s) => s.road);
  const sensorStrategy = useStore((s) => s.sensorStrategy);

  const sensors =
    sensorStrategy === "3d_lidar"
      ? [
          {
            id: "s-3d-lidar",
            type: "laser",
            name: "3D LiDAR",
            z: 0,
            height: 2,
            beamWidth: 360,
            tiltVertical: 0,
            tiltHorizontal: 0,
            maxRange: 15,
            placement: "right",
          } as any,
        ]
      : rawSensors;

  // Find active truck (the one inside or closest to the scale gates: -10.5 to 10.5)
  // Distance metric: Z = -TRACK_STRAIGHT_L/2 + d -> Z between -10.5 and 10.5 means d between TRACK_STRAIGHT_L/2 - 10.5 and TRACK_STRAIGHT_L/2 + 10.5
  let activeTruck =
    trucks && trucks.length > 0
      ? trucks.find(
          (t) =>
            t.d >= TRACK_STRAIGHT_L / 2 - 10.5 &&
            t.d <= TRACK_STRAIGHT_L / 2 + 10.5,
        ) || trucks[0]
      : defaultTruck;

  const truck = activeTruck;

  const tform = getTruckTransform(truck.d);
  // Z equivalent is just the world position Z, roughly.
  // Wait! The user considers Truth Center as the "deviation from z=0". Look at StatsPanel.tsx:
  // "Truth Center Z: truthCenter.toFixed(2)"
  const truthCenter = tform.position.z;

  const truckDim = {
    width: truck.width,
    height: truck.height,
    length: truck.length,
    hasBox: truck.hasBox,
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
        : (road.width / 2 + 1.5) * (s.placement === "left" ? -1 : 1);

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
    const raysCount = s.id === "s-entry-laser" ? 32 : isLaser ? 0 : 32;
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
      } else if (s.id === "s-entry-laser") {
        const fanAngle = (7 * Math.PI) / 180; // 7 degree vertical sweep
        for (let i = 0; i < raysCount; i++) {
          const fraction = i / (raysCount - 1);
          const angle = -fanAngle / 2 + fraction * fanAngle;
          const rDir = new THREE.Vector3()
            .copy(dir)
            .applyAxisAngle(right, angle)
            .normalize();
          testDirs.push(rDir);
        }
      } else if (s.id === "s-3d-lidar") {
        const verticalRays = 24;
        const horizontalRays = 72;
        for (let v = 0; v < verticalRays; v++) {
          const vAngle =
            (v / (verticalRays - 1) - 0.5) * ((90 * Math.PI) / 180) -
            (15 * Math.PI) / 180; // 90 degrees vertical FOV, tilted down by 15 deg
          for (let h = 0; h < horizontalRays; h++) {
            const hAngle = Math.PI / 2 + (h / (horizontalRays - 1)) * Math.PI; // 180 degrees horizontal facing truck (-x direction)

            const rDir = new THREE.Vector3(
              Math.cos(vAngle) * Math.cos(hAngle),
              Math.sin(vAngle),
              Math.cos(vAngle) * Math.sin(hAngle),
            ).normalize();
            testDirs.push(rDir);
          }
        }
      }

      if (effectiveMaxR > 0) {
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

    // Horizontal distance (along Z axis) is the shortest Z distance from origin to any hit point
    const horizontalDistance =
      s.id === "s-entry-laser"
        ? Math.abs(sZMin - s.z)
        : s.id === "s-exit-laser"
          ? Math.abs(sZMax - s.z)
          : distance;

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
      horizontalDistance,
    });

    return {
      ...s,
      hit,
      distance,
      horizontalDistance,
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
  const lidar3d = readings.find((r) => r.id === "s-3d-lidar");

  let measuredLength = 0;

  if (entryLaser && exitLaser && entryLaser.hit && exitLaser.hit) {
    sensorCenter =
      (entryLaser.horizontalDistance - exitLaser.horizontalDistance) / 2;
    hasLaserHits = true;
    entryDist = entryLaser.horizontalDistance;
    exitDist = exitLaser.horizontalDistance;
    // Note: for 2D sensors positioned at -10.5 and 10.5
    measuredLength = 21 - (entryDist + exitDist);
  } else if (lidar3d && lidar3d.hit) {
    const dSens = debugSensors.find((s) => s.id === "s-3d-lidar");
    if (dSens && dSens.sZMin !== Infinity && dSens.sZMax !== -Infinity) {
      // Using the min and max Z coordinates of all 3D LiDAR hit points to find the truck's midpoint
      sensorCenter = (dSens.sZMax + dSens.sZMin) / 2;
      hasLaserHits = true;
      entryDist = Math.abs(dSens.sZMin - lidar3d.z);
      exitDist = Math.abs(dSens.sZMax - lidar3d.z);
      measuredLength = Math.abs(dSens.sZMax - dSens.sZMin);
    }
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
      measuredLength,
    },
    activeTruck,
  };
}
