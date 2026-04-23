import React, { useRef } from 'react';
import { useStore } from '../store';
import { Grid, Text, Line, Html } from '@react-three/drei';
import * as THREE from 'three';

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
             setSelectedEntity(selectedEntity === 'road' ? null : 'road'); 
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
      {selectedEntity === 'road' && (
        <Html position={[road.width / 2 + 1, 0.5, 0]} center zIndexRange={[100, 0]}>
          <div className="bg-white/95 px-3 py-2 shadow-lg border border-slate-200 rounded-lg text-xs whitespace-nowrap text-slate-700 pointer-events-none select-none">
             <div className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Road</div>
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
           setSelectedEntity(selectedEntity === 'scale' ? null : 'scale'); 
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
      
      {selectedEntity === 'scale' && (
        <Html position={[scale.width / 2 + 1, 1, 0]} center zIndexRange={[100, 0]}>
          <div className="bg-white/95 px-3 py-2 shadow-lg border border-slate-200 rounded-lg text-xs whitespace-nowrap text-slate-700 pointer-events-none select-none">
             <div className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Truck Scale</div>
             <div className="font-mono font-medium">Width: {scale.width}m</div>
             <div className="font-mono font-medium">Length: {scale.length}m</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function Wheel({ x, y, z }: { x: number, y: number, z: number }) {
  return (
     <mesh position={[x, y, z]} rotation={[0, 0, Math.PI/2]}>
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
           setSelectedEntity(selectedEntity === 'truck' ? null : 'truck'); 
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
         <mesh position={[0, chassisHeight/2 + cabHeight/2, -truck.length/2 + cabLength/2]}>
            <boxGeometry args={[width * 0.95, cabHeight, cabLength * 0.95]} />
            <meshStandardMaterial color="#38bdf8" />
         </mesh>
         {/* Windshield */}
         <mesh position={[0, chassisHeight/2 + cabHeight/2 + 0.1, -truck.length/2 + 0.05]}>
            <boxGeometry args={[width * 0.85, cabHeight * 0.5, 0.1]} />
            <meshStandardMaterial color="#cbd5e1" />
         </mesh>

         {/* Cargo Payload Box */}
         <mesh position={[0, chassisHeight/2 + cargoHeight/2, -truck.length/2 + cabLength + cargoLength/2]}>
            <boxGeometry args={[width, cargoHeight, cargoLength * 0.98]} />
            <meshStandardMaterial color="#f8fafc" />
         </mesh>
         
         {selectedEntity === 'truck' && (
           <Html position={[width / 2 + 1, chassisHeight/2 + cargoHeight/2, 0]} center zIndexRange={[100, 0]}>
             <div className="bg-white/95 px-3 py-2 shadow-lg border border-slate-200 rounded-lg text-xs whitespace-nowrap text-slate-700 pointer-events-none select-none">
                <div className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Truck Dimensions</div>
                <div className="font-mono font-medium">Width: {truck.width.toFixed(1)}m</div>
                <div className="font-mono font-medium">Height: {truck.height.toFixed(1)}m</div>
                <div className="font-mono font-medium">Length: {truck.length.toFixed(1)}m</div>
             </div>
           </Html>
         )}
      </group>

      {/* Wheels */}
      <Wheel x={xEdges} y={wheelRadius} z={-truck.length/2 + 1.2} />
      <Wheel x={-xEdges} y={wheelRadius} z={-truck.length/2 + 1.2} />

      <Wheel x={xEdges} y={wheelRadius} z={truck.length/2 - 1.5} />
      <Wheel x={-xEdges} y={wheelRadius} z={truck.length/2 - 1.5} />
      
      {truck.length > 6 && (
        <>
          <Wheel x={xEdges} y={wheelRadius} z={truck.length/2 - 2.5} />
          <Wheel x={-xEdges} y={wheelRadius} z={truck.length/2 - 2.5} />
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

function SensorPole({ id, name, z, height, beamWidth, tilt, isLeft }: { id: string, name: string, z: number, height: number, beamWidth: number, tilt: number, isLeft: boolean }) {
  const scale = useStore((s) => s.scale);
  const setDraggingSensor = useStore((s) => s.setDraggingSensor);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);
  const xOffset = scale.width / 2 + 0.3;
  const xDir = isLeft ? -1 : 1;
  const posX = xDir * xOffset;
  
  const tiltRads = (tilt * Math.PI) / 180;
  
  const targetX = posX - xDir * 10; // point towards opposite side
  const targetY = height - 10 * Math.sin(tiltRads);
  const targetZ = z;

  const headRef = useRef<THREE.Group>(null);
  
  React.useEffect(() => {
    if (headRef.current) {
        headRef.current.lookAt(targetX, targetY, targetZ);
    }
  }, [targetX, targetY, targetZ]);

  const coneRadius = 10 * Math.tan(((beamWidth / 2) * Math.PI) / 180);

  return (
    <group position={[posX, 0, z]}>
      {/* Pole */}
      <mesh
        position={[0, height / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedEntity(selectedEntity === 'sensor-' + id ? null : 'sensor-' + id);
        }}
      >
        <cylinderGeometry args={[0.08, 0.08, height]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      
      {/* Sensor Head */}
      <group position={[0, height, 0]} ref={headRef}>
        <mesh>
          <boxGeometry args={[0.2, 0.2, 0.3]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        
        {/* Beam Visualization */}
        <mesh position={[0, 0, 5]} rotation={[-Math.PI / 2, 0, 0]}>
           <coneGeometry args={[coneRadius, 10, 16]} />
           <meshBasicMaterial color="red" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {/* Beam Center Trajectory */}
        <Line points={[[0,0,0], [0, 0, 10]]} color="red" dashSize={0.5} dashed />
      </group>
      
      {selectedEntity === 'sensor-' + id && isLeft && (
        <Html position={[0, height + 0.5, 0]} center zIndexRange={[100, 0]}>
          <div className="bg-white/95 px-3 py-2 shadow-lg border border-slate-200 rounded-lg text-xs whitespace-nowrap text-slate-700 pointer-events-none select-none">
             <div className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">{name || 'Sensor'} Pair</div>
             <div className="font-mono font-medium">Height: {height.toFixed(1)}m</div>
             <div className="font-mono font-medium">Beam Angle: {beamWidth.toFixed(1)}°</div>
             <div className="font-mono font-medium">Tilt: {tilt.toFixed(1)}°</div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function Sensors() {
  const sensors = useStore((s) => s.sensors);
  const scale = useStore((s) => s.scale);
  const selectedEntity = useStore((s) => s.selectedEntity);
  const setSelectedEntity = useStore((s) => s.setSelectedEntity);
  
  return (
    <group>
      {sensors.map((pair) => (
        <group key={pair.id}>
          {/* Pair connection on floor */}
          <Line 
             points={[
                 [-scale.width / 2 - 0.3, 0.01, pair.z],
                 [scale.width / 2 + 0.3, 0.01, pair.z]
             ]}
             color="#22c55e"
             lineWidth={1}
          />
          {selectedEntity === 'road' && (
             <Html position={[0, 0.5, pair.z]} center zIndexRange={[100, 0]}>
               <div className="bg-emerald-50 px-2 py-1 shadow border border-emerald-200 rounded text-[10px] text-emerald-800 font-mono pointer-events-none select-none">
                 Sensor Pair Z: {pair.z}m
               </div>
             </Html>
          )}

          <SensorPole {...pair} isLeft={true} />
          <SensorPole {...pair} isLeft={false} />
        </group>
      ))}
    </group>
  );
}
