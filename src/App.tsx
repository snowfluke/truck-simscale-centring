import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import {
  Road,
  TruckScale,
  Trucks,
  Sensors,
  InteractiveFloor,
  FacilityDecorations,
  Explosions,
  DeadTrucks,
} from "./components/SceneEntities";
import { StatsPanel } from "./components/StatsPanel";
import {
  useStore,
  useSensorCalculations,
  TOTAL_L,
  TRACK_STRAIGHT_L,
  getTruckTransform,
} from "./store";
import { ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import "./index.css";

function EasterButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [disabled, setDisabled] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      const state = useStore.getState();
      const av = state.trucks.some((t) => t.hasBox && !t.logoUrl);
      setDisabled(!av);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const state = useStore.getState();
      const boxTrucks = state.trucks.filter((t) => t.hasBox && !t.logoUrl);
      if (boxTrucks.length > 0) {
        const randomTruck =
          boxTrucks[Math.floor(Math.random() * boxTrucks.length)];
        const newTrucks = [...state.trucks];
        const idx = newTrucks.findIndex((t) => t.id === randomTruck.id);
        if (idx !== -1) {
          newTrucks[idx] = { ...newTrucks[idx], logoUrl: url };
          state.setTrucks(newTrucks);
        }
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        ref={inputRef}
        style={{ display: "none" }}
        onChange={handleUpload}
      />
      <button
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "p-1 px-3 text-sm shadow-sm border rounded flex items-center gap-1",
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200"
            : "bg-white text-emerald-600 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300",
        )}
      >
        🐇 Easter
      </button>
    </>
  );
}

