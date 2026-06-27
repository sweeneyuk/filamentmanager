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
    const interval = setInterval(fetchData, 5000);
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
        <div className="stat-card" style={{ marginBottom: '20px', backgroundColor: 'rgba(0, 200, 83, 0.05)', borderColor: 'var(--primary-color)' }}>
          <div className="stat-title" style={{ color: 'var(--primary-color)' }}>CURRENT PRINT ({printState.status})</div>
          <div className="stat-value">{printState.name || 'Unknown Print'}</div>
          <div className="stat-subtitle">Started: {printState.startTime ? new Date(printState.startTime).toLocaleTimeString() : 'N/A'}</div>
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
