import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  useStore,
  useSensorCalculations,
  raycastScene,
  getTruckTransform,
  useActiveTruck,
} from "../store";
import { Grid, Text, Line, Html } from "@react-three/drei";
import * as THREE from "three";

// ... other imports ...

// Fast AABB Raycasting Function for Sensor Beams extracted to store.ts

function buildBeamGeometry(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  up: THREE.Vector3,
  maxR: number,
  beamW: number,
  truckTransform: { position: THREE.Vector3; rotation: THREE.Euler },
  truckDim: { width: number; height: number; length: number },
  isLaser?: boolean | string,
) {
  const raysCount = isLaser === "entry" ? 32 : isLaser ? 1 : 16;
  const halfAngle = ((beamW / 2) * Math.PI) / 180;

  let right = new THREE.Vector3().crossVectors(dir, up).normalize();
  if (right.lengthSq() < 0.001) {
    right = new THREE.Vector3(1, 0, 0);
  }
  const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();

  const hitPoints: THREE.Vector3[] = [];
  const distances: number[] = [];
  const hitNormals: THREE.Vector3[] = [];
  const dirs: THREE.Vector3[] = [];

  // Center ray index 0
  const centerHit = raycastScene(origin, dir, maxR, truckTransform, truckDim);
  hitPoints.push(
    origin.clone().add(dir.clone().multiplyScalar(centerHit.distance)),
  );
  distances.push(centerHit.distance);
  hitNormals.push(centerHit.normal);
  dirs.push(dir);

  // Peripheral rays
  if (isLaser) {
    if (isLaser === "entry") {
      const fanAngle = (5 * Math.PI) / 180; // 5 degree vertical sweep
      for (let i = 0; i < raysCount; i++) {
        const fraction = i / (raysCount - 1);
        const angle = -fanAngle / 2 + fraction * fanAngle;
        const rDir = new THREE.Vector3()
          .copy(dir)
          .applyAxisAngle(right, angle)
          .normalize();

        const hit = raycastScene(origin, rDir, maxR, truckTransform, truckDim);
        const point = origin
          .clone()
          .add(rDir.clone().multiplyScalar(hit.distance));

        hitPoints.push(point);
        distances.push(hit.distance);
        hitNormals.push(hit.normal);
        dirs.push(rDir);
      }
    }
  } else {
    for (let i = 0; i < raysCount; i++) {
      const theta = (i / raysCount) * Math.PI * 2;
      const sinHalf = Math.sin(halfAngle);
      const cosHalf = Math.cos(halfAngle);

      const dx = Math.cos(theta) * sinHalf;
      const dy = Math.sin(theta) * sinHalf;
      const dz = cosHalf;

      const rDir = new THREE.Vector3()
        .addScaledVector(right, dx)
        .addScaledVector(realUp, dy)
        .addScaledVector(dir, dz)
        .normalize();

      const hit = raycastScene(origin, rDir, maxR, truckTransform, truckDim);
      const point = origin
        .clone()
        .add(rDir.clone().multiplyScalar(hit.distance));

      hitPoints.push(point);
      distances.push(hit.distance);
      hitNormals.push(hit.normal);
      dirs.push(rDir);
    }
  }

  return {
    hitPoints,
    distances,
    hitNormals,
    dirs,
    raysCount,
    centerHit,
    isLaser,
  };
}

