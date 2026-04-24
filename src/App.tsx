import React, { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import {
  Road,
  TruckScale,
  Truck,
  Sensors,
  InteractiveFloor,
} from "./components/SceneEntities";
import { Sidebar } from "./components/Sidebar";
import { StatsPanel } from "./components/StatsPanel";
import { useStore } from "./store";
import { ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import "./index.css";

export default function App() {
  const moveTruck = useStore((s) => s.moveTruck);
  const resetTruck = useStore((s) => s.resetTruck);

  const keyState = useRef({ forward: false, backward: false });
  const btnState = useRef({ forward: false, backward: false });
  const speed = useRef(0);

  // Smooth movement controls
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const forward = keyState.current.forward || btnState.current.forward;
      const backward = keyState.current.backward || btnState.current.backward;

      const MAX_SPEED = 2.0;
      const ACCEL = 1.0;
      const DECEL = 4.0;

      // Accelerate
      if (forward && !backward) {
        if (speed.current > 0) speed.current = 0;
        speed.current -= ACCEL * dt;
        if (speed.current < -MAX_SPEED) speed.current = -MAX_SPEED;
      } else if (backward && !forward) {
        if (speed.current < 0) speed.current = 0;
        speed.current += ACCEL * dt;
        if (speed.current > MAX_SPEED) speed.current = MAX_SPEED;
      } else {
        // Decelerate
        if (speed.current > 0) {
          speed.current -= DECEL * dt;
          if (speed.current < 0) speed.current = 0;
        } else if (speed.current < 0) {
          speed.current += DECEL * dt;
          if (speed.current > 0) speed.current = 0;
        }
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
      if (!e.repeat) {
        if (e.key === "ArrowUp" || e.key === "w") moveTruck(-0.1);
        if (e.key === "ArrowDown" || e.key === "s") moveTruck(0.1);
      }
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
    <div className="w-full h-screen overflow-hidden bg-[#f1f5f9] flex text-[#1e293b] font-sans">
      <Sidebar />

      <div
        className="flex-1 h-full relative overflow-hidden"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <Canvas
          camera={{ position: [20, 15, 30], fov: 45 }}
          shadows
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
          <TruckScale />
          <Truck />
          <Sensors />
          <InteractiveFloor />
        </Canvas>

        <StatsPanel />

        {/* Bottom Left Controller replacing the top left controller */}
        <div className="absolute bottom-6 left-6 bg-white/90 p-2 rounded-lg flex flex-col gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 z-20">
          <button
            onMouseDown={() => {
              btnState.current.forward = true;
              moveTruck(-0.1);
            }}
            onMouseUp={() => (btnState.current.forward = false)}
            onMouseLeave={() => (btnState.current.forward = false)}
            onTouchStart={() => {
              btnState.current.forward = true;
              moveTruck(-0.1);
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
              moveTruck(0.1);
            }}
            onMouseUp={() => (btnState.current.backward = false)}
            onMouseLeave={() => (btnState.current.backward = false)}
            onTouchStart={() => {
              btnState.current.backward = true;
              moveTruck(0.1);
            }}
            onTouchEnd={() => (btnState.current.backward = false)}
            title="Backward (S / Down)"
            className="p-2 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-600 transition-colors"
          >
            <ArrowDown size={20} />
          </button>
          <button
            onClick={resetTruck}
            title="Reset Truck"
            className="p-2 rounded bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-600 transition-colors group relative"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
