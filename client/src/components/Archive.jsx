import { useState, useEffect } from 'react';
import axios from 'axios';

function Archive() {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

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
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Print Archive</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>History & Logs</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>View past prints, costs, and timelapse media.</div>
          </div>
        </div>
      </div>
      
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
          
          return (
            <div key={arch.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              
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
                      onClick={() => setSelectedVideo(arch.timelapse_path)}
                      style={{ 
                        backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', backdropFilter: 'blur(4px)'
                      }}>
                      🎥 Video
                    </button>
                  )}
                  {modalPhoto && (
                    <button 
                      onClick={() => setSelectedPhoto(modalPhoto)}
                      style={{ 
                        backgroundColor: 'rgba(0,255,136,0.2)', color: '#fff', border: '1px solid rgba(0,255,136,0.4)', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', backdropFilter: 'blur(4px)'
                      }}>
                      📸 Photo
                    </button>
                  )}
                </div>
                
                {/* Status Badge */}
                <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                  {getStatusBadge(arch.status)}
                </div>
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
