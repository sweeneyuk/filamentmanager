import { useState, useEffect } from 'react';
import axios from 'axios';

function Archive() {
  const [archives, setArchives] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);

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
      
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="fm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Print Name</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Energy (kWh)</th>
                <th>Spool</th>
                <th>Energy Cost</th>
                <th>Total Cost</th>
                <th>Media</th>
              </tr>
            </thead>
            <tbody>
              {archives.map(arch => {
                const d = new Date(arch.created_at);
                return (
                <tr key={arch.id}>
                  <td>
                    <div style={{ fontWeight: '500' }}>{d.toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </td>
                  <td style={{ fontWeight: '500' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {arch.photo_path ? (
                        <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--secondary-bg)', flexShrink: 0 }}>
                          <img src={arch.photo_path} alt="Print thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '4px', backgroundColor: 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🖨️</span>
                        </div>
                      )}
                      <span>{arch.print_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td>{getStatusBadge(arch.status)}</td>
                  <td>{formatDuration(arch.duration_seconds)}</td>
                <td>{arch.energy_kwh?.toFixed(3) || '0.000'}</td>
                <td>
                  {arch.spools_used && arch.spools_used.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {arch.spools_used.map((s, i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: s.color || '#888', display: 'inline-block', flexShrink: 0 }}></span>
                          <span style={{ fontSize: '0.85rem' }}>{s.brand} {s.material}</span>
                          {s.weight_used_g && <span style={{ fontSize: '0.75rem', color: '#888' }}>({s.weight_used_g.toFixed(1)}g)</span>}
                        </span>
                      ))}
                    </div>
                  ) : '-'}
                </td>
                <td>£{arch.energy_cost?.toFixed(2) || '0.00'}</td>
                <td style={{fontWeight: 'bold', color: 'var(--primary-color)'}}>
                  £{arch.total_cost?.toFixed(2) || '0.00'}
                </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {arch.photo_path && (
                        <a href={arch.photo_path} target="_blank" rel="noreferrer" style={{ 
                          color: 'var(--primary-color)', textDecoration: 'none', backgroundColor: 'rgba(0,255,136,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' 
                        }}>
                          📸 Photo
                        </a>
                      )}
                      {arch.timelapse_path && (
                        <button 
                          onClick={() => setSelectedVideo(arch.timelapse_path)}
                          style={{ 
                            color: '#fff', border: 'none', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' 
                          }}>
                          🎥 Video
                        </button>
                      )}
                      {!arch.photo_path && !arch.timelapse_path && <span style={{color: '#666', fontSize: '0.85rem'}}>None</span>}
                    </div>
                  </td>
                </tr>
                );
              })}
            {archives.length === 0 && (
              <tr>
                <td colSpan="9" style={{textAlign: 'center', color: '#888', padding: '40px 20px'}}>
                  <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>No prints archived yet</div>
                  <div>Once configured, prints will automatically appear here.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
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
    </div>
  );
}

export default Archive;
