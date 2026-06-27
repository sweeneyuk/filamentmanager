import { useState, useEffect } from 'react';
import axios from 'axios';

function Archive() {
  const [archives, setArchives] = useState([]);

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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div>
      <h2 style={{marginTop: 0}}>Print Archive</h2>
      
      <div className="card">
        <table>
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
            {archives.map(arch => (
              <tr key={arch.id}>
                <td>{new Date(arch.created_at).toLocaleString()}</td>
                <td>{arch.print_name || 'Unknown'}</td>
                <td>
                  <span style={{
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '0.8rem',
                    backgroundColor: arch.status === 'COMPLETED' ? 'rgba(0,174,66,0.2)' : 'rgba(255,255,255,0.1)',
                    color: arch.status === 'COMPLETED' ? '#00AE42' : '#fff'
                  }}>
                    {arch.status}
                  </span>
                </td>
                <td>{formatDuration(arch.duration_seconds)}</td>
                <td>{arch.energy_kwh?.toFixed(3) || '0.000'}</td>
                <td>
                  {arch.spool_id ? (
                    <span style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                      <span className="color-dot" style={{backgroundColor: arch.spool_color}}></span>
                      {arch.spool_brand}
                    </span>
                  ) : '-'}
                </td>
                <td>£{arch.energy_cost?.toFixed(2) || '0.00'}</td>
                <td style={{fontWeight: 'bold', color: 'var(--primary-color)'}}>
                  £{arch.total_cost?.toFixed(2) || '0.00'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {arch.photo_path && (
                      <a href={arch.photo_path} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>
                        📸 Photo
                      </a>
                    )}
                    {arch.timelapse_path && (
                      <a href={arch.timelapse_path} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>
                        🎥 Video
                      </a>
                    )}
                    {!arch.photo_path && !arch.timelapse_path && <span style={{color: '#666'}}>None</span>}
                  </div>
                </td>
              </tr>
            ))}
            {archives.length === 0 && (
              <tr>
                <td colSpan="9" style={{textAlign: 'center', color: '#888', padding: '20px'}}>
                  No prints archived yet. Once configured, prints will automatically appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Archive;
