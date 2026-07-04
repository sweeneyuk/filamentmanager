import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAlert } from '../contexts/AlertContext';

function Archive() {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const { showAlert } = useAlert();
  const [selectedArchives, setSelectedArchives] = useState([]);

  const handleToggleSelect = (id) => {
    setSelectedArchives(prev =>
      prev.includes(id) ? prev.filter(spoolId => spoolId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedArchives.length === archives.length) {
      setSelectedArchives([]);
    } else {
      setSelectedArchives(archives.map(a => a.id));
    }
  };

  const handleBulkDelete = () => {
    showAlert('Delete Selected Archives?', `Are you sure you want to delete ${selectedArchives.length} archived print(s)? This will also permanently delete the associated timelapse videos and photos from the server. This action cannot be undone.`, async () => {
      try {
        for (const id of selectedArchives) {
          await axios.delete(`/api/archives/${id}`);
        }
        setSelectedArchives([]);
        fetchArchives();
      } catch (err) {
        console.error(err);
        showAlert('Error', 'Failed to delete some archives: ' + err.message);
      }
    });
  };

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      const res = await axios.get('/api/archives');
      setArchives(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteArchive = (id) => {
    showAlert('Delete Archive?', 'Are you sure you want to delete this archived print? This will also permanently delete the associated timelapse video and photos from the server. This action cannot be undone.', async () => {
      try {
        await axios.delete(`/api/archives/${id}`);
        fetchArchives();
      } catch (err) {
        console.error(err);
        showAlert('Error', 'Failed to delete archive: ' + err.message);
      }
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getStatusBadge = (status) => {
    let bg = 'rgba(255,255,255,0.1)';
    let color = '#ccc';
    if (status === 'FINISH' || status === 'COMPLETED') {
      bg = 'rgba(0,174,66,0.15)';
      color = '#4ade80';
    } else if (status === 'FAILED') {
      bg = 'rgba(220,53,69,0.15)';
      color = '#f87171';
    } else if (status === 'RUNNING') {
      bg = 'rgba(13,110,253,0.15)';
      color = '#60a5fa';
    }
    return (
      <span style={{ 
        padding: '4px 10px', 
        borderRadius: '12px', 
        fontSize: '0.75rem', 
        fontWeight: 'bold', 
        backgroundColor: bg, 
        color: color, 
        letterSpacing: '0.5px' 
      }}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div className="card title-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Print Archive</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>History & Logs</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>View past prints, costs, and timelapse media.</div>
          </div>
        </div>
      </div>
      
      {selectedArchives.length > 0 && (
        <div className="bulk-actions-bar" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'var(--card-bg)', padding: '12px 20px', borderRadius: '8px',
          marginBottom: '20px', border: '1px solid var(--border-color)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
              {selectedArchives.length} selected
            </span>
            <button onClick={handleSelectAll} style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', padding: '4px 10px', fontSize: '0.85rem' }}>
              {selectedArchives.length === archives.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleBulkDelete} style={{ backgroundColor: 'var(--danger-color)', padding: '6px 15px' }}>
              Delete Selected
            </button>
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '24px',
        padding: '10px 0'
      }}>
        {archives.map(arch => {
          const d = new Date(arch.created_at);
          // If the final photo wasn't extracted successfully, fallback to thumbnail for the modal
          const modalPhoto = arch.photo_path || arch.thumbnail_path;
          const isSelected = selectedArchives.includes(arch.id);
          
          return (
            <div 
              key={arch.id} 
              className={`card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleToggleSelect(arch.id)}
              style={{ 
                padding: 0, 
                overflow: 'hidden', 
                display: 'flex', 
                flexDirection: 'column',
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                transition: 'border-color 0.2s ease'
              }}
            >
              
              {/* Thumbnail Header Area */}
              <div style={{ position: 'relative', width: '100%', height: '220px', backgroundColor: 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {arch.thumbnail_path ? (
                  <img 
                    src={arch.thumbnail_path} 
                    alt="Print Thumbnail" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ fontSize: '3rem', opacity: 0.2 }}>🖨️</div>
                )}
                
                {/* Media Overlay Buttons */}
                <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', gap: '8px' }}>
                  {arch.timelapse_path && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVideo(arch.timelapse_path);
                      }}
                      style={{ 
                        backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', backdropFilter: 'blur(4px)', zIndex: 10
                      }}>
                      🎥 Video
                    </button>
                  )}
                  {modalPhoto && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPhoto(modalPhoto);
                      }}
                      style={{ 
                        backgroundColor: 'rgba(0,255,136,0.2)', color: '#fff', border: '1px solid rgba(0,255,136,0.4)', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', backdropFilter: 'blur(4px)', zIndex: 10
                      }}>
                      📸 Photo
                    </button>
                  )}
                </div>
                
                {/* Multi-Select Checkbox */}
                <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}>
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => handleToggleSelect(arch.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* Status Badge */}
                <div style={{ position: 'absolute', top: '10px', left: '40px' }}>
                  {getStatusBadge(arch.status)}
                </div>

                {/* Delete Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteArchive(arch.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    backgroundColor: 'rgba(220,53,69,0.8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    fontSize: '0.9rem',
                    zIndex: 10
                  }}
                  title="Delete Archive"
                >
                  🗑️
                </button>
              </div>

              {/* Details Content */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                
                {/* Title and Time */}
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', wordBreak: 'break-word' }}>{arch.print_name || 'Unknown'}</h3>
                  <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{d.toLocaleDateString()} {d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span>⏱️ {formatDuration(arch.duration_seconds)}</span>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0' }} />

                {/* Spools Used */}
                <div style={{ fontSize: '0.85rem' }}>
                  <div style={{ color: '#888', marginBottom: '6px' }}>Filament Used:</div>
                  {arch.spools_used && arch.spools_used.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {arch.spools_used.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: s.color || '#888', display: 'inline-block', flexShrink: 0 }}></span>
                            <span>{s.brand} {s.material}</span>
                          </div>
                          {s.weight_used_g && <span style={{ color: '#888' }}>{s.weight_used_g.toFixed(1)}g</span>}
                        </div>
                      ))}
                    </div>
                  ) : <span style={{ color: '#555' }}>None recorded</span>}
                </div>

                {/* AI Analysis Section */}
                {arch.ai_analysis && (() => {
                  let ai = null;
                  try { ai = JSON.parse(arch.ai_analysis); } catch(e){}
                  if (!ai) return null;
                  
                  let bgColor = 'rgba(255,255,255,0.05)';
                  let color = '#ccc';
                  let icon = '🤖';
                  
                  if (ai.status === 'SUCCESS') {
                    bgColor = 'rgba(0,174,66,0.1)';
                    color = '#4ade80';
                    icon = '✨';
                  } else if (ai.status === 'SPAGHETTI') {
                    bgColor = 'rgba(220,53,69,0.15)';
                    color = '#f87171';
                    icon = '🍝';
                  } else if (ai.status === 'STRINGING') {
                    bgColor = 'rgba(255,193,7,0.15)';
                    color = '#fbbf24';
                    icon = '🕸️';
                  } else if (ai.status === 'WARPED' || ai.status === 'LAYER_SHIFT') {
                    bgColor = 'rgba(255,153,0,0.15)';
                    color = '#f97316';
                    icon = '⚠️';
                  }

                  return (
                    <div style={{ backgroundColor: bgColor, border: `1px solid ${color}40`, padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: color, marginBottom: '4px' }}>
                        <span>{icon}</span> AI Analysis: {ai.status}
                      </div>
                      <div style={{ color: '#ccc', fontStyle: 'italic', lineHeight: '1.4' }}>
                        "{ai.reason}"
                      </div>
                    </div>
                  );
                })()}

                <div style={{ flex: 1 }}></div>

                {/* Cost Breakdown */}
                <div style={{ backgroundColor: 'var(--secondary-bg)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#888' }}>⚡ Energy ({arch.energy_kwh?.toFixed(3) || '0.00'} kWh)</span>
                    <span>£{arch.energy_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#888' }}>🧵 Filament</span>
                    <span>£{arch.filament_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    <span>Total Cost</span>
                    <span>£{arch.total_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
        {archives.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888', padding: '40px 20px', backgroundColor: 'var(--card-bg)', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px', opacity: 0.5 }}>🖨️</div>
            <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>No prints archived yet</div>
            <div>Once configured, prints will automatically appear here.</div>
          </div>
        )}
      </div>

      {selectedVideo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setSelectedVideo(null)}>
          <div style={{
            position: 'relative',
            width: '80%',
            maxWidth: '1000px',
            backgroundColor: 'var(--card-bg)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedVideo(null)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'rgba(0,0,0,0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              ✕
            </button>
            <video 
              src={selectedVideo} 
              controls 
              autoPlay 
              style={{ width: '100%', maxHeight: '80vh', display: 'block' }} 
            />
          </div>
        </div>
      )}

      {selectedPhoto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setSelectedPhoto(null)}>
          <div style={{
            position: 'relative',
            width: '80%',
            maxWidth: '1000px',
            backgroundColor: 'var(--card-bg)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedPhoto(null)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'rgba(0,0,0,0.5)',
                color: 'white',
                border: 'none',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                fontSize: '1.2rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              ×
            </button>
            <img 
              src={selectedPhoto} 
              alt="Print Photo"
              style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Archive;
