import { create } from 'zustand';
import { TruckProfile, SensorProfile, SensorPair } from './types';

export const DEFAULT_TRUCK_PROFILES: TruckProfile[] = [
  { id: 'cde', name: 'Truk CDE (4 roda)', length: 3, width: 1.8, height: 2.2 },
  { id: 'cdd', name: 'Truk CDD (6 roda)', length: 4.5, width: 2.0, height: 2.5 },
  { id: 'fuso', name: 'Truk Fuso', length: 7, width: 2.4, height: 2.8 },
  { id: 'tronton', name: 'Truk Tronton (3 Sumbu)', length: 9, width: 2.5, height: 3.0 },
  { id: 'trinton', name: 'Truk Trinton (4 Sumbu)', length: 12, width: 2.5, height: 3.0 },
  { id: 'kontainer', name: 'Truk Kontainer', length: 16, width: 2.5, height: 4.0 },
  { id: 'gandeng', name: 'Truk Gandeng', length: 20, width: 2.5, height: 3.5 },
];

export const DEFAULT_SENSOR_PROFILES: SensorProfile[] = [
  { id: 'jsn-sr04t', name: 'JSN-SR04T', height: 2.5, beamWidth: 50, tilt: 0 },
  { id: 'high-tilt', name: 'High 6m Tilted', height: 6, beamWidth: 10, tilt: 25 },
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
  setTruckDimensions: (d: Partial<{ width: number; height: number; length: number }>) => void;
  moveTruck: (dz: number) => void;
  truckProfiles: TruckProfile[];
  addTruckProfile: (p: TruckProfile) => void;

  // Sensors
  sensors: SensorPair[];
  sensorProfiles: SensorProfile[];
  addSensorPair: (profile?: SensorProfile) => void;
  updateSensor: (id: string, s: Partial<SensorPair>) => void;
  removeSensorPair: (id: string) => void;
  addSensorProfile: (p: SensorProfile) => void;

  // Interaction
  draggingSensorId: string | null;
  setDraggingSensor: (id: string | null) => void;

  selectedEntity: string | null;
  setSelectedEntity: (e: string | null) => void;

  // UI
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useStore = create<GameState>((set) => ({
  road: { width: 5, length: 80 },
  setRoad: (r) => set((s) => ({ road: { ...s.road, ...r } })),

  scale: { width: 3, length: 16 },
  setScale: (newScale) => set((s) => ({ scale: { ...s.scale, ...newScale } })),

  truck: { z: 25, width: 2.4, height: 2.8, length: 7 }, // Starts at Z=25
  setTruckDimensions: (d) => set((s) => ({ truck: { ...s.truck, ...d } })),
  moveTruck: (dz) => set((s) => ({ truck: { ...s.truck, z: s.truck.z + dz } })),
  truckProfiles: ((): TruckProfile[] => { 
    try { const saved = localStorage.getItem('truckProfiles'); return saved ? JSON.parse(saved) : DEFAULT_TRUCK_PROFILES; } 
    catch { return DEFAULT_TRUCK_PROFILES; } 
  })(),
  addTruckProfile: (p) => set((s) => {
    const newProfiles = [...s.truckProfiles, p];
    localStorage.setItem('truckProfiles', JSON.stringify(newProfiles));
    return { truckProfiles: newProfiles };
  }),

  sensors: [
    { id: 'pair-front', name: 'JSN-SR04T', z: 8, height: 2.5, beamWidth: 50, tilt: 0 },
    { id: 'pair-back', name: 'JSN-SR04T', z: -8, height: 2.5, beamWidth: 50, tilt: 0 },
  ],
  sensorProfiles: ((): SensorProfile[] => { 
    try { const saved = localStorage.getItem('sensorProfiles'); return saved ? JSON.parse(saved) : DEFAULT_SENSOR_PROFILES; } 
    catch { return DEFAULT_SENSOR_PROFILES; } 
  })(),
  addSensorPair: (profile) =>
    set((s) => {
      const p = profile || s.sensorProfiles[0];
      return {
        sensors: [
          ...s.sensors,
          { id: `pair-${Date.now()}`, name: p ? p.name : 'Unknown Sensor', z: 0, height: p ? p.height : 2.5, beamWidth: p ? p.beamWidth : 50, tilt: p ? p.tilt : 0 },
        ],
      };
    }),
  updateSensor: (id, updates) =>
    set((s) => ({
      sensors: s.sensors.map((sn) => (sn.id === id ? { ...sn, ...updates } : sn)),
    })),
  removeSensorPair: (id) =>
    set((s) => ({
      sensors: s.sensors.filter((sn) => sn.id !== id),
    })),
  addSensorProfile: (p) => set((s) => {
    const newProfiles = [...s.sensorProfiles, p];
    localStorage.setItem('sensorProfiles', JSON.stringify(newProfiles));
    return { sensorProfiles: newProfiles };
  }),

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
    const sx = scale.width / 2;
    const tiltRads = (s.tilt * Math.PI) / 180;
    const dx = sx - truck.width / 2;
    
    let hit = false;
    let distance = Infinity;
    
    let t = 0, hitY = 0, spreadRadius = 0, sZMin = 0, sZMax = 0, overlapMin = 0, overlapMax = 0;

    // Prevent division by zero if tilted 90 degrees
    const dirX = Math.max(0.001, Math.cos(tiltRads));

    if (dx > 0) {
      t = Math.abs(dx / dirX);
      hitY = s.height - t * Math.sin(tiltRads);
      spreadRadius = t * Math.tan(((s.beamWidth / 2) * Math.PI) / 180);

      // The sensor's beam footprint on the Z-axis at the truck's side panel
      sZMin = s.z - spreadRadius;
      sZMax = s.z + spreadRadius;

      // Check if perfectly hitting the truck side panel
      if (hitY >= 0 && hitY <= truck.height) {
        // Calculate the overlap between the truck's physical span and the sensor's beam span
        overlapMin = Math.max(truckZMin, sZMin);
        overlapMax = Math.min(truckZMax, sZMax);

        if (overlapMin <= overlapMax) {
          hit = true;
          // Actual point distance using the beam center
          distance = dx; 
          
          overallZMin = Math.min(overallZMin, overlapMin);
          overallZMax = Math.max(overallZMax, overlapMax);
        }
      }
    }

    debugSensors.push({
       name: s.name, id: s.id, z: s.z, height: s.height, tilt: s.tilt, beamWidth: s.beamWidth,
       sx, dx, dirX, t, hitY, spreadRadius, sZMin, sZMax, overlapMin, overlapMax, hit
    });

    return { ...s, hit, distance };
  });

  let sensorCenter = null;
  // If we have valid footprint intersections
  if (overallZMin <= overallZMax && overallZMin !== Infinity) {
    sensorCenter = (overallZMin + overallZMax) / 2;
  }

  const truthCenter = truck.z;

  return { readings, sensorCenter, truthCenter, calcDetails: { truckZMin, truckZMax, overallZMin, overallZMax, debugSensors } };
}
