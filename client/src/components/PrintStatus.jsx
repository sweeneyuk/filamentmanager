import { useState, useEffect } from 'react';
import axios from 'axios';
import namer from 'color-namer';

function PrintStatus() {
  const [amsData, setAmsData] = useState(null);
  const [amsAssignments, setAmsAssignments] = useState({});
  const [spools, setSpools] = useState([]);
  const [printState, setPrintState] = useState(null);

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
      <div className="fm-header">
        <div>
          <h1 style={{margin: '0 0 5px 0', fontSize: '1.5rem'}}>Print Status</h1>
          <p style={{margin: 0, color: '#888', fontSize: '0.9rem'}}>Live AMS tracking</p>
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
            <div style={{ flex: 1, backgroundColor: 'var(--secondary-bg)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>Nozzle Temp</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.nozzleTemp || 0}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {printState.nozzleTarget || 0}°C</span></div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--secondary-bg)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>Bed Temp</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{printState.bedTemp || 0}°C <span style={{fontSize: '0.9rem', color: '#666', fontWeight: 'normal'}}>/ {printState.bedTarget || 0}°C</span></div>
            </div>
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
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>AMS {amsUnit.id || index + 1}</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {amsUnit.tray && amsUnit.tray.map((tray, tIndex) => {
                    const hasFilament = tray.tray_type && tray.tray_type !== '';
                    const hexColor = tray.tray_color ? `#${tray.tray_color.substring(0, 6)}` : '#333';
                    return (
                      <div key={tIndex} style={{ 
                        flex: 1, 
                        textAlign: 'center',
                        backgroundColor: hasFilament ? 'rgba(255,255,255,0.03)' : 'transparent',
                        padding: '10px 5px',
                        borderRadius: '6px',
                        border: hasFilament ? `1px solid ${hexColor}` : '1px dashed var(--border-color)'
                      }}>
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '50%', 
                          backgroundColor: hasFilament ? hexColor : '#222',
                          margin: '0 auto 10px auto'
                        }}></div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {hasFilament ? tray.tray_type : 'Empty'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '10px' }}>
                          Slot {tIndex + 1}
                        </div>
                        <select 
                          style={{ width: '100%', fontSize: '0.75rem', padding: '4px' }}
                          value={amsAssignments[`${amsUnit.id}-${tIndex}`] || ''}
                          onChange={(e) => handleAssignAms(`${amsUnit.id}-${tIndex}`, e.target.value)}
                        >
                          <option value="">-- Assign --</option>
                          {spools.map(s => {
                            const rem = s.total_weight - s.used_weight;
                            let colorText = '';
                            if (s.color_name) {
                              colorText = s.color_name;
                            } else {
                              try {
                                if (s.color) {
                                  const names = namer(s.color);
                                  colorText = names.basic[0].name; // e.g. "red", "black"
                                  colorText = colorText.charAt(0).toUpperCase() + colorText.slice(1);
                                }
                              } catch (e) {
                                colorText = 'Unknown';
                              }
                            }
                            let subtypeText = '';
                            if (s.subtype && s.subtype.toLowerCase() !== 'basic') {
                              subtypeText = `(${s.subtype})`;
                            }

                            return (
                              <option key={s.id} value={s.id}>
                                {s.brand_name} {s.material_name} {colorText} {subtypeText} - {rem.toFixed(0)}g
                              </option>
                            );
                          })}
                        </select>
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
    </div>
  );
}

export default PrintStatus;
