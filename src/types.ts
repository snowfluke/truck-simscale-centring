export interface TruckProfile {
  id: string; // Add ID for better mapping
  name: string;
  width: number;
  height: number;
  length: number;
  hasBox?: boolean;
}

export interface SensorProfile {
  id: string;
  name: string;
  type?: "laser" | "sonar";
  height: number;
  beamWidth: number; // degrees
  tiltVertical: number; // degrees
  tiltHorizontal: number; // degrees
  maxRange: number; // meters
}

export interface SensorItem {
  id: string;
  name: string;
  type?: "laser" | "sonar";
  z: number;
  height: number;
  beamWidth: number;
  tiltVertical: number;
  tiltHorizontal: number;
  maxRange: number;
  placement: "left" | "right" | "center";
}

export interface Vector3Obj {
  x: number;
  y: number;
  z: number;
}
