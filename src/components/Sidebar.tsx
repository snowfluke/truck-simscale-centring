import React, { useState } from 'react';
import { useStore, DEFAULT_TRUCK_PROFILES } from '../store';
import { ChevronRight, ChevronLeft, Plus } from 'lucide-react';
import { clsx } from 'clsx';

export function Sidebar() {
  const {
    isSidebarOpen, toggleSidebar,
    truck, setTruckDimensions, truckProfiles, addTruckProfile,
    scale, setScale,
    road, setRoad,
    sensors, sensorProfiles, addSensorPair, updateSensor, removeSensorPair
  } = useStore();

  const [activeTab, setActiveTab] = useState('Truck');
  const [newTruckName, setNewTruckName] = useState('');
  const [showNewSensor, setShowNewSensor] = useState(false);
  const [newSensorData, setNewSensorData] = useState({ name: '', height: 2.5, beamWidth: 50, tilt: 0 });

  const handleTruckProfile = (idx: number) => {
    const prof = truckProfiles[idx];
    setTruckDimensions({ width: prof.width, height: prof.height, length: prof.length });
  };

  return (
    <>
      <div
        className={clsx(
          "h-full bg-white border-r border-slate-200 transition-all flex flex-col z-40 shrink-0",
          isSidebarOpen ? "w-[280px]" : "w-0 overflow-hidden border-r-0"
        )}
      >
        <div className="flex border-b border-slate-200 overflow-x-auto text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 shrink-0">
          {['Truck', 'Scale', 'Road', 'Sensors'].map((t) => (
            <button
              key={t}
              className={clsx("flex-1 py-3 transition-colors border-b-2", activeTab === t ? "border-blue-500 text-blue-600 bg-white" : "border-transparent hover:bg-slate-100")}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'Truck' && (
            <div className="p-4 border-b border-slate-200">
              <div className="flex justify-between items-center mb-3">
                 <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Truck Inspector</span>
              </div>
              <div className="mb-3">
                <label className="block text-[12px] text-slate-500 mb-1">Vehicle Profile</label>
                <select 
                  className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px] bg-white text-slate-800 focus:outline-none focus:border-blue-500"
                  onChange={(e) => handleTruckProfile(Number(e.target.value))}
                  defaultValue={2}
                >
                  {truckProfiles.map((p, i) => (
                    <option key={p.id || i} value={i}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-[12px] text-slate-500 mb-1">Width (m)</label>
                  <input type="number" step="0.1" value={truck.width} onChange={(e) => setTruckDimensions({ width: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px] bg-white text-slate-800" />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-500 mb-1">Height (m)</label>
                  <input type="number" step="0.1" value={truck.height} onChange={(e) => setTruckDimensions({ height: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px] bg-white text-slate-800" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[12px] text-slate-500 mb-1">Length (m)</label>
                  <input type="number" step="0.5" value={truck.length} onChange={(e) => setTruckDimensions({ length: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px] bg-white text-slate-800" />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                 <label className="block text-[11px] font-semibold text-slate-500 mb-2">Save as Custom Profile</label>
                 <div className="flex gap-2">
                    <input type="text" placeholder="Profile Name" value={newTruckName} onChange={(e) => setNewTruckName(e.target.value)} className="flex-1 px-[10px] py-[6px] border border-slate-200 rounded text-[12px]" />
                    <button onClick={() => {
                       if (newTruckName.trim()) {
                          addTruckProfile({ id: `custom-${Date.now()}`, name: newTruckName, width: truck.width, height: truck.height, length: truck.length });
                          setNewTruckName('');
                       }
                    }} className="bg-slate-800 hover:bg-slate-700 text-white px-3 rounded text-[11px] font-bold transition-colors">Save</button>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'Scale' && (
            <div className="p-4 border-b border-slate-200">
              <div className="mb-3">
                 <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">World Settings</span>
              </div>
              <div className="mb-3">
                <label className="block text-[12px] text-slate-500 mb-1">Scale Width (m)</label>
                <input type="number" step="0.1" value={scale.width} onChange={(e) => setScale({ width: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px] bg-white text-slate-800" />
              </div>
              <div className="mb-3">
                <label className="block text-[12px] text-slate-500 mb-1">Scale Length (m)</label>
                <input type="number" step="0.5" value={scale.length} onChange={(e) => setScale({ length: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px] bg-white text-slate-800" />
              </div>
            </div>
          )}

          {activeTab === 'Road' && (
            <div className="p-4 border-b border-slate-200">
               <div className="mb-3">
                 <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Road Settings</span>
              </div>
              <div className="mb-3">
                <label className="block text-[12px] text-slate-500 mb-1">Road Width (m)</label>
                <input type="number" step="1" value={road.width} onChange={(e) => setRoad({ width: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px] bg-white text-slate-800" />
              </div>
            </div>
          )}

          {activeTab === 'Sensors' && (
             <div className="p-4 border-b border-slate-200">
               <div className="flex justify-between items-center mb-4">
                 <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sensor Array</span>
               </div>
               
               <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
                 <label className="block text-[11px] font-semibold text-slate-500 mb-1">Add New Pair from Profile</label>
                 <div className="flex gap-2">
                   <select 
                     id="sensorProfileSelect"
                     className="flex-1 px-[10px] py-[6px] border border-slate-200 rounded text-[12px] bg-white text-slate-800 focus:outline-none focus:border-blue-500"
                   >
                     {sensorProfiles.map((p, i) => (
                       <option key={p.id || i} value={i}>{p.name}</option>
                     ))}
                   </select>
                   <button 
                     onClick={() => {
                        const sel = document.getElementById('sensorProfileSelect') as HTMLSelectElement;
                        const profile = useStore.getState().sensorProfiles[Number(sel.value)];
                        addSensorPair(profile);
                     }} 
                     className="bg-blue-500 hover:bg-blue-600 text-white px-3 border border-blue-600 rounded text-[11px] font-bold flex items-center justify-center transition-colors"
                   >
                      <Plus size={14} className="mr-1"/> Add
                   </button>
                 </div>
                 
                 <div className="mt-3">
                    <button onClick={() => setShowNewSensor(!showNewSensor)} className="text-[10px] text-blue-500 hover:underline">{showNewSensor ? "Cancel Creation" : "+ Create Custom Sensor Profile"}</button>
                    {showNewSensor && (
                       <div className="mt-2 grid grid-cols-2 gap-2 p-2 bg-white border border-slate-200 rounded shadow-sm">
                          <div className="col-span-2">
                             <input type="text" placeholder="Profile Name (e.g. HC-SR04)" value={newSensorData.name} onChange={(e) => setNewSensorData({...newSensorData, name: e.target.value})} className="w-full px-[8px] py-[4px] border border-slate-200 rounded text-[11px]" />
                          </div>
                          <div>
                             <label className="block text-[9px] text-slate-400 mb-1">Height (m)</label>
                             <input type="number" step="0.5" value={newSensorData.height} onChange={(e) => setNewSensorData({...newSensorData, height: Number(e.target.value)})} className="w-full px-[8px] py-[4px] border border-slate-200 rounded text-[11px]" />
                          </div>
                          <div>
                             <label className="block text-[9px] text-slate-400 mb-1">Beam (&deg;)</label>
                             <input type="number" step="1" value={newSensorData.beamWidth} onChange={(e) => setNewSensorData({...newSensorData, beamWidth: Number(e.target.value)})} className="w-full px-[8px] py-[4px] border border-slate-200 rounded text-[11px]" />
                          </div>
                          <div>
                             <label className="block text-[9px] text-slate-400 mb-1">Tilt (&deg;)</label>
                             <input type="number" step="1" value={newSensorData.tilt} onChange={(e) => setNewSensorData({...newSensorData, tilt: Number(e.target.value)})} className="w-full px-[8px] py-[4px] border border-slate-200 rounded text-[11px]" />
                          </div>
                          <div className="flex items-end">
                             <button onClick={() => {
                                if (newSensorData.name.trim()) {
                                   useStore.getState().addSensorProfile({ id: `s-prof-${Date.now()}`, ...newSensorData });
                                   setNewSensorData({ name: '', height: 2.5, beamWidth: 50, tilt: 0 });
                                   setShowNewSensor(false);
                                }
                             }} className="w-full bg-slate-800 text-white rounded px-2 py-[5px] text-[10px] font-bold hover:bg-slate-700">Save Profile</button>
                          </div>
                       </div>
                    )}
                 </div>
               </div>

               <div className="space-y-4">
                 {sensors.map((s, idx) => (
                   <div key={s.id} className="relative pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                     <button onClick={() => removeSensorPair(s.id)} className="absolute top-0 right-0 text-slate-400 hover:text-red-500 text-xs">×</button>
                     <div className="text-[11px] font-semibold text-slate-700 mb-2">
                       {s.name} - Pair {idx + 1} <br/>
                       <span className="text-slate-500 text-[10px] font-normal">Z: {s.z}m ({Number(Math.abs(s.z) / (scale.length / 2) * 100).toFixed(0)}% from center)</span>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                           <label className="block text-[12px] text-slate-500 mb-1">Height (m)</label>
                           <input type="number" step="0.5" value={s.height} onChange={(e) => updateSensor(s.id, { height: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px]" />
                        </div>
                        <div>
                           <label className="block text-[12px] text-slate-500 mb-1">Z Pos (m)</label>
                           <input type="number" step="1" value={s.z} onChange={(e) => updateSensor(s.id, { z: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px]" />
                        </div>
                        <div>
                           <label className="block text-[12px] text-slate-500 mb-1">Beam (&deg;)</label>
                           <input type="number" step="1" value={s.beamWidth} onChange={(e) => updateSensor(s.id, { beamWidth: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px]" />
                        </div>
                        <div>
                           <label className="block text-[12px] text-slate-500 mb-1">Tilt (&deg;)</label>
                           <input type="number" step="1" value={s.tilt} onChange={(e) => updateSensor(s.id, { tilt: Number(e.target.value) })} className="w-full px-[10px] py-[6px] border border-slate-200 rounded text-[13px]" />
                        </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          )}
        </div>
        <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50">
           <div className="text-[10px] text-slate-400 font-semibold tracking-wider">SIMSCALE ENGINE v1.4.2</div>
        </div>
      </div>

      <button
        onClick={toggleSidebar}
        className={clsx(
          "absolute top-4 z-50 bg-white p-2 border border-slate-200 shadow-sm transition-all focus:outline-none rounded-r-md rounded-l-none text-slate-500 hover:text-slate-800",
          isSidebarOpen ? "left-[280px] border-l-0" : "left-0"
        )}
      >
        {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </>
  );
}
