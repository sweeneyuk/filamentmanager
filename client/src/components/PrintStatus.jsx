import { useState, useEffect } from 'react';
import axios from 'axios';
import namer from 'color-namer';

function PrintStatus() {
  const [amsData, setAmsData] = useState(null);
  const [amsAssignments, setAmsAssignments] = useState({});
  const [spools, setSpools] = useState([]);
  const [printState, setPrintState] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [activeTrayId, setActiveTrayId] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [amsRes, assignRes, spoolsRes, printRes] = await Promise.all([
        axios.get('/api/ams'),
        axios.get('/api/ams/assignments'),
        axios.get('/api/spools'),
        axios.get('/api/print_status')
      ]);
      setAmsData(amsRes.data);
      setAmsAssignments(assignRes.data);
      setSpools(spoolsRes.data.filter(s => !s.archived));
      setPrintState(printRes.data);
    } catch (err) {}
  };

  const handleAssignAms = async (trayId, spoolId) => {
    try {
      await axios.post('/api/ams/assignments', { tray_id: trayId, spool_id: spoolId });
      fetchData();
    } catch (err) {
      alert('Failed to assign spool to AMS');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Print Status</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Live Dashboard</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Real-time printer telemetry and AMS tracking.</div>
          </div>
        </div>
      </div>

      {printState && printState.status !== 'IDLE' && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>CURRENT PRINT ({printState.status})</h2>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.name || 'Unknown Print'}</div>
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
              const temps = [];
              if (printState.raw) {
                Object.keys(printState.raw).forEach(key => {
                  if (key.endsWith('_temper') && !key.includes('target')) {
                    const baseName = key.replace('_temper', '');
                    const current = printState.raw[key];
                    const target = printState.raw[`${baseName}_target_temper`] || 0;
                    const title = baseName.charAt(0).toUpperCase() + baseName.slice(1).replace('_', ' ') + ' Temp';
                    
                    temps.push(
                      <div key={key} style={{ flex: 1, backgroundColor: 'var(--secondary-bg)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>{title}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{current}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {target}°C</span></div>
                      </div>
                    );
                  } else if (key.endsWith('_speed')) {
                    const baseName = key.replace('_speed', '');
                    let title = baseName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Fan';
                    if (title === 'Cooling Fan Fan') title = 'Part Fan';
                    if (title === 'Big Fan1 Fan') title = 'Aux Fan';
                    if (title === 'Big Fan2 Fan') title = 'Chamber Fan';
                    if (title === 'Heatbreak Fan Fan') title = 'Heatbreak Fan';
                    
                    const rawSpeed = parseInt(printState.raw[key] || 0, 10);
                    const speedPercent = rawSpeed === 0 ? "Off" : `${Math.round((rawSpeed / 15) * 100)}%`;
                    
                    temps.push(
                      <div key={key} style={{ flex: 1, backgroundColor: 'var(--secondary-bg)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>{title}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{speedPercent}</div>
                      </div>
                    );
                  }
                });

                if (printState.raw.extruder && Array.isArray(printState.raw.extruder.info)) {
                  // Only render these if we didn't already render a nozzle_temper, or if there are multiple
                  const hasMulti = printState.raw.extruder.info.length > 1;
                  printState.raw.extruder.info.forEach((ext, i) => {
                    // Skip ridiculous values which usually mean the sensor is disconnected
                    if (ext.temp > 0 && ext.temp < 1000) {
                      temps.push(
                        <div key={`ext_${i}`} style={{ flex: 1, backgroundColor: 'var(--secondary-bg)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>Nozzle {i + 1}</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{ext.temp}°C</div>
                        </div>
                      );
                    }
                  });
                }
              }
              
              if (temps.length === 0) {
                temps.push(
                  <div key="nozzle" style={{ flex: 1, backgroundColor: 'var(--secondary-bg)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>Nozzle Temp</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.nozzleTemp || 0}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {printState.nozzleTarget || 0}°C</span></div>
                  </div>,
                  <div key="bed" style={{ flex: 1, backgroundColor: 'var(--secondary-bg)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>Bed Temp</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.bedTemp || 0}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {printState.bedTarget || 0}°C</span></div>
                  </div>
                );
              }
              return temps;
            })()}

            <div style={{ flex: 1, backgroundColor: 'var(--secondary-bg)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>Layer</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.layerNum || 0} <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {printState.totalLayerNum || 0}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>AMS Overview</h2>
          <button onClick={fetchData} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Refresh</button>
        </div>
        
        {amsData && Object.keys(amsData).length > 0 ? (
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {Array.isArray(amsData) ? amsData.map((amsUnit, index) => (
              <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', minWidth: '300px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>AMS {amsUnit.id !== undefined ? parseInt(amsUnit.id) + 1 : index + 1}</h3>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', color: '#888' }}>
                    {amsUnit.humidity !== undefined && <span title="Humidity Index (1-5)">💧 {amsUnit.humidity}</span>}
                    {amsUnit.temp !== undefined && <span title="Internal Temperature">🌡️ {amsUnit.temp}°C</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {amsUnit.tray && amsUnit.tray.map((tray, tIndex) => {
                    const hasFilament = tray.tray_type && tray.tray_type !== '';
                    const hexColor = tray.tray_color ? `#${tray.tray_color.substring(0, 6)}` : '#333';
                    const trayId = `${amsUnit.id}-${tIndex}`;
                    const isActive = printState && printState.status === 'RUNNING' && printState.activeTrays && printState.activeTrays.includes(trayId);
                    return (
                      <div key={tIndex} style={{ 
                        flex: 1, 
                        textAlign: 'center',
                        backgroundColor: isActive ? `${hexColor}22` : (hasFilament ? 'rgba(255,255,255,0.03)' : 'transparent'),
                        padding: '10px 5px',
                        borderRadius: '6px',
                        border: isActive ? `2px solid ${hexColor}` : (hasFilament ? `1px solid ${hexColor}` : '1px dashed var(--border-color)'),
                        boxShadow: isActive ? `0 0 12px ${hexColor}66` : 'none',
                        transition: 'all 0.3s ease',
                        position: 'relative'
                      }}>
                        {isActive && (
                          <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', backgroundColor: hexColor, color: '#000', fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
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
                          return (
                            <div>
                              {assignedSpool ? (
                                <div style={{ fontSize: '0.75rem', marginBottom: '5px', color: isActive ? hexColor : 'var(--primary-color)', fontWeight: isActive ? 'bold' : 'normal' }}>
                                  {assignedSpool.brand_name} {assignedSpool.material_name}
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
