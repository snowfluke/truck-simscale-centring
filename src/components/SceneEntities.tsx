import React, { useRef, useMemo } from "react";
import {
  useStore,
  useSensorCalculations,
  raycastScene,
  getTruckTransform,
} from "../store";
import { Grid, Text, Line, Html } from "@react-three/drei";
import * as THREE from "three";

// Fast AABB Raycasting Function for Sensor Beams extracted to store.ts

function buildBeamGeometry(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  up: THREE.Vector3,
  maxR: number,
  beamW: number,
  truckTransform: { position: THREE.Vector3; rotation: THREE.Euler },
  truckDim: { width: number; height: number; length: number },
) {
  const raysCount = 16;
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
    const point = origin.clone().add(rDir.clone().multiplyScalar(hit.distance));

    hitPoints.push(point);
    distances.push(hit.distance);
    hitNormals.push(hit.normal);
    dirs.push(rDir);
  }

  return { hitPoints, distances, hitNormals, dirs, raysCount, centerHit };
}

function CustomBeam({
  origin,
  hitPoints,
  raysCount,
}: {
  origin: THREE.Vector3;
  hitPoints: THREE.Vector3[];
  raysCount: number;
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
    for (let i = 1; i <= raysCount; i++) {
      const next = i === raysCount ? 1 : i + 1;
      indices.push(0, i, next);
      indices.push(centerHitIdx, next, i);
    }

    geoRef.current.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    geoRef.current.setIndex(indices);
    geoRef.current.computeVertexNormals();
  }, [origin, hitPoints, raysCount]);

  return (
    <mesh>
      <bufferGeometry ref={geoRef} />
      <meshBasicMaterial
        color="#ef4444"
        transparent
        opacity={0.15}
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
}: {
  hitPoints: THREE.Vector3[];
  distances: number[];
  hitNormals: THREE.Vector3[];
  dirs: THREE.Vector3[];
  raysCount: number;
  maxRange: number;
}) {
  const geoRef = useRef<THREE.BufferGeometry>(null);

  React.useEffect(() => {
    if (!geoRef.current) return;

    const positions: number[] = [];
    const indices: number[] = [];

    const endPoints = hitPoints.map((pt, i) => {
      // If the ray didn't hit anything closer than maxRange, it doesn't reflect
      if (distances[i] >= maxRange - 0.05) return pt.clone();

      const normal = hitNormals[i];
      const vDir = dirs[i];
      const dot = vDir.dot(normal);
      const rDir = vDir
        .clone()
        .sub(normal.clone().multiplyScalar(2 * dot))
        .normalize();

      // The reflection travels out as far as the maxRange.
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

    for (let i = 1; i <= raysCount; i++) {
      let next = i === raysCount ? 1 : i + 1;

      let h_idx = 2 * i;
      let e_idx = 2 * i + 1;

      let nh_idx = 2 * next;
      let ne_idx = 2 * next + 1;

      // Side faces
      indices.push(h_idx, ne_idx, e_idx);
      indices.push(h_idx, nh_idx, ne_idx);

      // Cap faces
      indices.push(e_idx, ne_idx, 1);

      // Base faces
      indices.push(h_idx, 0, nh_idx);
    }

    geoRef.current.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(positions), 3),
    );
    geoRef.current.setIndex(indices);
    geoRef.current.computeVertexNormals();
  }, [hitPoints, distances, hitNormals, dirs, raysCount, maxRange]);

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

  // Position of cabin relative to the road/scale center
  const cabinX = -scale.width / 2 - 2.5;
  const cabinZ = 0;

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

export function Truck() {
  const truck = useStore((s) => s.truck);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);

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

  const tform = getTruckTransform(truck.d);

  return (
    <group
      position={tform.position}
      rotation={tform.rotation}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedEntity(selectedEntity === "truck" ? null : "truck");
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
        <mesh
          position={[
            0,
            chassisHeight / 2 + cargoHeight / 2,
            -truck.length / 2 + cabLength + cargoLength / 2,
          ]}
        >
          <boxGeometry args={[width, cargoHeight, cargoLength * 0.98]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>

        {selectedEntity === "truck" && (
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
      <Wheel x={xEdges} y={wheelRadius} z={-truck.length / 2 + 1.2} />
      <Wheel x={-xEdges} y={wheelRadius} z={-truck.length / 2 + 1.2} />

      <Wheel x={xEdges} y={wheelRadius} z={truck.length / 2 - 1.5} />
      <Wheel x={-xEdges} y={wheelRadius} z={truck.length / 2 - 1.5} />

      {truck.length > 6 && (
        <>
          <Wheel x={xEdges} y={wheelRadius} z={truck.length / 2 - 2.5} />
          <Wheel x={-xEdges} y={wheelRadius} z={truck.length / 2 - 2.5} />
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
}) {
  const scale = useStore((s) => s.scale);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);
  const truck = useStore((s) => s.truck);

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

  const flowState = useStore((s) => s.truck.flowState);

  const isEntry = z === -10.5;
  const isExit = z === 10.5;
  const isOpen =
    placement === "center"
      ? isEntry
        ? ["entry_opening", "entering"].includes(flowState)
        : isExit
          ? ["exit_opening", "exiting"].includes(flowState)
          : false
      : false;
  const targetAngle = isOpen ? Math.PI / 2 : 0;
  const [angle, setAngle] = React.useState(targetAngle);

  React.useEffect(() => {
    let animationFrame: number;
    const animate = () => {
      setAngle((curr) => {
        const diff = targetAngle - curr;
        if (Math.abs(diff) < 0.01) return targetAngle;
        return curr + diff * 0.1;
      });
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, [targetAngle]);

  const tform = getTruckTransform(truck.d);
  const truckDim = {
    width: truck.width,
    height: truck.height,
    length: truck.length,
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
      ),
    [origin, worldDir, worldUp, effectiveMR, beamWidth, tform, truckDim],
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
          {isLaser ? (
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
              {/* Reflection point */}
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
  React.useEffect(() => {
    let animationFrame: number;
    const animate = () => {
      setAngle((curr) => {
        const diff = targetAngle - curr;
        if (Math.abs(diff) < 0.01) return targetAngle;
        return curr + diff * 0.1;
      });
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, [targetAngle]);

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
  const d = useStore((s) => s.truck.d);
  const straightL = 60;
  const curveL = Math.PI * 10;
  const startD = straightL + curveL; // 91.41

  // d goes from 91.41 to 151.41 on this side. z goes from 30 to -30.
  const dAtFirstGate = startD + 30 - 10.5; // reaches first gate
  const dAtSecondGate = startD + 30 + 10.5; // reaches second gate

  const openFirst = d > dAtFirstGate - 10 && d < dAtFirstGate + 15;
  const openSecond = d > dAtSecondGate - 10 && d < dAtSecondGate + 15;

  return (
    <group position={[-20, 0, 0]} rotation={[0, 0, 0]}>
      <CrossbarGate z={10.5} isOpen={openFirst} reverse={true} />
      <CrossbarGate z={-10.5} isOpen={openSecond} reverse={true} />
    </group>
  );
}

export function Sensors() {
  const { readings: sensors } = useSensorCalculations();
  const scale = useStore((s) => s.scale);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const state = useStore((s) => s.truck.flowState);

  return (
    <group>
      {/* Entry Gate with 2 Crossbars */}
      <CrossbarGate
        z={-10.5}
        isOpen={["entry_opening", "entering"].includes(state)}
        reverse={false}
      />
      <CrossbarGate
        z={10.5}
        isOpen={["exit_opening", "exiting"].includes(state)}
        reverse={false}
      />

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
            />
          </group>
        );
      })}
    </group>
  );
}
