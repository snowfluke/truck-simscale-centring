import React, { useRef, useMemo } from "react";
import { useStore, useSensorCalculations, raycastScene } from "../store";
import { Grid, Text, Line, Html } from "@react-three/drei";
import * as THREE from "three";

// Fast AABB Raycasting Function for Sensor Beams extracted to store.ts

function buildBeamGeometry(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  up: THREE.Vector3,
  maxR: number,
  beamW: number,
  truckMin: THREE.Vector3,
  truckMax: THREE.Vector3,
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
  const centerHit = raycastScene(origin, dir, maxR, truckMin, truckMax);
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

    const hit = raycastScene(origin, rDir, maxR, truckMin, truckMax);
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

  return (
    <group>
      <mesh
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedEntity(selectedEntity === "road" ? null : "road");
        }}
      >
        <planeGeometry args={[road.width, road.length]} />
        <meshStandardMaterial color="#94a3b8" side={THREE.DoubleSide} />
      </mesh>
      {/* Dashed Center line */}
      <Line
        points={[
          [0, 0, -road.length / 2],
          [0, 0, road.length / 2],
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
              Road
            </div>
            <div className="font-mono font-medium">Width: {road.width}m</div>
            <div className="font-mono font-medium">Length: {road.length}m</div>
          </div>
        </Html>
      )}
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
  // Typical cab is fixed length, rest is cargo
  const cabLength = Math.min(2.5, truck.length * 0.35);
  const cargoLength = truck.length - cabLength;

  const chassisHeight = 0.4; // Base platform
  const wheelRadius = 0.4;
  const clearance = wheelRadius; // Wheels are radius 0.4, half is under chassis essentially or under

  // Remaining heights
  const bodyHeight = truck.height - chassisHeight - clearance;
  const cargoHeight = bodyHeight;
  const cabHeight = bodyHeight * 0.8;

  const width = truck.width;
  const xEdges = width / 2 - 0.2;

  return (
    <group
      position={[0, 0, truck.z]}
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
  name: string;
  z: number;
  height: number;
  beamWidth: number;
  tiltVertical: number;
  tiltHorizontal: number;
  placement: "left" | "right";
  maxRange?: number;
}) {
  const scale = useStore((s) => s.scale);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);
  const truck = useStore((s) => s.truck);

  const xOffset = scale.width / 2 + 0.3;
  const xDir = placement === "left" ? -1 : 1;
  const posX = xDir * xOffset;

  const mR = maxRange || 4.5;
  const tiltVRads = (tiltVertical * Math.PI) / 180;
  const tiltHRads = (tiltHorizontal * Math.PI) / 180;

  const dirXBase = -xDir;
  const dirX = dirXBase * Math.cos(tiltVRads) * Math.cos(tiltHRads);
  const dirZ = dirXBase * Math.cos(tiltVRads) * Math.sin(tiltHRads);
  const dirY = -Math.sin(tiltVRads);

  const targetX = posX + mR * dirX;
  const targetY = height + mR * dirY;
  const targetZ = z + mR * dirZ;

  const headRef = useRef<THREE.Group>(null);
  React.useEffect(() => {
    if (headRef.current) {
      headRef.current.lookAt(targetX, targetY, targetZ);
    }
  }, [targetX, targetY, targetZ]);

  const truckMin = useMemo(
    () => new THREE.Vector3(-truck.width / 2, 0, truck.z - truck.length / 2),
    [truck.width, truck.z, truck.length],
  );
  const truckMax = useMemo(
    () =>
      new THREE.Vector3(
        truck.width / 2,
        truck.height,
        truck.z + truck.length / 2,
      ),
    [truck.width, truck.height, truck.z, truck.length],
  );

  const origin = useMemo(
    () => new THREE.Vector3(posX, height, z),
    [posX, height, z],
  );
  const worldDir = useMemo(
    () => new THREE.Vector3(dirX, dirY, dirZ).normalize(),
    [dirX, dirY, dirZ],
  );
  const worldUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const beamData = useMemo(
    () =>
      buildBeamGeometry(
        origin,
        worldDir,
        worldUp,
        mR,
        beamWidth,
        truckMin,
        truckMax,
      ),
    [origin, worldDir, worldUp, mR, beamWidth, truckMin, truckMax],
  );

  return (
    <group position={[posX, 0, z]}>
      {/* Pole */}
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

      {/* Sensor Head Focus */}
      <group position={[0, height, 0]}>
        <group ref={headRef}>
          <mesh>
            <boxGeometry args={[0.2, 0.2, 0.3]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      </group>

      {/* World-space aligned beam and reflections */}
      <group position={[-posX, 0, -z]}>
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
      </group>

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

export function Sensors() {
  const { readings: sensors } = useSensorCalculations();
  const scale = useStore((s) => s.scale);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);

  return (
    <group>
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
              name={sens.name}
              z={sens.z}
              height={sens.height}
              beamWidth={sens.beamWidth}
              tiltVertical={tV}
              tiltHorizontal={tH}
              placement={sens.placement}
              maxRange={sens.maxRange}
            />
          </group>
        );
      })}
    </group>
  );
}
