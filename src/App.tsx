import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import {
  Road,
  TruckScale,
  Truck,
  Sensors,
  InteractiveFloor,
  FacilityDecorations,
} from "./components/SceneEntities";
import { StatsPanel } from "./components/StatsPanel";
import { useStore, useSensorCalculations } from "./store";
import { ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import "./index.css";

export default function App() {
  const moveTruck = useStore((s) => s.moveTruck);
  const resetTruck = useStore((s) => s.resetTruck);
  const setTruckState = useStore((s) => s.setTruckDimensions);
  const truckProfiles = useStore((s) => s.truckProfiles);

  const keyState = useRef({ forward: false, backward: false });
  const btnState = useRef({ forward: false, backward: false });
  const speed = useRef(0);
  const timerRef = useRef({ time: 0 });

  // Update UI truck selector
  const { truck } = useStore();

  const [autoMode, setAutoMode] = useState(true);
  const autoModeRef = useRef(autoMode);
  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

  // Smooth movement controls and flow state machine
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const state = useStore.getState();
      const dist = state.truck.d;
      const flow = state.truck.flowState;
      const scaleL = state.scale.length;

      // d=0 is z=-30, d=60 is z=+30.
      const truckZ = -30 + dist;
      const truckZFront = truckZ + state.truck.length / 2; // actual truck front
      const truckZRear = truckZ - state.truck.length / 2; // actual truck rear
      const sonarHit = truckZFront >= 0 && truckZRear <= 0;

      switch (flow) {
        case "approaching":
          if (truckZFront > -14 && truckZFront < -10.5) {
            // approaching -10.5
            setTruckState({ flowState: "entry_opening" });
          }
          break;
        case "entry_opening":
          if (truckZFront > -10.5 && truckZFront < 0) {
            // front clears -10.5
            setTruckState({ flowState: "entering" });
          }
          break;
        case "entering":
          if (truckZRear > -10.5) {
            // Rear clears the entry gate completely
            timerRef.current.time += dt;
            if (timerRef.current.time > 1.0) {
              // slight delay before crossbar drops
              timerRef.current.time = 0;
              setTruckState({ flowState: "sensor_prep" });
            }
          } else {
            timerRef.current.time = 0; // reset if truck backs up or something
          }
          break;
        case "sensor_prep":
          timerRef.current.time += dt;
          if (timerRef.current.time > 1.5) {
            // wait for entry crossbar to fully drop
            timerRef.current.time = 0;
            setTruckState({ flowState: "weighing" });
          }
          break;
        case "weighing":
          // Handled by manual controls below! W/S active.
          // It switches out from weighing via StatsPanel checking delta <= tolerance for 3 secs
          break;
        case "exit_opening":
          if (truckZRear > 10.5) {
            // rear clears the exit gate (z=10.5)
            setTruckState({ flowState: "exiting" });
          }
          break;
        case "exiting":
          if (dist > 70) {
            // turning the curve
            setTruckState({ flowState: "driving" });
          }
          break;
        case "driving":
          if (dist > 180) {
            setTruckState({ d: 0, flowState: "approaching" });
          }
          break;
      }

      // Controls ALWAYS ACTIVE natively
      let forward = keyState.current.forward || btnState.current.forward;
      let backward = keyState.current.backward || btnState.current.backward;

      if (autoModeRef.current) {
        forward = false;
        backward = false;
        switch (flow) {
          case "approaching":
            forward = true;
            break;
          case "entry_opening":
          case "entering":
          case "exit_opening":
          case "exiting":
          case "driving":
            forward = true;
            break;
          case "sensor_prep":
            // Pause for gates
            break;
          case "weighing":
            if (Math.abs(truckZ) > 0.05) {
              const approachSpeed = 0.5;
              if (truckZ > 0) {
                if (speed.current > -approachSpeed) backward = true;
              } else {
                if (speed.current < approachSpeed) forward = true;
              }
            }
            break;
        }
      }

      const isOutsideGate = ["approaching", "exiting", "driving"].includes(
        flow,
      );
      const multi = isOutsideGate ? 3.0 : 1.0;

      const ACCEL = 2.0 * multi;
      const DECEL = 6.0 * multi;
      const MAX_SPEED = 4.0 * multi;

      if (forward && !backward) {
        if (speed.current < 0) speed.current = 0;
        speed.current += ACCEL * dt;
        if (speed.current > MAX_SPEED) speed.current = MAX_SPEED;
      } else if (backward && !forward) {
        if (speed.current > 0) speed.current = 0;
        speed.current -= ACCEL * dt;
        if (speed.current < -MAX_SPEED) speed.current = -MAX_SPEED;
      } else {
        if (speed.current > 0) {
          speed.current -= DECEL * dt;
          if (speed.current < 0) speed.current = 0;
        } else if (speed.current < 0) {
          speed.current += DECEL * dt;
          if (speed.current > 0) speed.current = 0;
        }
      }

      if (
        autoModeRef.current &&
        flow === "weighing" &&
        Math.abs(truckZ) <= 0.05
      ) {
        speed.current = 0;
      }

      if (Math.abs(speed.current) > 0.01) {
        moveTruck(speed.current * dt);
      } else {
        speed.current = 0;
      }

      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") keyState.current.forward = true;
      if (e.key === "ArrowDown" || e.key === "s")
        keyState.current.backward = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w")
        keyState.current.forward = false;
      if (e.key === "ArrowDown" || e.key === "s")
        keyState.current.backward = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [moveTruck]);

  return (
    <div className="w-full h-screen overflow-hidden bg-[#f1f5f9] flex text-[#1e293b] font-sans relative">
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button
          onClick={() => setAutoMode((a) => !a)}
          className={`px-3 py-2 text-sm shadow-sm rounded border ${autoMode ? "bg-blue-600 text-white border-blue-600 font-bold" : "bg-white text-slate-700 border-slate-300"}`}
        >
          {autoMode ? "🤖 Auto" : "🎮 Manual"}
        </button>
        <select
          value={truck.selectedProfileId}
          onChange={(e) => {
            const p = truckProfiles.find((x) => x.id === e.target.value);
            if (p)
              setTruckState({
                selectedProfileId: p.id,
                width: p.width,
                height: p.height,
                length: p.length,
              });
          }}
          className="bg-white border border-slate-200 rounded px-3 py-2 text-sm shadow-sm ring-blue-500 focus:border-blue-500 focus:outline-none"
        >
          {truckProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.length}m)
            </option>
          ))}
        </select>
        <button
          onClick={resetTruck}
          className="p-1 px-3 bg-white text-sm shadow-sm border border-slate-300 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded flex items-center gap-1"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div
        className="flex-1 h-full relative overflow-hidden"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <Canvas
          camera={{ position: [20, 15, 30], fov: 45 }}
          shadows={{ type: THREE.PCFShadowMap }}
          onPointerMissed={() => useStore.getState().setSelectedEntity(null)}
        >
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 20, 10]}
            intensity={1}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />

          <OrbitControls
            makeDefault
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2 - 0.05}
            enablePan={true}
            panSpeed={1}
            zoomSpeed={1.2}
          />

          <Grid
            infiniteGrid
            cellSize={1}
            sectionSize={10}
            fadeDistance={100}
            cellColor="#e2e8f0"
            sectionColor="#cbd5e1"
          />

          <Road />
          <FacilityDecorations />
          <TruckScale />
          <Truck />
          <Sensors />
          <InteractiveFloor />
        </Canvas>

        <StatsPanel />

        {/* Bottom Left Controller replaces the manual controller - only visible in weighing state */}
        <div className="absolute bottom-6 left-6 bg-white/90 p-2 rounded-lg flex flex-col gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 z-20">
          <button
            onMouseDown={() => {
              btnState.current.forward = true;
            }}
            onMouseUp={() => (btnState.current.forward = false)}
            onMouseLeave={() => (btnState.current.forward = false)}
            onTouchStart={() => {
              btnState.current.forward = true;
            }}
            onTouchEnd={() => (btnState.current.forward = false)}
            title="Forward (W / Up)"
            className="p-2 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-600 transition-colors"
          >
            <ArrowUp size={20} />
          </button>
          <button
            onMouseDown={() => {
              btnState.current.backward = true;
            }}
            onMouseUp={() => (btnState.current.backward = false)}
            onMouseLeave={() => (btnState.current.backward = false)}
            onTouchStart={() => {
              btnState.current.backward = true;
            }}
            onTouchEnd={() => (btnState.current.backward = false)}
            title="Backward (S / Down)"
            className="p-2 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-600 transition-colors"
          >
            <ArrowDown size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
