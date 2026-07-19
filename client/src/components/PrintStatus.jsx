import { useState, useEffect } from 'react';
import axios from 'axios';
import namer from 'color-namer';
import { io } from 'socket.io-client';
import { useAlert } from '../contexts/AlertContext';
import { Thermometer, Box, Lightbulb, Fan, Layers, Droplets, Edit2 } from 'lucide-react';

function PrintStatus() {
  const { showAlert, showPrompt } = useAlert();
  const [printers, setPrinters] = useState([]);
  const [amsDataMap, setAmsDataMap] = useState({});
  const [amsAssignments, setAmsAssignments] = useState({});
  const [spools, setSpools] = useState([]);
  const [printStates, setPrintStates] = useState({});
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [activeTrayId, setActiveTrayId] = useState(null);
  const [activePrinterId, setActivePrinterId] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetchData();
    const token = localStorage.getItem('token');
    const socket = io({ auth: { token } });

    socket.on('print_state_update', (data) => {
      setPrintStates(prev => ({ ...prev, [data.printer_id]: data.state }));
    });

    socket.on('ams_update', (data) => {
      setAmsDataMap(prev => ({ ...prev, [data.printer_id]: data.ams }));
    });

    socket.on('ams_assignments_update', (data) => {
      setAmsAssignments(data);
    });

    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    try {
      const [printersRes, amsRes, assignRes, spoolsRes, printRes, settingsRes] = await Promise.all([
        axios.get('/api/printers'),
        axios.get('/api/ams'),
        axios.get('/api/ams/assignments'),
        axios.get('/api/spools'),
        axios.get('/api/print_status'),
        axios.get('/api/settings')
      ]);
      setPrinters(printersRes.data.printers || []);
      setAmsDataMap(amsRes.data || {});
      setAmsAssignments(assignRes.data || {});
      setSpools(spoolsRes.data.filter(s => !s.archived));
      setPrintStates(printRes.data || {});
      setSettings(settingsRes.data || {});
    } catch (err) {}
  };

  const handleRenameAms = (printerId, amsId) => {
    const defaultName = amsId === "128" || amsId === "255" || amsId === "254" ? "External Spool" : `AMS ${parseInt(amsId) + 1}`;
    const key = `ams_name_${printerId}_${amsId}`;
    const currentName = settings[key] || defaultName;
    
    showPrompt(`Rename ${defaultName}`, 'Enter a new name for this AMS (or clear to reset):', currentName, async (newName) => {
      if (newName !== null) {
        try {
          await axios.post('/api/settings', { [key]: newName.trim() });
          fetchData();
        } catch (err) {
          showAlert('Error', 'Failed to rename AMS', true);
        }
      }
    });
  };

  const handleAssignAms = async (printerId, trayId, spoolId) => {
    try {
      await axios.post('/api/ams/assignments', { printer_id: printerId, tray_id: trayId, spool_id: spoolId });
      fetchData();
    } catch (err) {
      showAlert('Error', 'Failed to assign spool to AMS', true);
    }
  };

  // Returns true if a hex colour is perceptually dark (so we should use white text on it)
  const isColorDark = (hex) => {
    if (!hex) return true;
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    // Perceived luminance (WCAG formula)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.45;
  };

  return (
    <div>
      <div className="card title-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Print Status</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Live Dashboards</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Real-time telemetry and AMS tracking for all active printers.</div>
          </div>
          <button onClick={fetchData} style={{ padding: '8px 16px' }}>Refresh All</button>
        </div>
      </div>

      {printers.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>No Printers Configured</h3>
          <p style={{ color: '#888' }}>Go to Settings to add your first printer.</p>
        </div>
      )}

      {printers.map(printer => {
        const state = printStates[printer.id];
        const amsData = amsDataMap[printer.id];
        const assignments = amsAssignments[printer.id] || {};

        if (!state) return null;

        return (
          <div key={printer.id} style={{ marginBottom: '40px' }}>
            <h2 style={{ marginBottom: '10px', color: '#ccc', borderBottom: '1px solid var(--primary-color)', paddingBottom: '10px' }}>{printer.name}</h2>
            
            <div className="card title-card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div>
                  <h2 style={{ margin: '0 0 5px 0', color: 'var(--text-color)', fontSize: '1.2rem', fontWeight: 600 }}>
                    Current Print
                    <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 'normal', marginLeft: '8px', textTransform: 'capitalize' }}>
                      ({(state.stage || state.status || '').toLowerCase().replace(/_/g, ' ')})
                    </span>
                  </h2>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{state.name || 'Idle / No Active Print'}</div>
                  <div style={{ fontSize: '0.85rem', color: '#888' }}>Started: {state.startTime ? new Date(state.startTime).toLocaleTimeString() : 'N/A'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{state.progress || 0}%</div>
                  <div style={{ fontSize: '0.9rem', color: '#aaa', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    {state.remainingTime ? (
                      <>
                        <div>{Math.floor(state.remainingTime / 60)}h {state.remainingTime % 60}m remaining</div>
                        <div style={{ color: '#888', fontSize: '0.8rem' }}>
                          ETA: {new Date(Date.now() + state.remainingTime * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </>
                    ) : 'Calculating...'}
                  </div>
                </div>
              </div>

              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--secondary-bg)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ width: `${state.progress || 0}%`, height: '100%', backgroundColor: 'var(--primary-color)', transition: 'width 0.5s ease-in-out' }}></div>
              </div>

              <div className="printer-stats-grid">
                {(() => {
                  const extInfo = state.raw?.device?.extruder?.info;
                  const hasDualExtruder = extInfo && Array.isArray(extInfo) && extInfo.length > 1;
                  
                  if (hasDualExtruder) {
                    const labels = ['Left Nozzle', 'Right Nozzle'];
                    // Reverse the array so Left Nozzle (originally index 1) renders on the left
                    return [...extInfo].reverse().map((ext, i) => {
                      const label = labels[i] || `Nozzle ${i + 1}`;
                      const isPacked = ext.temp > 1000;
                      const currentTemp = isPacked ? (ext.temp & 0xFFFF) : (ext.temp || 0);
                      const explicitTarget = isPacked ? (ext.temp >> 16) : ext.htar;
                      const target = explicitTarget > 1 ? explicitTarget : (state.raw.nozzle_target_temper || 0);
                      
                      return (
                        <div key={`ext_${i}`} className="printer-stat-card">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                            <Thermometer size={16} color="#f87171" /> {label}
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{currentTemp}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {target}°C</span></div>
                        </div>
                      );
                    });
                  } else {
                    return (
                      <div className="printer-stat-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                          <Thermometer size={16} color="#f87171" /> Nozzle
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{state.nozzleTemp || 0}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {state.nozzleTarget || 0}°C</span></div>
                      </div>
                    );
                  }
                })()}

                <div className="printer-stat-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                    <Thermometer size={16} color="#f97316" /> Bed
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{state.bedTemp || 0}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {state.bedTarget || 0}°C</span></div>
                </div>

                <div className="printer-stat-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                    <Box size={16} color="#a855f7" /> Chamber
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{state.chamberTemp || 0}°C</div>
                </div>

                <div className="printer-stat-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                    <Lightbulb size={16} color={state.light ? '#eab308' : '#888'} /> Light
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{state.light ? 'On' : 'Off'}</div>
                </div>

                {(() => {
                  const speeds = {
                    'cooling_fan_speed': 'Part Fan',
                    'heatbreak_fan_speed': 'Hotend Fan',
                    'big_fan1_speed': 'Aux Fan',
                    'big_fan2_speed': 'Chamber Fan'
                  };
                  return Object.entries(speeds).map(([key, title]) => {
                    const rawSpeed = state.raw ? parseInt(state.raw[key] || 0, 10) : 0;
                    const speedPercent = rawSpeed === 0 ? "Off" : `${Math.round((rawSpeed / 15) * 100)}%`;
                    const isSpinning = rawSpeed > 0;
                    return (
                      <div key={key} className="printer-stat-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                          <Fan size={16} color={isSpinning ? '#38bdf8' : '#888'} className={isSpinning ? 'spin-animation' : ''} /> {title}
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{speedPercent}</div>
                      </div>
                    );
                  });
                })()}

                <div className="printer-stat-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                    <Layers size={16} color="#a3e635" /> Layer
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{state.layerNum || 0} <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {state.totalLayerNum || 0}</span></div>
                </div>
              </div>
            </div>

            <div className="card title-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2>AMS Overview</h2>
              </div>
              
              {amsData && Object.keys(amsData).length > 0 ? (
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  {Array.isArray(amsData) ? amsData.map((amsUnit, index) => (
                    <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', minWidth: amsUnit.tray && amsUnit.tray.length === 1 ? '150px' : '300px', flex: amsUnit.tray ? amsUnit.tray.length : 1, maxWidth: amsUnit.tray && amsUnit.tray.length === 1 ? '250px' : '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 
                          style={{ margin: 0, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} 
                          onClick={() => handleRenameAms(printer.id, amsUnit.id)} 
                          title="Click to rename"
                        >
                          {settings[`ams_name_${printer.id}_${amsUnit.id}`] || (amsUnit.id === "128" || amsUnit.id === "255" || amsUnit.id === "254" ? "External Spool" : `AMS ${parseInt(amsUnit.id) + 1}`)}
                          <Edit2 size={12} color="#888" />
                        </h3>
                        <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', color: '#aaa', alignItems: 'center' }}>
                          {(amsUnit.humidity_raw !== undefined || amsUnit.humidity !== undefined) && (
                            <span title="Humidity" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Droplets size={14} color="#38bdf8" /> 
                              {amsUnit.humidity_raw !== undefined ? `${amsUnit.humidity_raw}%` : 
                                  amsUnit.humidity === "1" ? '> 50%' : 
                                  amsUnit.humidity === "2" ? '40-50%' : 
                                  amsUnit.humidity === "3" ? '30-40%' : 
                                  amsUnit.humidity === "4" ? '20-30%' : 
                                  amsUnit.humidity === "5" ? '< 20%' : 
                                  `${amsUnit.humidity}%`}
                            </span>
                          )}
                          {amsUnit.temp !== undefined && (
                            <span title="Internal Temperature" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Thermometer size={14} color="#f87171" /> {amsUnit.temp}°C
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {amsUnit.tray && amsUnit.tray.map((tray, tIndex) => {
                          return (() => {
                            const hasFilament = tray.tray_type && tray.tray_type !== '';
                            const hexColor = tray.tray_color ? `#${tray.tray_color.substring(0, 6)}` : '#333';
                            const trayId = `${amsUnit.id}-${tIndex}`;
                            const isAssigned = assignments[trayId] !== undefined;
                            const assignedSpoolId = assignments[trayId];
                            const assignedSpool = assignedSpoolId ? spools.find(s => s.id === assignedSpoolId) : null;
                            const isActive = state.activeTrays && state.activeTrays.includes(trayId);
                            const isFeeding = state.currentTrayId === trayId;
                            
                            const remaining = assignedSpool ? (assignedSpool.total_weight - assignedSpool.used_weight) : 0;
                            const remainingPct = assignedSpool ? (remaining / assignedSpool.total_weight) * 100 : 0;
                            const isLowStock = remainingPct < 15;

                            return (
                              <div 
                                key={tIndex} 
                                style={{ 
                                  flex: 1, 
                                  backgroundColor: 'var(--secondary-bg)', 
                                  borderRadius: '6px', 
                                  overflow: 'hidden',
                                  border: isFeeding ? '2px solid var(--primary-color)' : isActive ? '2px solid #555' : '2px solid transparent',
                                  opacity: !hasFilament && !isAssigned ? 0.4 : 1,
                                  display: 'flex', flexDirection: 'column'
                                }}
                              >
                                <div style={{ 
                                  height: '25px', 
                                  backgroundColor: hasFilament ? hexColor : '#222',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.75rem', fontWeight: 'bold',
                                  color: hasFilament && isColorDark(hexColor) ? '#fff' : '#000',
                                  borderBottom: '1px solid rgba(0,0,0,0.1)'
                                }}>
                                  {amsUnit.id === "128" || amsUnit.id === "255" || amsUnit.id === "254" ? '1' : tIndex + 1}
                                </div>
                                <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
                                  {assignedSpool ? (
                                    <div style={{ fontSize: '0.75rem', marginBottom: '5px' }}>
                                      <div style={{ color: isActive ? hexColor : 'var(--primary-color)', fontWeight: isActive ? 'bold' : 'normal' }}>
                                        {assignedSpool.brand_name} {assignedSpool.material_name}
                                      </div>
                                      <div style={{ marginTop: '4px', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.65rem', color: '#888', marginBottom: '2px' }}>
                                          <span>{remaining.toFixed(0)}g</span>
                                        </div>
                                        <div className="progress-bar-container" style={{ height: '4px' }}>
                                          <div className="progress-bar" style={{ width: `${remainingPct}%`, backgroundColor: isLowStock ? '#f44336' : (remainingPct < 40 ? '#ff9800' : '#4caf50') }}></div>
                                        </div>
                                      </div>
                                      {isLowStock && (
                                        <div style={{ marginTop: '4px' }}>
                                          <span style={{ backgroundColor: 'rgba(244,67,54,0.2)', color: '#f87171', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(244,67,54,0.4)', fontWeight: 'bold' }}>Low Stock</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', marginBottom: '5px', color: '#666' }}>
                                      Not Assigned
                                    </div>
                                  )}
                                  <button 
                                    className={assignedSpool ? "btn-secondary" : "btn-primary"} 
                                    style={{ width: '100%', fontSize: '0.75rem', padding: '6px 4px', fontWeight: 'bold' }}
                                    onClick={() => { setActivePrinterId(printer.id); setActiveTrayId(trayId); setIsAssignModalOpen(true); }}
                                  >
                                    {assignedSpool ? 'Change Spool' : '+ Assign Spool'}
                                  </button>
                                  {assignedSpool && (
                                    <button 
                                      className="btn-secondary" 
                                      style={{ width: '100%', fontSize: '0.7rem', padding: '4px', marginTop: '4px', backgroundColor: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}
                                      onClick={() => handleAssignAms(printer.id, trayId, '')}
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })();
                        })}
                      </div>
                    </div>
                  )) : (
                    <pre style={{fontSize: '12px', color: '#888'}}>Waiting for detailed AMS payload...</pre>
                  )}
                </div>
              ) : (
                <p style={{color: '#888'}}>No AMS data received yet. Ensure your Bambu printer is connected via MQTT in Settings.</p>
              )}
            </div>
          </div>
        );
      })}

      {isAssignModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAssignModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2>Assign Spool</h2>
              <button className="btn-secondary" onClick={() => setIsAssignModalOpen(false)}>Close</button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="fm-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Material</th>
                    <th>Color</th>
                    <th>Remaining</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {spools.map(s => {
                    const rem = s.total_weight - s.used_weight;
                    let colorText = s.color_name;
                    if (!colorText) {
                      try {
                        if (s.color) {
                          const names = namer(s.color);
                          colorText = names.basic[0].name;
                          colorText = colorText.charAt(0).toUpperCase() + colorText.slice(1);
                        }
                      } catch (e) {
                        colorText = 'Unknown';
                      }
                    }
                    let subtypeText = s.subtype && s.subtype.toLowerCase() !== 'basic' ? ` (${s.subtype})` : '';

                    return (
                      <tr key={s.id}>
                        <td>{s.brand_name}</td>
                        <td>{s.material_name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{width: '15px', height: '15px', borderRadius: '50%', backgroundColor: s.color || '#333'}}></div>
                            {colorText}{subtypeText}
                          </div>
                        </td>
                        <td>{rem.toFixed(0)}g</td>
                        <td>
                          <button className="btn-primary" onClick={() => {
                            handleAssignAms(activePrinterId, activeTrayId, s.id);
                            setIsAssignModalOpen(false);
                          }}>Select</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrintStatus;