export default function App() {
  const moveTruck = useStore((s) => s.moveTruck);
  const resetTruck = useStore((s) => s.resetTruck);
  const updateActiveTruck = useStore((s) => s.updateActiveTruck);
  const truckProfiles = useStore((s) => s.truckProfiles);
  const sensorStrategy = useStore((s) => s.sensorStrategy);
  const toggleSensorStrategy = useStore((s) => s.toggleSensorStrategy);

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

  useEffect(() => {
    autoModeRef.current = autoMode;
    const state = useStore.getState();
    const profiles = state.truckProfiles;

    if (autoMode) {
      // Avoid d between 40 and 85 to prevent spawning on or too close to weight scales
      const availableL = TOTAL_L - 45;
      const SPACING = availableL / Math.max(1, profiles.length);
      let mixedProfiles: any[] = [];
      let boxP = profiles
        .filter((p) => p.hasBox !== false)
        .sort(() => Math.random() - 0.5);
      let noboxP = profiles
        .filter((p) => p.hasBox === false)
        .sort(() => Math.random() - 0.5);

      const total = profiles.length;
      for (let i = 0; i < total; i++) {
        if (i % 2 === 0 && boxP.length > 0) mixedProfiles.push(boxP.pop());
        else if (noboxP.length > 0) mixedProfiles.push(noboxP.pop());
        else if (boxP.length > 0) mixedProfiles.push(boxP.pop());
      }

      const newTrucks = mixedProfiles.map((p, i) => {
        let rawPos = (35 + availableL - i * SPACING) % availableL;
        let d = rawPos;
        if (d > 40) d += 45; // Skip the [40, 85] zone

        return {
          id: p.id + "-" + i,
          d: d,
          speed: 0,
          timer: 0,
          width: p.width,
          height: p.height,
          length: p.length,
          hasBox: p.hasBox !== false,
          selectedProfileId: p.id,
          flowState: i === 0 ? "approaching" : "driving",
          truthTolerance: 0.05,
        };
      });
      state.setTrucks(newTrucks);
    } else {
      const p = profiles[0] || state.truck;
      state.setTrucks([
        {
          id: "manual",
          d: 5,
          speed: 0,
          timer: 0,
          width: p.width,
          height: p.height,
          length: p.length,
          hasBox: (p as any).hasBox !== false,
          selectedProfileId: (p as any).id || state.truck.selectedProfileId,
          flowState: "approaching",
          truthTolerance: 0.05,
        } as any,
      ]);
    }
  }, [autoMode]);

  // Smooth movement controls and flow state machine
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const state = useStore.getState();

      if (!state.trucks || state.trucks.length === 0) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      state.updateExplosions(dt);
      state.updateDeadTrucks(dt);

      const mappedTrucks = state.trucks.map((t, i) => {
        let tState = { ...t };
        const trackZ = -TRACK_STRAIGHT_L / 2 + tState.d;
        const truckZFront = trackZ + tState.length / 2;
        const truckZRear = trackZ - tState.length / 2;

        if (
          tState.logoUrl &&
          tState.flowState === "weighing" &&
          Math.abs(trackZ) < 5
        ) {
          const tform = getTruckTransform(tState.d);
          state.addExplosion(
            tform.position.x,
            tform.position.y,
            tform.position.z,
          );

          const vx = (Math.random() - 0.5) * 20;
          const vy = 100;
          const vz = (Math.random() - 0.5) * 20;

          state.addDeadTruck(
            tState,
            [tform.position.x, tform.position.y, tform.position.z],
            [tform.rotation.x, tform.rotation.y, tform.rotation.z],
            [vx, vy, vz],
          );
          return null;
        }

        const scaleOccupied = state.trucks.some((otherT, tIdx) => {
          if (tIdx === i) return false;
          return ![
            "approaching",
            "driving",
            "facility_exit_approaching",
            "facility_exit_holding",
            "facility_exit_leaving",
          ].includes(otherT.flowState);
        });

        switch (tState.flowState as any) {
          case "approaching":
            if (!scaleOccupied && truckZFront >= -16.0 && truckZFront < -10.5) {
              tState.flowState = "entry_opening" as any;
              tState.timer = 0;
            }
            break;
          case "entry_opening":
            tState.timer += dt;
            if (tState.timer > 1.5 || truckZFront >= -10.6) {
              tState.flowState = "entering" as any;
            }
            break;
          case "entering":
            if (truckZRear > -10.5) {
              tState.timer += dt;
              if (tState.timer > 1.0) {
                tState.timer = 0;
                tState.flowState = "sensor_prep" as any;
              }
            } else {
              tState.timer = 0;
            }
            break;
          case "sensor_prep":
            tState.timer += dt;
            if (tState.timer > 1.5) {
              tState.timer = 0;
              tState.flowState = "weighing" as any;
            }
            break;
          case "weighing":
            // It switches out from weighing via StatsPanel checking delta <= tolerance
            break;
          case "weighing_complete":
            tState.timer += dt;
            if (tState.timer > 1.5) {
              // Delay before gate opens
              tState.timer = 0;
              tState.flowState = "exit_opening" as any;
            }
            break;
          case "exit_opening":
            tState.timer += dt;
            if (tState.timer > 1.5) {
              // Gate opened
              tState.timer = 0;
              tState.flowState = "exiting" as any;
            }
            break;
          case "exiting":
            if (truckZRear > 10.5) tState.flowState = "driving" as any;
            break;
          case "driving":
            if (tState.d > TOTAL_L - 10) {
              tState.flowState = "approaching" as any;
            }
            break;
        }

        let forward = false;
        let backward = false;

        if (!autoModeRef.current && i === 0) {
          forward = keyState.current.forward || btnState.current.forward;
          backward = keyState.current.backward || btnState.current.backward;
        } else {
          switch (tState.flowState) {
            case "approaching":
            case "entering":
            case "sensor_prep":
            case "exiting":
            case "driving":
              forward = true;
              break;
            case "entry_opening":
            case "exit_opening":
              // Gate is opening
              if (tState.timer > 1.0) {
                forward = true;
              } else {
                forward = false;
              }
              break;
            case "weighing":
            case "weighing_complete":
              if (Math.abs(trackZ) > 0.05) {
                const approachSpeed = 0.5;
                if (trackZ > 0) {
                  if (tState.speed > -approachSpeed) backward = true;
                } else {
                  if (tState.speed < approachSpeed) forward = true;
                }
              }
              break;
          }

          if (state.trucks.length > 1) {
            const queueD = TRACK_STRAIGHT_L / 2 - 12.5 - tState.length / 2;
            const distToQueue = queueD - tState.d;
            const aheadT =
              i === 0
                ? state.trucks[state.trucks.length - 1]
                : state.trucks[i - 1];
            let diff = aheadT.d - tState.d;
            if (diff < 0) diff += TOTAL_L;

            const gap = diff - (aheadT.length / 2 + tState.length / 2);

            let targetSpeed = 10.0;
            let shouldLimit = false;

            if (scaleOccupied && distToQueue >= -0.5 && distToQueue < 30) {
              targetSpeed = Math.min(
                targetSpeed,
                Math.max(0, distToQueue * 0.4),
              );
              shouldLimit = true;
            }

            if (gap < 8.0) {
              targetSpeed = Math.min(
                targetSpeed,
                Math.max(0, (gap - 1.0) * 0.5),
              );
              shouldLimit = true;
            }

            if (shouldLimit) {
              if (targetSpeed <= 0.1) {
                forward = false;
                backward = false;
                tState.speed *= 0.5;
                if (gap <= 0.5 || (scaleOccupied && distToQueue <= 0.1))
                  tState.speed = 0;
              } else {
                if (tState.speed > targetSpeed) {
                  forward = false;
                  backward = tState.speed > targetSpeed + 1;
                } else {
                  forward = true;
                  backward = false;
                }
              }
            }
          }
        }

        const isOutsideGate = ["approaching", "exiting", "driving"].includes(
          tState.flowState,
        );
        const multi = isOutsideGate ? 2.5 : 1.0;
        const ACCEL = 1.0 * multi;
        const DECEL = 2.0 * multi; // Reduced for smoother braking
        let MAX_SPEED = isOutsideGate ? 10.0 : 2.0;

        const isCorner =
          (tState.d > 55 && tState.d < 96) ||
          (tState.d > 146 && tState.d < 182.83) ||
          tState.d < 5;
        if (isCorner && isOutsideGate) {
          MAX_SPEED = Math.min(MAX_SPEED, 4.0);
        }

        if (tState.speed > MAX_SPEED && forward && !backward) {
          tState.speed -= DECEL * dt;
          if (tState.speed < MAX_SPEED) tState.speed = MAX_SPEED;
        } else if (forward && !backward) {
          if (tState.speed < 0) tState.speed = 0;
          tState.speed += ACCEL * dt;
          if (tState.speed > MAX_SPEED) tState.speed = MAX_SPEED;
        } else if (backward && !forward) {
          if (tState.speed > 0) tState.speed = 0;
          tState.speed -= ACCEL * dt;
          if (tState.speed < -MAX_SPEED) tState.speed = -MAX_SPEED;
        } else {
          if (tState.speed > 0) {
            tState.speed -= DECEL * dt;
            if (tState.speed < 0) tState.speed = 0;
          } else if (tState.speed < 0) {
            tState.speed += DECEL * dt;
            if (tState.speed > 0) tState.speed = 0;
          }
        }

        if (
          autoModeRef.current &&
          (tState.flowState === "weighing" ||
            tState.flowState === "weighing_complete") &&
          Math.abs(trackZ) <= 0.05
        ) {
          tState.speed = 0;
        }

        if (Math.abs(tState.speed) > 0.01) {
          tState.d += tState.speed * dt;
          tState.d = ((tState.d % TOTAL_L) + TOTAL_L) % TOTAL_L;
        } else {
          tState.speed = 0;
        }

        return tState;
      });

      state.setTrucks(mappedTrucks.filter((t) => t !== null) as any);

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
        {!autoMode && (
          <select
            value={truck.selectedProfileId}
            onChange={(e) => {
              const p = truckProfiles.find((x) => x.id === e.target.value);
              if (p)
                updateActiveTruck({
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
        )}
        <button
          onClick={resetTruck}
          className="p-1 px-3 bg-white text-sm shadow-sm border border-slate-300 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded flex items-center gap-1"
        >
          <RotateCcw size={14} /> Reset
        </button>
        <button
          onClick={toggleSensorStrategy}
          className="p-1 px-3 bg-white text-sm shadow-sm border border-slate-300 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded flex items-center gap-1"
        >
          {sensorStrategy === "3d_lidar" ? "Use 2D Sensors" : "Use 3D LiDAR"}
        </button>
        <EasterButton />
      </div>

      <div
        className="flex-1 h-full relative overflow-hidden"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <Canvas
          camera={{ position: [25, 20, 35], fov: 45 }}
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
          <Trucks />
          <DeadTrucks />
          <Explosions />
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