function CustomBeam({
  origin,
  hitPoints,
  raysCount,
  isLaser,
  color = "#ef4444",
  opacity = 0.15,
}: {
  origin: THREE.Vector3;
  hitPoints: THREE.Vector3[];
  raysCount: number;
  isLaser?: boolean;
  color?: string;
  opacity?: number;
}) {
  const geoRef = useRef<THREE.BufferGeometry>(null);

  React.useEffect(() => {
    if (!geoRef.current) return;
    const positions = new Float32Array((raysCount + 2) * 3);

    positions[0] = origin.x;
    positions[1] = origin.y;
    positions[2] = origin.z;
    for (let i = 0; i < raysCount; i++) {
      const pt = hitPoints[i + 1];
      positions[(i + 1) * 3] = pt.x;
      positions[(i + 1) * 3 + 1] = pt.y;
      positions[(i + 1) * 3 + 2] = pt.z;
    }

    const centerHitIdx = raysCount + 1;
    positions[centerHitIdx * 3] = hitPoints[0].x;
    positions[centerHitIdx * 3 + 1] = hitPoints[0].y;
    positions[centerHitIdx * 3 + 2] = hitPoints[0].z;

    const indices = [];
    if (isLaser) {
      // Draw fan
      for (let i = 1; i < raysCount; i++) {
        indices.push(0, i, i + 1);
      }
    } else {
      for (let i = 1; i <= raysCount; i++) {
        const next = i === raysCount ? 1 : i + 1;
        indices.push(0, i, next);
        indices.push(centerHitIdx, next, i);
      }
    }

    geoRef.current.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    geoRef.current.setIndex(indices);
    geoRef.current.computeVertexNormals();
  }, [origin, hitPoints, raysCount, isLaser]);

  return (
    <mesh>
      <bufferGeometry ref={geoRef} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ReflectedBeamMesh({
  hitPoints,
  distances,
  hitNormals,
  dirs,
  raysCount,
  maxRange,
  isLaser,
}: {
  hitPoints: THREE.Vector3[];
  distances: number[];
  hitNormals: THREE.Vector3[];
  dirs: THREE.Vector3[];
  raysCount: number;
  maxRange: number;
  isLaser?: boolean;
}) {
  const geoRef = useRef<THREE.BufferGeometry>(null);

  React.useEffect(() => {
    if (!geoRef.current) return;

    const positions: number[] = [];
    const indices: number[] = [];

    const endPoints = hitPoints.map((pt, i) => {
      if (distances[i] >= maxRange - 0.05) return pt.clone();

      const normal = hitNormals[i];
      const vDir = dirs[i];
      const dot = vDir.dot(normal);
      const rDir = vDir
        .clone()
        .sub(normal.clone().multiplyScalar(2 * dot))
        .normalize();

      return pt.clone().add(rDir.multiplyScalar(maxRange));
    });

    positions.push(hitPoints[0].x, hitPoints[0].y, hitPoints[0].z);
    positions.push(endPoints[0].x, endPoints[0].y, endPoints[0].z);

    for (let i = 1; i <= raysCount; i++) {
      const h = hitPoints[i];
      const e = endPoints[i];
      positions.push(h.x, h.y, h.z);
      positions.push(e.x, e.y, e.z);
    }

    if (isLaser) {
      // Draw reflection as fan segments
      for (let i = 1; i < raysCount; i++) {
        let next = i + 1;
        let h_idx = 2 * i;
        let e_idx = 2 * i + 1;
        let nh_idx = 2 * next;
        let ne_idx = 2 * next + 1;
        indices.push(h_idx, ne_idx, e_idx);
        indices.push(h_idx, nh_idx, ne_idx);
      }
    } else {
      for (let i = 1; i <= raysCount; i++) {
        let next = i === raysCount ? 1 : i + 1;

        let h_idx = 2 * i;
        let e_idx = 2 * i + 1;

        let nh_idx = 2 * next;
        let ne_idx = 2 * next + 1;

        indices.push(h_idx, ne_idx, e_idx);
        indices.push(h_idx, nh_idx, ne_idx);
        indices.push(e_idx, ne_idx, 1);
        indices.push(h_idx, 0, nh_idx);
      }
    }

    geoRef.current.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(positions), 3),
    );
    geoRef.current.setIndex(indices);
    geoRef.current.computeVertexNormals();
  }, [hitPoints, distances, hitNormals, dirs, raysCount, maxRange, isLaser]);

  return (
    <mesh>
      <bufferGeometry ref={geoRef} />
      <meshBasicMaterial
        color="#3b82f6"
        transparent
        opacity={0.15}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function InteractiveFloor() {
  return (
    <mesh
      position={[0, 2.5, 0]} // Roughly middle of poles to easily catch horizontal movement
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export function Road() {
  const road = useStore((s) => s.road);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);
  const straightL = 60;
  const radius = 10;
  return (
    <group>
      {/* Straight 1 */}
      <mesh
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedEntity(selectedEntity === "road" ? null : "road");
        }}
      >
        <planeGeometry args={[road.width, straightL]} />
        <meshStandardMaterial color="#94a3b8" side={THREE.DoubleSide} />
      </mesh>
      {/* Straight 2 */}
      <mesh
        position={[-radius * 2, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedEntity(selectedEntity === "road" ? null : "road");
        }}
      >
        <planeGeometry args={[road.width, straightL]} />
        <meshStandardMaterial color="#94a3b8" side={THREE.DoubleSide} />
      </mesh>

      {/* Curves (just simple rings mapped) */}
      <mesh
        position={[-radius, -0.01, straightL / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry
          args={[
            radius - road.width / 2,
            radius + road.width / 2,
            32,
            1,
            Math.PI,
            Math.PI,
          ]}
        />
        <meshStandardMaterial color="#94a3b8" side={THREE.DoubleSide} />
      </mesh>
      <mesh
        position={[-radius, -0.01, -straightL / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry
          args={[
            radius - road.width / 2,
            radius + road.width / 2,
            32,
            1,
            0,
            Math.PI,
          ]}
        />
        <meshStandardMaterial color="#94a3b8" side={THREE.DoubleSide} />
      </mesh>

      {/* Dashed Center lines */}
      <Line
        points={[
          [0, 0, -straightL / 2],
          [0, 0, straightL / 2],
        ]}
        color="#ffffff"
        lineWidth={2}
        dashed
        dashSize={1}
        dashScale={1}
      />
      <Line
        points={[
          [-radius * 2, 0, -straightL / 2],
          [-radius * 2, 0, straightL / 2],
        ]}
        color="#ffffff"
        lineWidth={2}
        dashed
        dashSize={1}
        dashScale={1}
      />

      {selectedEntity === "road" && (
        <Html
          position={[road.width / 2 + 1, 0.5, 0]}
          center
          zIndexRange={[100, 0]}
        >
          <div className="bg-white/95 px-3 py-2 shadow-lg border border-slate-200 rounded-lg text-xs whitespace-nowrap text-slate-700 pointer-events-none select-none">
            <div className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
              Road Track
            </div>
            <div className="font-mono font-medium">Width: {road.width}m</div>
            <div className="font-mono font-medium">
              Straight Length: {straightL}m
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function FacilityDecorations() {
  const scale = useStore((s) => s.scale);
  const { truthCenter, sensorCenter, activeTruck } = useSensorCalculations();

  // Position of cabin relative to the road/scale center
  const cabinX = -scale.width / 2 - 2.5;
  const cabinZ = 0;

  // Calculate displayed weight
  let displayedWeightText = "---";
  let displayedWeightColor = "#64748b"; // Slate-500
  const flow = activeTruck.flowState;

  if (!["approaching", "exiting", "driving"].includes(flow)) {
    const baseWeight =
      activeTruck.width * activeTruck.height * activeTruck.length * 250;

    const maxDist = 10.5;
    let distFactor = 1.0 - Math.min(1.0, Math.abs(truthCenter) / maxDist);
    let weightFactor = 0.1 + distFactor * 0.9;

    const noise = Math.sin(truthCenter * 20) * (0.01 * baseWeight);
    const tolerance = activeTruck.truthTolerance ?? 0.05;

    if (["weighing", "weighing_complete", "exit_opening"].includes(flow)) {
      if (Math.abs(truthCenter) <= tolerance) {
        displayedWeightText = (baseWeight / 1000).toFixed(2) + " t";
        displayedWeightColor = "#10b981"; // Emerald green
      } else {
        const measuredWeight = baseWeight * weightFactor + noise;
        displayedWeightText =
          (Math.max(0, measuredWeight) / 1000).toFixed(2) + " t";
        displayedWeightColor = "#f43f5e"; // Rose
      }
    } else {
      displayedWeightText = "WAIT";
      displayedWeightColor = "#f59e0b"; // Amber
    }
  }

  return (
    <group>
      {/* Operator Cabin */}
      <group position={[cabinX, 1.5, cabinZ]}>
        {/* Main Building Body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[3, 3, 4]} />
          <meshStandardMaterial color="#c07158" /> {/* Brick-ish color */}
        </mesh>

        {/* Roof */}
        <mesh position={[0, 1.5 + 0.8, 0]} rotation={[0, Math.PI / 2, 0]}>
          <coneGeometry args={[3, 1.6, 4]} />
          <meshStandardMaterial color="#475569" /> {/* Dark grey slate */}
        </mesh>

        {/* Window facing scale */}
        <mesh position={[1.51, 0.2, 0]}>
          <boxGeometry args={[0.1, 1.2, 2.5]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.5}
            roughness={0.1}
          />
        </mesh>

        {/* Small Triangle Window on the gable */}
        <mesh position={[0, 1.8, 2.01]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0, 0.6, 0.1, 3]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.5}
            roughness={0.1}
          />
        </mesh>
        <mesh
          position={[0, 1.8, -2.01]}
          rotation={[-Math.PI / 2, Math.PI / 3, 0]}
        >
          {" "}
          {/* Try to point it right */}
          <cylinderGeometry args={[0, 0.6, 0.1, 3]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.5}
            roughness={0.1}
          />
        </mesh>

        {/* Billboard / Weight Display */}
        <group position={[-0.5, 4.0, 0]}>
          {" "}
          {/* slightly behind house center, elevated */}
          {/* Poles */}
          <mesh position={[0, -2, -1]}>
            <cylinderGeometry args={[0.08, 0.08, 4]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, -2, 1]}>
            <cylinderGeometry args={[0.08, 0.08, 4]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Screen */}
          <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[4, 2, 0.2]} />
            <meshStandardMaterial color="#020617" />
          </mesh>
          {/* Text displayed on the screen */}
          <Text
            position={[0.11, 0.2, 0]}
            rotation={[0, Math.PI / 2, 0]}
            color={displayedWeightColor}
            fontSize={0.8}
            anchorX="center"
            anchorY="middle"
          >
            {displayedWeightText}
          </Text>
          <Text
            position={[0.11, -0.6, 0]}
            rotation={[0, Math.PI / 2, 0]}
            color="#475569"
            fontSize={0.2}
            anchorX="center"
            anchorY="middle"
          >
            MEASURED WEIGHT
          </Text>
        </group>
      </group>

      {/* Main Canopy over the road/scale */}
      {/* We will build a few columns and a curved roof structure spanning across the track */}
      <group position={[0, 0, 0]}>
        {/* Left Columns (Near Cabin) */}
        {[-8, -4, 0, 4, 8].map((z) => (
          <mesh key={`col-l-${z}`} position={[-scale.width / 2 - 0.5, 2.5, z]}>
            <cylinderGeometry args={[0.08, 0.1, 5, 8]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
        ))}

        {/* Right Columns (Far side) */}
        {[-8, -4, 0, 4, 8].map((z) => (
          <mesh key={`col-r-${z}`} position={[scale.width / 2 + 2, 2.5, z]}>
            <cylinderGeometry args={[0.08, 0.1, 5, 8]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
        ))}

        {/* Curved Roof pieces */}
        <mesh
          position={[0.75, 5.0, 0]}
          rotation={[Math.PI / 2, Math.PI / 2, 0]}
        >
          <cylinderGeometry args={[2.75, 2.75, 20, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial
            color="#0f766e"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />{" "}
          {/* Glassy teal */}
        </mesh>

        {/* Truss/Beam outlines for Canopy */}
        {[-8, -4, 0, 4, 8].map((z) => (
          <mesh
            key={`truss-${z}`}
            position={[0.75, 5.0, z]}
            rotation={[0, 0, 0]}
          >
            <torusGeometry args={[2.75, 0.05, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        ))}
        {/* Middle longitudinal beam */}
        <mesh position={[0.75, 7.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 20, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>
    </group>
  );
}

export function TruckScale() {
  const scale = useStore((s) => s.scale);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);

  return (
    <group
      position={[0, 0.1, 0]}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedEntity(selectedEntity === "scale" ? null : "scale");
      }}
    >
      {/* Main scale platform */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[scale.width, 0.2, scale.length]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      {/* Center line */}
      <mesh position={[0, 0.11, 0]}>
        <boxGeometry args={[scale.width, 0.02, 0.1]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>

      {selectedEntity === "scale" && (
        <Html
          position={[scale.width / 2 + 1, 1, 0]}
          center
          zIndexRange={[100, 0]}
        >
          <div className="bg-white/95 px-3 py-2 shadow-lg border border-slate-200 rounded-lg text-xs whitespace-nowrap text-slate-700 pointer-events-none select-none">
            <div className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
              Truck Scale
            </div>
            <div className="font-mono font-medium">Width: {scale.width}m</div>
            <div className="font-mono font-medium">Length: {scale.length}m</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function Wheel({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.4, 0.4, 0.3, 32]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
  );
}

export function DeadTrucks() {
  const deadTrucks = useStore((s) => s.deadTrucks);
  if (!deadTrucks) return null;
  return (
    <group>
      {deadTrucks.map((t) => (
        <Truck
          key={t.id}
          config={t.config}
          overrideTransform={{ position: t.pos, rotation: t.rot }}
        />
      ))}
    </group>
  );
}

export function Trucks() {
  const trucks = useStore((s) => s.trucks);
  if (!trucks) return null;
  return (
    <group>
      {trucks.map((t) => (
        <Truck key={t.id} config={t} />
      ))}
    </group>
  );
}

function TruckLogos({ url, width, cargoHeight, cargoLength, pos }: any) {
  const [tex, setTex] = React.useState<THREE.Texture | null>(null);
  React.useEffect(() => {
    if (!url) return;
    new THREE.TextureLoader().load(url, (t) => setTex(t));
  }, [url]);

  if (!tex) return null;
  const size = Math.min(cargoHeight, cargoLength) * 0.8;
  return (
    <group position={pos}>
      <mesh
        position={[-width / 2 - 0.01, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[cargoLength * 0.9, size]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[width / 2 + 0.01, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[cargoLength * 0.9, size]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Truck({
  config,
  overrideTransform,
}: {
  config: any;
  overrideTransform?: {
    position: [number, number, number];
    rotation: [number, number, number];
  };
}) {
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);

  const truck = config;
  const d = truck.d;
  const isGhost = false;

  // Procedural composition of truck lengths based on config
  const cabLength = Math.min(2.5, truck.length * 0.35);
  const cargoLength = truck.length - cabLength;

  const chassisHeight = 0.4; // Base platform
  const wheelRadius = 0.4;
  const clearance = wheelRadius;

  const bodyHeight = truck.height - chassisHeight - clearance;
  const cargoHeight = bodyHeight;
  const cabHeight = bodyHeight * 0.8;

  const width = truck.width;
  const xEdges = width / 2 - 0.2;

  const bypass = truck.hasBox === false;
  const tform = getTruckTransform(d);

  return (
    <group
      position={overrideTransform ? overrideTransform.position : tform.position}
      rotation={overrideTransform ? overrideTransform.rotation : tform.rotation}
      onClick={(e) => {
        if (isGhost) return;
        e.stopPropagation();
        setSelectedEntity(
          selectedEntity === `truck-${truck.id}` ? null : `truck-${truck.id}`,
        );
      }}
    >
      {/* Body Elevated over clearance */}
      <group position={[0, clearance + chassisHeight / 2, 0]}>
        {/* Chassis rail structure */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[width * 0.8, chassisHeight, truck.length]} />
          <meshStandardMaterial color="#334155" />
        </mesh>

        {/* Cabin Head (Front is negative Z) */}
        <mesh
          position={[
            0,
            chassisHeight / 2 + cabHeight / 2,
            -truck.length / 2 + cabLength / 2,
          ]}
        >
          <boxGeometry args={[width * 0.95, cabHeight, cabLength * 0.95]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
        {/* Windshield */}
        <mesh
          position={[
            0,
            chassisHeight / 2 + cabHeight / 2 + 0.1,
            -truck.length / 2 + 0.05,
          ]}
        >
          <boxGeometry args={[width * 0.85, cabHeight * 0.5, 0.1]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>

        {/* Cargo Payload Box */}
        {!bypass && (
          <>
            <mesh
              position={[
                0,
                chassisHeight / 2 + cargoHeight / 2,
                -truck.length / 2 + cabLength + cargoLength / 2,
              ]}
            >
              <boxGeometry args={[width, cargoHeight, cargoLength * 0.98]} />
              <meshStandardMaterial
                color={isGhost ? "#e2e8f0" : "#f8fafc"}
                transparent={isGhost}
                opacity={isGhost ? 0.9 : 1}
              />
            </mesh>
            {truck.logoUrl && !isGhost && (
              <TruckLogos
                url={truck.logoUrl}
                width={width}
                cargoHeight={cargoHeight}
                cargoLength={cargoLength}
                pos={[
                  0,
                  chassisHeight / 2 + cargoHeight / 2,
                  -truck.length / 2 + cabLength + cargoLength / 2,
                ]}
              />
            )}
          </>
        )}

        {selectedEntity === `truck-${truck.id}` && !isGhost && (
          <Html
            position={[width / 2 + 1, chassisHeight / 2 + cargoHeight / 2, 0]}
            center
            zIndexRange={[100, 0]}
          >
            <div className="bg-white/95 px-3 py-2 shadow-lg border border-slate-200 rounded-lg text-xs whitespace-nowrap text-slate-700 pointer-events-none select-none">
              <div className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
                Truck Dimensions
              </div>
              <div className="font-mono font-medium">
                Width: {truck.width.toFixed(1)}m
              </div>
              <div className="font-mono font-medium">
                Height: {truck.height.toFixed(1)}m
              </div>
              <div className="font-mono font-medium">
                Length: {truck.length.toFixed(1)}m
              </div>
            </div>
          </Html>
        )}
      </group>

      {/* Wheels */}
      <Wheel
        x={xEdges}
        y={wheelRadius}
        z={-truck.length / 2 + Math.min(1.2, truck.length * 0.2)}
      />
      <Wheel
        x={-xEdges}
        y={wheelRadius}
        z={-truck.length / 2 + Math.min(1.2, truck.length * 0.2)}
      />

      <Wheel
        x={xEdges}
        y={wheelRadius}
        z={truck.length / 2 - Math.min(1.5, truck.length * 0.25)}
      />
      <Wheel
        x={-xEdges}
        y={wheelRadius}
        z={truck.length / 2 - Math.min(1.5, truck.length * 0.25)}
      />

      {truck.length > 6 && (
        <>
          <Wheel
            x={xEdges}
            y={wheelRadius}
            z={truck.length / 2 - Math.min(2.5, truck.length * 0.25) - 1.0}
          />
          <Wheel
            x={-xEdges}
            y={wheelRadius}
            z={truck.length / 2 - Math.min(2.5, truck.length * 0.25) - 1.0}
          />
        </>
      )}
      {truck.length >= 12 && (
        <>
          <Wheel x={xEdges} y={wheelRadius} z={0} />
          <Wheel x={-xEdges} y={wheelRadius} z={0} />
        </>
      )}
    </group>
  );
}

function ReflectionView({
  hitPt,
  rDir,
  remain,
  beamWidth,
}: {
  hitPt: THREE.Vector3;
  rDir: THREE.Vector3;
  remain: number;
  beamWidth: number;
}) {
  const ref = useRef<THREE.Group>(null);
  React.useEffect(() => {
    if (ref.current) {
      ref.current.lookAt(hitPt.x + rDir.x, hitPt.y + rDir.y, hitPt.z + rDir.z);
    }
  }, [hitPt, rDir]);

  const coneRadius = remain * Math.tan(((beamWidth / 2) * Math.PI) / 180);

  return (
    <group position={[hitPt.x, hitPt.y, hitPt.z]} ref={ref}>
      <mesh position={[0, 0, remain / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[coneRadius, remain, 16]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.08}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line
        points={[
          [0, 0, 0],
          [0, 0, remain],
        ]}
        color="#3b82f6"
        dashSize={0.5}
        dashed
        opacity={0.5}
        transparent
      />
    </group>
  );
}

function SensorPole({
  id,
  type,
  name,
  z,
  height,
  beamWidth,
  tiltVertical,
  tiltHorizontal,
  placement,
  maxRange,
  isOpenOverride,
}: {
  id: string;
  type?: "laser" | "sonar";
  name: string;
  z: number;
  height: number;
  beamWidth: number;
  tiltVertical: number;
  tiltHorizontal: number;
  placement: "left" | "right" | "center";
  maxRange?: number;
  isOpenOverride?: boolean;
}) {
  const scale = useStore((s) => s.scale);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);
  const truck = useActiveTruck();

  const xOffset = placement === "center" ? 0 : scale.width / 2 + 0.3;
  const xDir = placement === "left" ? -1 : placement === "center" ? 0 : 1;
  const posX = placement === "center" ? 0 : xDir * xOffset;

  const road = useStore((s) => s.road);
  const mR = maxRange || 4.5;
  const tiltVRads = (tiltVertical * Math.PI) / 180;
  const tiltHRads = (tiltHorizontal * Math.PI) / 180;

  const dirXBase = placement === "center" ? 0 : -xDir;
  const zDirBase =
    placement === "center" ? (tiltHorizontal === 180 ? -1 : 1) : 0;

  const dirX =
    placement === "center"
      ? 0
      : dirXBase * Math.cos(tiltVRads) * Math.cos(tiltHRads);
  const dirZ =
    placement === "center"
      ? zDirBase * Math.cos(tiltVRads)
      : dirXBase * Math.cos(tiltVRads) * Math.sin(tiltHRads);
  const dirY = -Math.sin(tiltVRads);

  const flowState = truck.flowState;

  const isEntry = z === -10.5;
  const isExit = z === 10.5;
  const isOpen =
    placement === "center"
      ? isOpenOverride !== undefined
        ? isOpenOverride
        : isEntry
          ? ["entry_opening", "entering"].includes(flowState)
          : isExit
            ? ["exit_opening", "exit_holding", "exiting"].includes(flowState)
            : false
      : false;
  const targetAngle = isOpen ? Math.PI / 2 : 0;
  const [angle, setAngle] = React.useState(targetAngle);

  useFrame((state, delta) => {
    setAngle((curr) => {
      const diff = targetAngle - curr;
      if (Math.abs(diff) < 0.001) return targetAngle;
      return curr + diff * (delta * 10);
    });
  });

  const tform = getTruckTransform(truck.d);
  const truckDim = {
    width: truck.width,
    height: truck.height,
    length: truck.length,
    hasBox: truck.hasBox,
  };

  const truckMin = useMemo(
    () => new THREE.Vector3(-truck.width / 2, 0, -truck.length / 2),
    [truck.width, truck.length],
  );
  const truckMax = useMemo(
    () => new THREE.Vector3(truck.width / 2, truck.height, truck.length / 2),
    [truck.width, truck.height, truck.length],
  );

  const origin = useMemo(() => {
    if (placement === "center") {
      const pivotX = -(road.width / 2 + 0.5);
      const radius = road.width / 2 + 0.5;
      return new THREE.Vector3(
        pivotX + radius * Math.cos(angle),
        height + radius * Math.sin(angle),
        z,
      );
    }
    return new THREE.Vector3(posX, height, z);
  }, [posX, height, z, placement, road.width, angle]);

  const targetX = origin.x + mR * dirX;
  const targetY = origin.y + mR * dirY;
  const targetZ = origin.z + mR * dirZ;

  const headRef = useRef<THREE.Group>(null);
  React.useEffect(() => {
    if (headRef.current) {
      headRef.current.lookAt(targetX, targetY, targetZ);
    }
  }, [targetX, targetY, targetZ]);

  const worldDir = useMemo(
    () => new THREE.Vector3(dirX, dirY, dirZ).normalize(),
    [dirX, dirY, dirZ],
  );
  const worldUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const isLaser = type === "laser";
  const laserType = isLaser
    ? id === "s-entry-laser"
      ? "entry"
      : "exit"
    : false;
  const isLaserActive = isLaser ? flowState === "weighing" : true;

  const effectiveMR = isLaserActive ? mR : 0;

  const beamData = useMemo(
    () =>
      buildBeamGeometry(
        origin,
        worldDir,
        worldUp,
        effectiveMR,
        beamWidth,
        tform,
        truckDim,
        laserType,
      ),
    [
      origin,
      worldDir,
      worldUp,
      effectiveMR,
      beamWidth,
      tform,
      truckDim,
      laserType,
    ],
  );

  return (
    <group position={[posX, 0, z]}>
      {/* Pole (only for left/right, center uses crossbar mounting) */}
      {placement !== "center" && (
        <mesh
          position={[0, height / 2, 0]}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEntity(
              selectedEntity === "sensor-" + id ? null : "sensor-" + id,
            );
          }}
        >
          <cylinderGeometry args={[0.08, 0.08, height]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      )}

      {/* Sensor Head Focus */}
      {placement === "center" ? (
        <group
          position={[-(road.width / 2 + 0.5), 1.0, 0]}
          rotation={[0, 0, angle]}
        >
          <group position={[road.width / 2 + 0.5, 0, 0]}>
            <group ref={headRef}>
              <mesh>
                <boxGeometry args={[0.1, 0.1, 0.15]} />
                <meshStandardMaterial color="#ef4444" />
              </mesh>
            </group>
          </group>
          {/* Cable traced along the crossbar */}
          <mesh
            position={[(road.width / 2 + 0.5) / 2, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.015, 0.015, road.width / 2 + 0.5]} />
            <meshStandardMaterial color="#000" />
          </mesh>
        </group>
      ) : (
        <group position={[0, height, 0]}>
          <group ref={headRef}>
            <mesh>
              <boxGeometry args={[0.2, 0.2, 0.3]} />
              <meshStandardMaterial color="#3b82f6" />
            </mesh>
          </group>
        </group>
      )}

      {/* World-space aligned beam and reflections */}
      {isLaserActive && (
        <group position={[-posX, 0, -z]}>
          {laserType === "exit" ? (
            <>
              <Line
                points={[
                  [origin.x, origin.y, origin.z],
                  [
                    beamData.hitPoints[0].x,
                    beamData.hitPoints[0].y,
                    beamData.hitPoints[0].z,
                  ],
                ]}
                color="#ef4444"
                lineWidth={2}
              />
              <mesh
                position={[
                  beamData.hitPoints[0].x,
                  beamData.hitPoints[0].y,
                  beamData.hitPoints[0].z,
                ]}
              >
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
            </>
          ) : laserType === "entry" ? (
            <>
              <CustomBeam
                origin={origin}
                hitPoints={beamData.hitPoints}
                raysCount={beamData.raysCount}
                isLaser={true}
                color="#b45309"
                opacity={0.4}
              />
            </>
          ) : (
            <>
              <CustomBeam
                origin={origin}
                hitPoints={beamData.hitPoints}
                raysCount={beamData.raysCount}
              />
              <ReflectedBeamMesh
                hitPoints={beamData.hitPoints}
                distances={beamData.distances}
                hitNormals={beamData.hitNormals}
                dirs={beamData.dirs}
                raysCount={beamData.raysCount}
                maxRange={mR}
              />
            </>
          )}
        </group>
      )}

      {selectedEntity === "sensor-" + id && (
        <Html position={[0, height + 0.5, 0]} center zIndexRange={[100, 0]}>
          <div className="bg-white/95 px-3 py-2 shadow-lg border border-slate-200 rounded-lg text-xs whitespace-nowrap text-slate-700 pointer-events-none select-none">
            <div className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
              {name || "Sensor"}
            </div>
            <div className="font-mono font-medium">
              Height: {height.toFixed(1)}m
            </div>
            <div className="font-mono font-medium">
              Max Range: {mR.toFixed(1)}m
            </div>
            <div className="font-mono font-medium">
              Beam Angle: {beamWidth.toFixed(1)}°
            </div>
            <div className="font-mono font-medium">
              Tilt Vert: {tiltVertical.toFixed(1)}°
            </div>
            <div className="font-mono font-medium">
              Tilt Horiz: {tiltHorizontal.toFixed(1)}°
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function CrossbarGate({
  z,
  isOpen,
  reverse = false,
}: {
  z: number;
  isOpen: boolean;
  reverse?: boolean;
}) {
  const road = useStore((s) => s.road);
  const targetAngle = isOpen ? (reverse ? -Math.PI / 2 : Math.PI / 2) : 0;
  const [angle, setAngle] = React.useState(targetAngle);

  // Smooth animate the angle
  useFrame((state, delta) => {
    setAngle((curr) => {
      const diff = targetAngle - curr;
      if (Math.abs(diff) < 0.001) return targetAngle;
      return curr + diff * (delta * 10);
    });
  });

  const pivotDir = reverse ? 1 : -1;

  return (
    <group position={[pivotDir * (road.width / 2 + 0.5), 1.0, z]}>
      {/* Support Pole */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[0.4, 1.0, 0.4]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      {/* Pivot */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.5]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Barrier Boom */}
      <group rotation={[0, 0, angle]}>
        {/* We translate so it hinges at the end */}
        <mesh position={[-pivotDir * (road.width / 2 + 0.5), 0, 0]}>
          <boxGeometry args={[road.width + 1, 0.15, 0.1]} />
          <meshStandardMaterial color={reverse ? "#ef4444" : "#eab308"} />
        </mesh>
      </group>
    </group>
  );
}

function FacilityExitGates() {
  const trucks = useStore((s) => s.trucks);
  if (!trucks || trucks.length === 0) return null;

  const straightL = 60;
  const curveL = Math.PI * 10;
  const startD = straightL + curveL; // 91.41

  // d goes from 91.41 to 151.41 on this side. z goes from 30 to -30.
  const dAtFirstGate = startD + 30 - 10.5; // reaches first gate
  const dAtSecondGate = startD + 30 + 10.5; // reaches second gate

  let openFirst = false;
  let openSecond = false;

  for (const t of trucks) {
    if (t.d > dAtFirstGate - 10 && t.d < dAtFirstGate + 15) openFirst = true;
    if (t.d > dAtSecondGate - 10 && t.d < dAtSecondGate + 15) openSecond = true;
  }

  return (
    <group position={[-20, 0, 0]} rotation={[0, 0, 0]}>
      <CrossbarGate z={10.5} isOpen={openFirst} reverse={true} />
      <CrossbarGate z={-10.5} isOpen={openSecond} reverse={true} />

      {/* Goodbye Billboard */}
      <group position={[0, 4.0, -10.5]}>
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry args={[7, 1.5, 0.2]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <Text
          position={[0, 0, 0.21]}
          fontSize={0.8}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          GOODBYE
        </Text>
      </group>
    </group>
  );
}

export function Sensors() {
  const { readings: sensors, activeTruck } = useSensorCalculations();
  const scale = useStore((s) => s.scale);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const trucks = useStore((s) => s.trucks) || [activeTruck];

  // A truck needs the entry gate open if its front is very close to it (-11.5) up to when its rear passes it (-10.5)
  // We use the flowState or z-position:
  let entryOpen = false;
  let exitOpen = false;

  for (const t of trucks) {
    if (["entry_opening", "entering"].includes(t.flowState)) entryOpen = true;
    if (["exit_opening", "exit_holding", "exiting"].includes(t.flowState)) {
      exitOpen = true;
    } else {
      // If a truck is physically under the exit gate, force it open
      const tFront = -30 + t.d + t.length / 2;
      const tRear = -30 + t.d - t.length / 2;
      if (tFront > 9.0 && tRear < 11.5) exitOpen = true;
      if (tFront > -11.5 && tRear < -10.3) entryOpen = true; // Extra safety for entry
    }
  }

  return (
    <group>
      {/* Entry Gate with 2 Crossbars */}
      <CrossbarGate z={-10.5} isOpen={entryOpen} reverse={false} />
      <CrossbarGate z={10.5} isOpen={exitOpen} reverse={false} />

      <FacilityExitGates />

      {/* Central Sensor box near the sonar */}
      <mesh position={[-scale.width / 2 - 0.5, 0.2, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Cable from entry gate (-10.5) to central box (0) */}
      <mesh position={[-scale.width / 2 - 0.5, 0.02, -5.25]}>
        <boxGeometry args={[0.08, 0.04, 10.5]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* Cable from exit gate (+10.5) to central box (0) */}
      <mesh position={[-scale.width / 2 - 0.5, 0.02, 5.25]}>
        <boxGeometry args={[0.08, 0.04, 10.5]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {sensors.map((sens) => {
        const tV = sens.tiltVertical ?? (sens as any).tilt ?? 0;
        const tH = sens.tiltHorizontal ?? 0;

        return (
          <group key={sens.id}>
            {/* Base line indicating its position lightly */}
            <Line
              points={[
                [
                  (scale.width / 2 + 0.3) *
                    (sens.placement === "left" ? -1 : 1),
                  0.01,
                  sens.z,
                ],
                [
                  (scale.width / 2) * (sens.placement === "left" ? -1 : 1),
                  0.01,
                  sens.z,
                ],
              ]}
              color="#22c55e"
              lineWidth={1}
            />
            {selectedEntity === "road" && (
              <Html
                position={[
                  (scale.width / 2 + 1) * (sens.placement === "left" ? -1 : 1),
                  0.5,
                  sens.z,
                ]}
                center
                zIndexRange={[100, 0]}
              >
                <div className="bg-emerald-50 px-2 py-1 shadow border border-emerald-200 rounded text-[10px] text-emerald-800 font-mono pointer-events-none select-none">
                  Sensor {sens.placement} Z: {sens.z}m
                </div>
              </Html>
            )}

            <SensorPole
              id={sens.id}
              type={sens.type as any}
              name={sens.name}
              z={sens.z}
              height={sens.height}
              beamWidth={sens.beamWidth}
              tiltVertical={tV}
              tiltHorizontal={tH}
              placement={sens.placement as any}
              maxRange={sens.maxRange}
              isOpenOverride={
                sens.z === -10.5
                  ? entryOpen
                  : sens.z === 10.5
                    ? exitOpen
                    : undefined
              }
            />
          </group>
        );
      })}
    </group>
  );
}

function ExplosionParticles({ x, y, z }: { x: number; y: number; z: number }) {
  const [scale, setScale] = React.useState(0.1);
  const [opacity, setOpacity] = React.useState(0.8);

  useFrame((state, delta) => {
    setScale((s) => s + delta * 15);
    setOpacity((o) => Math.max(0, o - delta * 0.5));
  });

  if (opacity <= 0) return null;

  return (
    <group position={[x, y, z]}>
      <mesh scale={[scale, scale, scale]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={opacity} />
      </mesh>
      <mesh scale={[scale * 0.8, scale * 0.8, scale * 0.8]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial
          color="#eab308"
          transparent
          opacity={opacity * 1.2}
        />
      </mesh>
    </group>
  );
}

export function Explosions() {
  const explosions = useStore((s) => s.explosions);
  return (
    <group>
      {explosions.map((e) => (
        <ExplosionParticles key={e.id} x={e.x} y={e.y} z={e.z} />
      ))}
    </group>
  );
}
