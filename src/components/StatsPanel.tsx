import React, { useState, useEffect } from "react";
import { useSensorCalculations, useStore } from "../store";
import {
  Calculator,
  X,
  HelpCircle,
  MapPin,
  Activity,
  CheckCircle2,
} from "lucide-react";

export function StatsPanel() {
  const { readings, sensorCenter, truthCenter, calcDetails } =
    useSensorCalculations();
  const truck = useStore((s) => s.truck);
  const scale = useStore((s) => s.scale);
  const setTruckDimensions = useStore((s) => s.setTruckDimensions);

  const [showCalcModal, setShowCalcModal] = useState(false);
  const [infoModal, setInfoModal] = useState<"truth" | "delta" | null>(null);

  const totalHits = readings.filter((r) => r.hit).length;
  const delta =
    sensorCenter !== null ? Math.abs(truthCenter - sensorCenter) : 0;
  const tolerance = truck.truthTolerance ?? 0.05;

  let trafficLight = "off";
  let instruction = "";
  let cmd = "";

  const flow = truck.flowState;

  if (flow === "approaching") {
    trafficLight = "off";
  } else if (flow === "entry_opening") {
    trafficLight = "off";
  } else if (flow === "entering") {
    trafficLight = "off";
  } else if (flow === "sensor_prep") {
    trafficLight = "off";
  } else if (flow === "weighing") {
    if (sensorCenter !== null && Math.abs(sensorCenter) <= tolerance) {
      trafficLight = "green";
      cmd = "Berhenti!";
      instruction =
        "Posisi sudah pas. Silakan tunggu proses penimbangan selesai.";
    } else {
      // AI DONT CHANGE THIS!!
      trafficLight = "red";
      instruction = "Sesuaikan Posisi";
      if (sensorCenter === null) {
        instruction =
          "Sensor tidak mendeteksi truk. Silakan maju ke dalam jangkauan.";
      } else if (sensorCenter > tolerance) {
        // AI DONT CHANGE THIS!!
        cmd = `Mundur ${Math.abs(sensorCenter).toFixed(2)}m`;
        // AI DONT CHANGE THIS!!
      } else {
        cmd = `Maju ${Math.abs(sensorCenter).toFixed(2)}m`;
      }
    }
  } else if (flow === "exit_opening") {
    trafficLight = "off";
  } else if (flow === "exiting") {
    trafficLight = "off";
  } else if (flow === "driving") {
    trafficLight = "off";
  }

  // Handle the 3 second wait timer during 'weighing' state
  useEffect(() => {
    let timer: number;
    if (
      flow === "weighing" &&
      sensorCenter !== null &&
      Math.abs(sensorCenter) <= tolerance
    ) {
      timer = window.setTimeout(() => {
        setTruckDimensions({ flowState: "exit_opening" });
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [flow, sensorCenter, tolerance, setTruckDimensions]);

  let cmdBgClass = "bg-slate-800/95 border-l-4 border-slate-500 text-slate-300";
  let cmdTitleClass = "text-slate-400";
  let cmdValueClass = "text-slate-300";
  let cmdDetailsClass = "text-slate-400";

  if (trafficLight === "green") {
    cmdBgClass = "bg-emerald-500/95 border-l-4 border-emerald-700";
    cmdTitleClass = "text-emerald-200 font-extrabold";
    cmdValueClass = "text-white";
    cmdDetailsClass = "text-emerald-100";
  } else if (trafficLight === "red") {
    cmdBgClass = "bg-red-500/95 border-l-4 border-red-700";
    cmdTitleClass = "text-red-200";
    cmdValueClass = "text-white";
    cmdDetailsClass = "text-red-100";
  } else if (trafficLight === "yellow") {
    cmdBgClass = "bg-amber-500/95 border-l-4 border-amber-700";
    cmdTitleClass = "text-amber-200";
    cmdValueClass = "text-white";
    cmdDetailsClass = "text-amber-100";
  }

  let engineerStatus = "off-center";
  let engineerCmd = "TRUCK OFF-CENTER";
  let engineerInstruction = `Truth Center: ${truthCenter.toFixed(2)}m`;

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

  return (
    <>
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {trafficLight !== "off" && (
          <div
            className={`w-[240px] p-3 rounded shadow-lg transition-colors ${cmdBgClass}`}
          >
            <div
              className={`text-[10px] uppercase tracking-wider mb-1 ${cmdTitleClass}`}
            >
              PETUNJUK PENGEMUDI
            </div>
            <div className={`text-[16px] font-bold ${cmdValueClass}`}>
              {cmd}
            </div>
            <div className={`text-[14px] mt-2 ${cmdDetailsClass}`}>
              {instruction}
            </div>
          </div>
        )}
      </div>

      <div className="absolute top-20 left-4 bg-white/90 border border-slate-200 p-2 rounded-md font-mono text-[11px] leading-relaxed z-10 pointer-events-none min-w-[140px]">
        <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider font-sans">
          SENSOR RAYS
        </div>
        {readings.length === 0 && (
          <div className="text-slate-400">NO SENSORS</div>
        )}
        {readings.map((r, i) => (
          <div
            key={i}
            className="flex justify-between gap-4 py-[2px] border-b border-slate-100 last:border-0 items-center"
          >
            <div className="flex flex-col">
              <span className="text-slate-800 font-bold">{r.name}</span>
              <span className="text-slate-400 text-[9px]">
                {r.type?.toUpperCase()} @ Z:{r.z}m
              </span>
            </div>
            {r.hit ? (
              <span className="text-emerald-600 font-bold text-sm">
                {r.distance.toFixed(2)}m
              </span>
            ) : (
              <span className="text-slate-300 font-bold text-sm">---</span>
            )}
          </div>
        ))}
      </div>

      <div className="absolute bottom-6 right-6 flex gap-4 transition-all duration-300">
        <div
          onClick={() => setInfoModal("truth")}
          className="bg-white/90 border border-slate-200 p-3 rounded-lg shadow-sm min-w-[120px] pointer-events-auto cursor-pointer hover:bg-blue-50 transition-colors relative group flex flex-col justify-between"
        >
          <div>
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
          <div className="mt-2 text-[10px] font-bold text-slate-500 bg-slate-100 py-1 px-2 rounded inline-block w-fit">
            Toleransi: ±{tolerance.toFixed(2)}m
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
                  {truck.length}m, Truth Z: {truthCenter.toFixed(3)}m
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
                  const truckZMin = Truth Center Z - (length / 2) ={" "}
                  {(truthCenter - truck.length / 2).toFixed(3)}
                  {"\n"}
                  const truckZMax = Truth Center Z + (length / 2) ={" "}
                  {(truthCenter + truck.length / 2).toFixed(3)}
                  {"\n"}
                  Physical Bounds = [
                  {(truthCenter - truck.length / 2).toFixed(3)},{" "}
                  {(truthCenter + truck.length / 2).toFixed(3)}]
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
                {sensorCenter !== null && calcDetails.hasLaserHits ? (
                  <pre className="font-mono text-[12px] whitespace-pre-wrap leading-relaxed space-y-2">
                    <>
                      <div>
                        entryLaser.distance = distance from rear to entry sensor
                        = {calcDetails.entryDist.toFixed(3)}
                      </div>
                      <div>
                        exitLaser.distance = distance from front to exit sensor
                        = {calcDetails.exitDist.toFixed(3)}
                      </div>
                      <div className="border-t border-slate-600 pt-2 text-emerald-400 font-bold text-sm">
                        sensorCenter = (entryLaser.distance -
                        exitLaser.distance) / 2 = (
                        {calcDetails.entryDist.toFixed(3)} -{" "}
                        {calcDetails.exitDist.toFixed(3)}) / 2 ={" "}
                        {sensorCenter.toFixed(3)}m
                      </div>
                    </>
                  </pre>
                ) : (
                  <div className="font-mono text-sm text-amber-400">
                    Menunggu posisi truk berada di antara kedua sensor profil
                    (Entry dan Exit)...
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
