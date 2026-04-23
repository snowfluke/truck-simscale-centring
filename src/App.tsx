import React, { useEffect } from "react";
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
import { ArrowUp, ArrowDown, Square } from "lucide-react";
import { clsx } from "clsx";
import "./index.css";

export default function App() {
  const moveTruck = useStore((s) => s.moveTruck);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Forward is -Z, Backward is +Z
      if (e.key === "ArrowUp" || e.key === "w") moveTruck(-0.1);
      if (e.key === "ArrowDown" || e.key === "s") moveTruck(0.1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
            onClick={() => moveTruck(-0.1)}
            title="Forward (W / Up)"
            className="p-2 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-600 transition-colors"
          >
            <ArrowUp size={20} />
          </button>
          <button
            onClick={() => moveTruck(0.1)}
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
