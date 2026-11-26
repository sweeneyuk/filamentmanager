import { useState } from 'react';
import namer from 'color-namer';
import { Thermometer, Droplets, Edit2 } from 'lucide-react';

// Temporary: the old AMS block and assign pop-up, moved unchanged from PrintStatus.jsx.
// Replaced by AmsUnit, SlotButton and SlotPanel in Task 6.

const isColorDark = (hex) => {
  if (!hex) return true;
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.45;
};

export default function AmsLegacy({ printer, state, amsData, assignments, spools, settings, assign, renameUnit }) {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [activeTrayId, setActiveTrayId] = useState(null);
  const [activePrinterId, setActivePrinterId] = useState(null);
  const handleRenameAms = renameUnit;
  const handleAssignAms = assign;
  return (
    <>
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
                            const isActive = state?.activeTrays?.includes(trayId);
                            const isFeeding = state?.currentTrayId === trayId;
                            
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
    </>
  );
}
