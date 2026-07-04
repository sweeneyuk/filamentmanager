import { useState, useEffect } from 'react';
import axios from 'axios';
import namer from 'color-namer';
import { io } from 'socket.io-client';
import { useAlert } from '../contexts/AlertContext';

function PrintStatus() {
  const { showAlert, showPrompt } = useAlert();
  const [amsData, setAmsData] = useState(null);
  const [amsAssignments, setAmsAssignments] = useState({});
  const [spools, setSpools] = useState([]);
  const [printState, setPrintState] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [activeTrayId, setActiveTrayId] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetchData();
    const socket = io();

    socket.on('print_state_update', (data) => {
      setPrintState(data);
    });

    socket.on('ams_update', (data) => {
      setAmsData(data);
    });

    socket.on('ams_assignments_update', (data) => {
      setAmsAssignments(data);
    });

    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    try {
      const [amsRes, assignRes, spoolsRes, printRes, settingsRes] = await Promise.all([
        axios.get('/api/ams'),
        axios.get('/api/ams/assignments'),
        axios.get('/api/spools'),
        axios.get('/api/print_status'),
        axios.get('/api/settings')
      ]);
      setAmsData(amsRes.data);
      setAmsAssignments(assignRes.data);
      setSpools(spoolsRes.data.filter(s => !s.archived));
      setPrintState(printRes.data);
      setSettings(settingsRes.data);
    } catch (err) {}
  };

  const handleRenameAms = (amsId) => {
    const defaultName = amsId === "128" || amsId === "255" ? "External Spool" : `AMS ${parseInt(amsId) + 1}`;
    const currentName = settings[`ams_name_${amsId}`] || defaultName;
    
    showPrompt(`Rename ${defaultName}`, 'Enter a new name for this AMS (or clear to reset):', currentName, async (newName) => {
      if (newName !== null) {
        try {
          await axios.post('/api/settings', { [`ams_name_${amsId}`]: newName.trim() });
          fetchData();
        } catch (err) {
          showAlert('Error', 'Failed to rename AMS', true);
        }
      }
    });
  };

  const handleAssignAms = async (trayId, spoolId) => {
    try {
      await axios.post('/api/ams/assignments', { tray_id: trayId, spool_id: spoolId });
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
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Live Dashboard</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Real-time printer telemetry and AMS tracking.</div>
          </div>
        </div>
      </div>

      {printState && (
        <div className="card title-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>CURRENT PRINT ({printState.stage || printState.status})</h2>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.name || 'Idle / No Active Print'}</div>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>Started: {printState.startTime ? new Date(printState.startTime).toLocaleTimeString() : 'N/A'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{printState.progress || 0}%</div>
              <div style={{ fontSize: '0.9rem', color: '#aaa' }}>
                {printState.remainingTime ? `${Math.floor(printState.remainingTime / 60)}h ${printState.remainingTime % 60}m remaining` : 'Calculating...'}
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--secondary-bg)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ width: `${printState.progress || 0}%`, height: '100%', backgroundColor: 'var(--primary-color)', transition: 'width 0.5s ease-in-out' }}></div>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {(() => {
              const extInfo = printState.raw?.device?.extruder?.info;
              const hasDualExtruder = extInfo && Array.isArray(extInfo) && extInfo.length > 1;
              
              if (hasDualExtruder) {
                const labels = ['Right Nozzle', 'Left Nozzle'];
                return extInfo.map((ext, i) => {
                  const label = labels[i] || `Nozzle ${i + 1}`;
                  const isPacked = ext.temp > 1000;
                  const currentTemp = isPacked ? (ext.temp & 0xFFFF) : (ext.temp || 0);
                  const explicitTarget = isPacked ? (ext.temp >> 16) : ext.htar;
                  const target = explicitTarget > 1 ? explicitTarget : (printState.raw.nozzle_target_temper || 0);
                  
                  return (
                    <div key={`ext_${i}`} className="printer-stat-card">
                      <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>🌡️ {label}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{currentTemp}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {target}°C</span></div>
                    </div>
                  );
                });
              } else {
                return (
                  <div className="printer-stat-card">
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>🌡️ Nozzle</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.nozzleTemp || 0}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {printState.nozzleTarget || 0}°C</span></div>
                  </div>
                );
              }
            })()}

            <div className="printer-stat-card">
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>🛏️ Bed</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.bedTemp || 0}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {printState.bedTarget || 0}°C</span></div>
            </div>

            <div className="printer-stat-card">
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>📦 Chamber</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.chamberTemp || 0}°C</div>
            </div>

            <div className="printer-stat-card">
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>💡 Light</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.light ? 'On' : 'Off'}</div>
            </div>

            {(() => {
              const speeds = {
                'cooling_fan_speed': '💨 Part Fan',
                'heatbreak_fan_speed': '💨 Hotend Fan',
                'big_fan1_speed': '💨 Aux Fan',
                'big_fan2_speed': '💨 Chamber Fan'
              };
              return Object.entries(speeds).map(([key, title]) => {
                const rawSpeed = printState.raw ? parseInt(printState.raw[key] || 0, 10) : 0;
                const speedPercent = rawSpeed === 0 ? "Off" : `${Math.round((rawSpeed / 15) * 100)}%`;
                return (
                  <div key={key} className="printer-stat-card">
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>{title}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{speedPercent}</div>
                  </div>
                );
              });
            })()}

            <div className="printer-stat-card">
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>📶 Layer</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.layerNum || 0} <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {printState.totalLayerNum || 0}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="card title-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>AMS Overview</h2>
          <button onClick={fetchData} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Refresh</button>
        </div>
        
        {amsData && Object.keys(amsData).length > 0 ? (
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {Array.isArray(amsData) ? amsData.map((amsUnit, index) => (
              <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', minWidth: '300px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 
                    style={{ margin: 0, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }} 
                    onClick={() => handleRenameAms(amsUnit.id)} 
                    title="Click to rename"
                  >
                    {settings[`ams_name_${amsUnit.id}`] || (amsUnit.id === "128" || amsUnit.id === "255" ? "External Spool" : `AMS ${parseInt(amsUnit.id) + 1}`)}
                    <span style={{fontSize: '0.8rem', opacity: 0.5}}>✎</span>
                  </h3>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', color: '#888' }}>
                    {(amsUnit.humidity_raw !== undefined || amsUnit.humidity !== undefined) && (
                      <span title="Humidity">
                        💧 {amsUnit.humidity_raw !== undefined ? `${amsUnit.humidity_raw}%` : 
                            amsUnit.humidity === "1" ? '> 50%' : 
                            amsUnit.humidity === "2" ? '40-50%' : 
                            amsUnit.humidity === "3" ? '30-40%' : 
                            amsUnit.humidity === "4" ? '20-30%' : 
                            amsUnit.humidity === "5" ? '< 20%' : 
                            `${amsUnit.humidity}%`}
                      </span>
                    )}
                    {amsUnit.temp !== undefined && <span title="Internal Temperature">🌡️ {amsUnit.temp}°C</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {amsUnit.tray && amsUnit.tray.map((tray, tIndex) => {
                    const hasFilament = tray.tray_type && tray.tray_type !== '';
                    const hexColor = tray.tray_color ? `#${tray.tray_color.substring(0, 6)}` : '#333';
                    const trayId = `${amsUnit.id}-${tIndex}`;
                    const isActive = printState && printState.status === 'RUNNING' && printState.currentTrayId === trayId;
                    return (
                      <div key={tIndex} className="filament-slot" style={{ 
                        flex: 1, 
                        textAlign: 'center',
                        backgroundColor: isActive ? `${hexColor}22` : (hasFilament ? 'rgba(255,255,255,0.03)' : 'transparent'),
                        padding: '10px 5px',
                        borderRadius: '6px',
                        border: isActive ? `2px solid ${hexColor}` : (hasFilament ? `1px solid ${hexColor}` : '1px dashed var(--border-color)'),
                        boxShadow: isActive ? `0 0 12px ${hexColor}66` : 'none',
                        position: 'relative'
                      }}>
                        {isActive && (
                          <div style={{
                            position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                            backgroundColor: hexColor,
                            color: isColorDark(hexColor) ? '#ffffff' : '#000000',
                            border: isColorDark(hexColor) ? '1px solid rgba(255,255,255,0.3)' : 'none',
                            fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '8px', whiteSpace: 'nowrap'
                          }}>
                            IN USE
                          </div>
                        )}
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '50%', 
                          backgroundColor: hasFilament ? hexColor : '#222',
                          margin: '0 auto 10px auto',
                          boxShadow: isActive ? `0 0 8px ${hexColor}` : 'none'
                        }}></div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {hasFilament ? tray.tray_type : 'Empty'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '10px' }}>
                          Slot {tIndex + 1}
                        </div>
                        {(() => {
                          const assignedSpoolId = amsAssignments[trayId];
                          const assignedSpool = spools.find(s => s.id == assignedSpoolId);
                          let isLowStock = false;
                          let remaining = 0;
                          let remainingPct = 0;
                          if (assignedSpool) {
                            remaining = assignedSpool.total_weight - assignedSpool.used_weight;
                            remainingPct = Math.max(0, Math.min(100, (remaining / assignedSpool.total_weight) * 100));
                            isLowStock = remainingPct < 15 || remaining < 50;
                          }
                          return (
                            <div>
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
                                className="btn-secondary" 
                                style={{ width: '100%', fontSize: '0.7rem', padding: '4px' }}
                                onClick={() => { setActiveTrayId(trayId); setIsAssignModalOpen(true); }}
                              >
                                {assignedSpool ? 'Change' : 'Assign Spool'}
                              </button>
                              {assignedSpool && (
                                <button 
                                  className="btn-secondary" 
                                  style={{ width: '100%', fontSize: '0.7rem', padding: '4px', marginTop: '4px', backgroundColor: 'transparent', color: '#ff5555', border: '1px solid #ff5555' }}
                                  onClick={() => handleAssignAms(trayId, '')}
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
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
                            handleAssignAms(activeTrayId, s.id);
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
