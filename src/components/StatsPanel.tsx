import React, { useState } from "react";
import { useSensorCalculations, useStore } from "../store";
import {
  Calculator,
  X,
  HelpCircle,
  Target,
  MapPin,
  Activity,
} from "lucide-react";

export function StatsPanel() {
  const { readings, sensorCenter, truthCenter, calcDetails } =
    useSensorCalculations();
  const isSidebarOpen = useStore((s) => s.isSidebarOpen);
  const truck = useStore((s) => s.truck);
  const scale = useStore((s) => s.scale);
  const sensors = useStore((s) => s.sensors);

  const [showCalcModal, setShowCalcModal] = useState(false);
  const [infoModal, setInfoModal] = useState<"truth" | "delta" | "goal" | null>(
    null,
  );

  const activeLeftCount = readings.filter(
    (r) => r.hit && r.placement === "left",
  ).length;
  const activeRightCount = readings.filter(
    (r) => r.hit && r.placement === "right",
  ).length;
  const topHits = readings.filter((r) => r.hit && (r.z ?? 0) < 0);
  const bottomHits = readings.filter((r) => r.hit && (r.z ?? 0) >= 0);
  const totalHits = readings.filter((r) => r.hit).length;

  let instructorStatus = "unseen"; // 'unseen' | 'guiding' | 'centered'
  let instruction = "Driver should slowly drive onto the scale.";
  let cmd = "AWAITING VEHICLE ENTRY";

  if (totalHits === 0) {
    instructorStatus = "unseen";
    cmd = "AWAITING VEHICLE ENTRY";
    instruction = "Driver should slowly drive onto the scale.";
  } else if (topHits.length === 0) {
    instructorStatus = "guiding";
    const nStr =
      sensorCenter !== null ? Math.abs(sensorCenter).toFixed(2) : "0.00";
    instruction = "Move forward until hitting the top half sensors.";
    cmd = `MOVE FORWARD ${nStr}m`;
  } else {
    const distanceStr =
      sensorCenter !== null ? Math.abs(sensorCenter).toFixed(2) : "0.00";

    if (sensorCenter !== null && Math.abs(sensorCenter) <= 0.2) {
      instructorStatus = "centered";
      instruction = "Balanced on both sides";
      cmd = "TRUCK FULLY IN, STOP!";
    } else if (sensorCenter !== null && sensorCenter > 0) {
      instructorStatus = "guiding";
      instruction = `Top < Bottom (Δ ${distanceStr}m)`;
      cmd = `MOVE FORWARD ${distanceStr}m`;
    } else {
      instructorStatus = "guiding";
      instruction = `Top > Bottom (Δ ${distanceStr}m)`;
      cmd = `MOVE BACKWARD ${distanceStr}m`;
    }
  }

  let cmdBgClass = "bg-slate-800/95 border-l-4 border-slate-500";
  let cmdTitleClass = "text-slate-300";
  let cmdValueClass = "text-white";
  let cmdDetailsClass = "text-slate-400";

  if (instructorStatus === "guiding") {
    cmdBgClass = "bg-yellow-400/95 border-l-4 border-yellow-600";
    cmdTitleClass = "text-yellow-800 font-extrabold";
    cmdValueClass = "text-slate-900";
    cmdDetailsClass = "text-yellow-900";
  } else if (instructorStatus === "centered") {
    cmdBgClass = "bg-emerald-500/95 border-l-4 border-emerald-700";
    cmdTitleClass = "text-emerald-200";
    cmdValueClass = "text-white";
    cmdDetailsClass = "text-emerald-100";
  }

  // Override for extreme unbalance
  if (totalHits > 0 && activeLeftCount > 0 && activeRightCount === 0) {
    cmd = "STEER RIGHT";
    cmdBgClass = "bg-amber-500/90 border-l-4 border-amber-700";
    cmdTitleClass = "text-amber-200";
    cmdValueClass = "text-white";
    cmdDetailsClass = "text-amber-100";
    instruction = "Getting too close to LEFT sensors.";
  } else if (totalHits > 0 && activeRightCount > 0 && activeLeftCount === 0) {
    cmd = "STEER LEFT";
    cmdBgClass = "bg-amber-500/90 border-l-4 border-amber-700";
    cmdTitleClass = "text-amber-200";
    cmdValueClass = "text-white";
    cmdDetailsClass = "text-amber-100";
    instruction = "Getting too close to RIGHT sensors.";
  }

  let engineerStatus = "off-center";
  let engineerCmd = "TRUCK OFF-CENTER";
  let engineerInstruction = `Truth Center: ${truthCenter.toFixed(2)}m`;

  const tolerance = truck.truthTolerance ?? 0.05;
  if (Math.abs(truthCenter) <= tolerance) {
    engineerStatus = "centered";
    engineerCmd = "TRUCK TRULY CENTERED";
    engineerInstruction = `Truth Center: ${truthCenter.toFixed(2)}m (Tolerance \u2264 ${tolerance.toFixed(2)}m)`;
  }

  let engineerBgClass = "bg-red-500/95 border-l-4 border-red-700";
  let engineerTitleClass = "text-red-200";
  let engineerValueClass = "text-white";
  let engineerDetailsClass = "text-red-100";

  if (engineerStatus === "centered") {
    engineerBgClass = "bg-emerald-500/95 border-l-4 border-emerald-700";
    engineerTitleClass = "text-emerald-200";
    engineerValueClass = "text-white";
    engineerDetailsClass = "text-emerald-100";
  }

  const delta =
    sensorCenter !== null ? Math.abs(truthCenter - sensorCenter) : 0;

  return (
    <>
      {/* Simulation Goal Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center gap-2">
        <button
          onClick={() => setInfoModal("goal")}
          className="bg-indigo-50/95 border border-indigo-200 text-indigo-700 px-5 py-2 rounded-full shadow-lg text-[11px] font-bold flex items-center gap-2 hover:bg-indigo-100 hover:scale-105 transition-all pointer-events-auto"
        >
          <Target size={14} /> SIMULATION GOAL
        </button>
        <div className="text-[10px] font-medium bg-white/80 px-3 py-1.5 rounded-full text-slate-500 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-slate-200 transition-opacity opacity-75 hover:opacity-100 backdrop-blur-sm">
          Left Click to Rotate • Right Click to Pan • Scroll to Zoom
        </div>
      </div>

      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <div
          className={`w-[240px] p-3 rounded shadow-lg transition-colors ${cmdBgClass}`}
        >
          <div
            className={`text-[10px] uppercase tracking-wider mb-1 ${cmdTitleClass}`}
          >
            DRIVER INSTRUCTION
          </div>
          <div className={`text-sm font-bold ${cmdValueClass}`}>{cmd}</div>
          <div className={`text-[11px] mt-2 ${cmdDetailsClass}`}>
            {instruction}
          </div>
        </div>

        <div
          className={`w-[240px] p-3 rounded shadow-lg transition-colors ${engineerBgClass}`}
        >
          <div
            className={`text-[10px] uppercase tracking-wider mb-1 ${engineerTitleClass}`}
          >
            ENGINEER GROUND TRUTH
          </div>
          <div className={`text-sm font-bold ${engineerValueClass}`}>
            {engineerCmd}
          </div>
          <div className={`text-[11px] mt-2 ${engineerDetailsClass}`}>
            {engineerInstruction}
          </div>
        </div>
      </div>

      <div className="absolute top-20 left-4 bg-white/90 border border-slate-200 p-2 rounded-md font-mono text-[11px] leading-relaxed z-10 pointer-events-none min-w-[140px]">
        <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider font-sans">
          SENSOR RAYS
        </div>
        {readings.length === 0 && (
          <div className="text-slate-400">NO SENSORS</div>
        )}
        {readings.map((r, i) => (
          <div key={i} className="flex justify-between gap-4 py-[2px]">
            <span className="text-slate-600">Z:{r.z}m</span>
            {r.hit ? (
              <span className="text-emerald-600 font-semibold">
                {r.distance.toFixed(2)}m
              </span>
            ) : (
              <span className="text-slate-400">MISS</span>
            )}
          </div>
        ))}
      </div>

      <div className="absolute bottom-6 right-6 flex gap-4 transition-all duration-300">
        <div
          onClick={() => setInfoModal("truth")}
          className="bg-white/90 border border-slate-200 p-3 rounded-lg shadow-sm min-w-[120px] pointer-events-auto cursor-pointer hover:bg-blue-50 transition-colors relative group"
        >
          <button className="absolute top-2 right-2 text-slate-300 group-hover:text-blue-500 transition-colors">
            <HelpCircle size={14} />
          </button>
          <div className="text-[10px] uppercase text-slate-500 mb-1 tracking-wide font-semibold pr-4">
            Truth Center
          </div>
          <div className="text-lg font-bold font-mono text-blue-600">
            {truthCenter.toFixed(3)} m
          </div>
        </div>
        <div className="bg-white/90 border border-slate-200 p-3 rounded-lg shadow-sm min-w-[140px] pointer-events-auto flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase text-slate-500 mb-1 tracking-wide font-semibold">
              Sensor Center (Est.)
            </div>
            <div className="text-lg font-bold font-mono text-slate-800">
              {sensorCenter !== null ? sensorCenter.toFixed(3) : "N/A"} m
            </div>
            <div className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">
              Formula: Bounding Box Midpoint
            </div>
          </div>
          <button
            onClick={() => setShowCalcModal(true)}
            className="mt-2 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 py-1 px-2 rounded w-full flex items-center justify-center gap-1 transition-colors"
          >
            <Calculator size={12} /> Display Calculation
          </button>
        </div>
        <div
          onClick={() => setInfoModal("delta")}
          className="bg-white/90 border border-slate-200 p-3 rounded-lg shadow-sm min-w-[120px] pointer-events-auto cursor-pointer hover:bg-red-50 transition-colors relative group"
        >
          <button className="absolute top-2 right-2 text-slate-300 group-hover:text-red-500 transition-colors">
            <HelpCircle size={14} />
          </button>
          <div className="text-[10px] uppercase text-slate-500 mb-1 tracking-wide font-semibold pr-4">
            Delta / Error
          </div>
          <div className="text-lg font-bold font-mono text-red-500">
            {delta.toFixed(3)} m
          </div>
        </div>
      </div>

      {/* Target/Info Modals */}
      {infoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[450px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                {infoModal === "truth" && (
                  <>
                    <MapPin size={18} className="text-blue-500" /> Truth Center
                    (Ground Truth)
                  </>
                )}
                {infoModal === "delta" && (
                  <>
                    <Activity size={18} className="text-red-500" /> Delta /
                    Error
                  </>
                )}
                {infoModal === "goal" && (
                  <>
                    <Target size={18} className="text-indigo-500" /> Simulation
                    Objective
                  </>
                )}
              </h3>
              <button
                onClick={() => setInfoModal(null)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 text-slate-600 text-[13px] leading-relaxed space-y-4">
              {infoModal === "truth" && (
                <>
                  <p>
                    The <strong>Truth Center</strong> is the absolute, exact
                    physical position of the truck's midpoint on the Z-axis
                    within the 3D physics engine relative to the{" "}
                    <strong>Scale's Center Point.</strong> .
                  </p>
                  <p>
                    In the real world, you can never know this value
                    perfectly—but this is a simulation. It serves as our "Ground
                    Truth" metric to mathematically evaluate exactly how
                    accurate your configured sensor arrays are in real-time.
                  </p>
                </>
              )}
              {infoModal === "delta" && (
                <>
                  <p>
                    The <strong>Delta / Error</strong> measures the absolute
                    difference between where the truck <em>actually</em> is
                    (Truth Center) and where the sensors <em>think</em> it is
                    (Sensor Center).
                  </p>
                  <div className="bg-slate-100 p-3 rounded font-mono text-xs text-center border border-slate-200 text-slate-700 font-bold">
                    | Truth Center - Sensor Center |
                  </div>
                  <p>
                    A high error implies your sensor installation has blind
                    spots or inadequate footprints tracking the body. This
                    ultimately causes the driver to park dangerously off-center
                    on the scale plates.
                  </p>
                </>
              )}
              {infoModal === "goal" && (
                <>
                  <p>
                    The ultimate goal of this simulation is to engineer the{" "}
                    <strong>Perfect Truck Scale Sensor Array</strong>.
                  </p>
                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-indigo-800 font-medium">
                    Your objective is to tweak the scale bounds, add/move sensor
                    poles, and configure beam angles until your{" "}
                    <strong>Delta / Error is consistently 0.00m</strong>.
                  </div>
                  <p>
                    A triumphant configuration will reliably trigger the{" "}
                    <span className="font-bold tracking-wide text-emerald-600">
                      "Perfectly Centered"
                    </span>{" "}
                    system command for <em>every</em> single truck profile—from
                    the shortest 4-wheel box trucks to the most massive 20-meter
                    articulated trailers!
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showCalcModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex flex-col">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Calculator size={16} className="text-blue-500" /> Sensor
                  Logic Derivation
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Truck Dimensions: W {truck.width}m x H {truck.height}m x L{" "}
                  {truck.length}m, Truth Z: {truck.z.toFixed(3)}m
                </span>
              </div>
              <button
                onClick={() => setShowCalcModal(false)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto bg-slate-50/50 space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  1. Truck Coordinate Boundaries
                </h4>
                <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                  const truckZMin = truck.z - (length / 2) ={" "}
                  {calcDetails.truckZMin.toFixed(3)}
                  {"\n"}
                  const truckZMax = truck.z + (length / 2) ={" "}
                  {calcDetails.truckZMax.toFixed(3)}
                  {"\n"}
                  Physical Bounds = [{calcDetails.truckZMin.toFixed(3)},{" "}
                  {calcDetails.truckZMax.toFixed(3)}]
                </pre>
              </div>

              {calcDetails.debugSensors.map((s: any, idx: number) => (
                <div
                  key={idx}
                  className={`bg-white p-4 rounded-lg shadow-sm border ${s.hit ? "border-blue-200 ring-1 ring-blue-50" : "border-slate-200"} opacity-${s.hit ? "100" : "80"}`}
                >
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex justify-between">
                    <span>
                      2.{idx + 1}. Ray Intersector: {s.name} (Z: {s.z}m)
                    </span>
                    <span
                      className={s.hit ? "text-blue-600" : "text-slate-400"}
                    >
                      {s.hit ? "INTERSECTING" : "MISS"}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold mb-1">
                        Inputs
                      </div>
                      <ul className="font-mono text-[10px] text-slate-600 space-y-1">
                        <li>Height: {s.height}m</li>
                        <li>Beam Angle: {s.beamWidth}&deg;</li>
                        <li>TiltV: {s.tiltVertical}&deg;</li>
                        <li>TiltH: {s.tiltHorizontal}&deg;</li>
                        <li>Max Range: {s.maxRange}m</li>
                        <li>Distance to Truck (dx): {s.dx.toFixed(3)}m</li>
                      </ul>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold mb-1">
                        Volumetric Tracing Phase
                      </div>
                      <ul className="font-mono text-[10px] text-slate-600 space-y-1">
                        <li>Ray-AABB Intersection (t) = {s.t.toFixed(3)}m</li>
                        <li>Impact Height (hitY) = {s.hitY.toFixed(3)}m</li>
                        <li
                          className={
                            s.hitY >= 0 && s.hitY <= truck.height
                              ? "text-emerald-600"
                              : "text-red-500"
                          }
                        >
                          ⮑{" "}
                          {s.hitY >= 0 && s.hitY <= truck.height
                            ? `Within Body Bounds (0 <= ${s.hitY.toFixed(2)} <= ${truck.height})`
                            : "Missed Vertical Body Envelope!"}
                        </li>
                        <li>
                          Z-Spread (r) = t * tan(beam / 2) ={" "}
                          {s.spreadRadius.toFixed(3)}m
                        </li>
                        <li>
                          Footprint (sZ) = [{s.sZMin.toFixed(3)},{" "}
                          {s.sZMax.toFixed(3)}]
                        </li>
                      </ul>
                    </div>
                  </div>
                  {s.hit && (
                    <div className="mt-3 pt-3 border-t border-slate-100 bg-blue-50/50 -mx-4 -mb-4 p-4 rounded-b-lg">
                      <div className="text-[10px] text-blue-500 font-bold mb-1 uppercase tracking-wide">
                        Footprint overlap calculation
                      </div>
                      <ul className="font-mono text-[11px] text-slate-700 space-y-1">
                        <li>
                          overlapMin = Math.max(truckZMin, sZMin) ={" "}
                          {s.overlapMin.toFixed(3)}
                        </li>
                        <li>
                          overlapMax = Math.min(truckZMax, sZMax) ={" "}
                          {s.overlapMax.toFixed(3)}
                        </li>
                        <li className="font-bold text-blue-700 mt-2">
                          Active Envelope Component: [{s.overlapMin.toFixed(3)},{" "}
                          {s.overlapMax.toFixed(3)}]
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              <div className="bg-slate-800 text-white p-4 rounded-lg shadow-sm border border-slate-700">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  3. Final Center Derivation
                </h4>
                {sensorCenter !== null ? (
                  <pre className="font-mono text-[12px] whitespace-pre-wrap leading-relaxed space-y-2">
                    {calcDetails.farthestTop && calcDetails.farthestBottom ? (
                      <>
                        <div>
                          farthestBottom = max(abs(z) of hit bottom sensors) ={" "}
                          {calcDetails.farthestBottom.toFixed(3)}
                        </div>
                        <div>
                          farthestTop = max(abs(z) of hit top sensors) ={" "}
                          {calcDetails.farthestTop.toFixed(3)}
                        </div>
                        <div className="border-t border-slate-600 pt-2 text-emerald-400 font-bold text-sm">
                          sensorCenter = (farthestBottom - farthestTop) / 2 = (
                          {calcDetails.farthestBottom.toFixed(3)} -{" "}
                          {calcDetails.farthestTop.toFixed(3)}) / 2 ={" "}
                          {sensorCenter.toFixed(3)}m
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          overallZMin = min(all hit mins) ={" "}
                          {calcDetails.overallZMin.toFixed(3)}
                        </div>
                        <div>
                          overallZMax = max(all hit maxs) ={" "}
                          {calcDetails.overallZMax.toFixed(3)}
                        </div>
                        <div className="border-t border-slate-600 pt-2 text-emerald-400 font-bold text-sm">
                          sensorCenter = (overallZMin + overallZMax) / 2 = (
                          {calcDetails.overallZMin.toFixed(3)} +{" "}
                          {calcDetails.overallZMax.toFixed(3)}) / 2 ={" "}
                          {sensorCenter.toFixed(3)}m
                        </div>
                      </>
                    )}
                  </pre>
                ) : (
                  <div className="font-mono text-sm text-amber-400">
                    Not enough data to triangulate bounding box.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
