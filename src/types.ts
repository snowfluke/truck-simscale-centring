export interface TruckProfile {
  id: string; // Add ID for better mapping
  name: string;
  width: number;
  height: number;
  length: number;
}

export interface SensorProfile {
  id: string;
  name: string;
  height: number;
  beamWidth: number; // degrees
  tilt: number; // degrees
}

export interface SensorPair {
  id: string;
  name: string;
  z: number;
  height: number;
  beamWidth: number;
  tilt: number;
}

export interface Vector3Obj {
  x: number;
  y: number;
  z: number;
}
