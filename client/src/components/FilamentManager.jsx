import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SpoolModal from './SpoolModal';
import { io } from 'socket.io-client';

function FilamentManager() {
  const [spools, setSpools] = useState([]);
  const [brands, setBrands] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [amsData, setAmsData] = useState(null);
  const [amsAssignments, setAmsAssignments] = useState({});
  const [settings, setSettings] = useState({});
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpool, setEditingSpool] = useState(null);
  const [filter, setFilter] = useState('Active'); // Active, Archived, All, Used, New, Low Stock
  const [viewMode, setViewMode] = useState(localStorage.getItem('fm_view_mode') || 'table');
  const [showStats, setShowStats] = useState(false);
  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem('fm_sort_config');
    return saved ? JSON.parse(saved) : { key: 'id', direction: 'desc' };
  });
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('fm_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('fm_sort_config', JSON.stringify(sortConfig));
  }, [sortConfig]);

  useEffect(() => {
    fetchData();
    fetchAms();
    const socket = io();

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
      const [spoolsRes, brandsRes, materialsRes] = await Promise.all([
        axios.get('/api/spools'),
        axios.get('/api/brands'),
        axios.get('/api/materials')
      ]);
      setSpools(spoolsRes.data);
      setBrands(brandsRes.data);
      setMaterials(materialsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAms = async () => {
    try {
      const [amsRes, assignRes, settingsRes] = await Promise.all([
        axios.get('/api/ams'),
        axios.get('/api/ams/assignments'),
        axios.get('/api/settings')
      ]);
      setAmsData(amsRes.data);
      setAmsAssignments(assignRes.data);
      setSettings(settingsRes.data);
    } catch (err) {}
  };

  const handleAssignAms = async (trayId, spoolId) => {
    try {
      await axios.post('/api/ams/assignments', { tray_id: trayId, spool_id: spoolId });
      fetchAms();
    } catch (err) {
      alert('Failed to assign spool to AMS');
    }
  };

  const handleDeleteSpool = async (id) => {
    if (!window.confirm('Are you sure you want to delete this spool? This cannot be undone.')) return;
    try {
      await axios.delete(`/api/spools/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete spool');
    }
  };

  const handleArchiveToggle = async (spool) => {
    try {
      await axios.put(`/api/spools/${spool.id}/archive`, { archived: !spool.archived });
      fetchData();
    } catch (err) {
      alert('Failed to update archive status');
    }
  };

  const handleExportCSV = () => {
    window.location.href = '/api/export/csv';
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      await axios.post('/api/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('CSV imported successfully!');
      fetchData();
    } catch (err) {
      alert('Failed to import CSV: ' + (err.response?.data?.error || err.message));
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Stats Calculations
  const activeSpools = spools.filter(s => !s.archived);
  const totalInventoryWeight = activeSpools.reduce((acc, s) => acc + (s.total_weight - s.used_weight), 0);
  const totalConsumedWeight = spools.reduce((acc, s) => acc + s.used_weight, 0);
  const lowStockCount = activeSpools.filter(s => ((s.total_weight - s.used_weight) / (s.total_weight || 1)) < 0.2).length;
  
  // Material breakdown
  const materialStats = {};
  activeSpools.forEach(s => {
    const matName = s.material_name || 'Unknown';
    if (!materialStats[matName]) materialStats[matName] = { weight: 0, color: s.color };
    materialStats[matName].weight += (s.total_weight - s.used_weight);
  });

  const getAmsLocation = (spoolId) => {
    for (const [trayId, sId] of Object.entries(amsAssignments)) {
      if (sId == spoolId) {
        const parts = trayId.split('-');
        if (parts.length === 2) {
          const amsId = parts[0];
          const slotNum = parseInt(parts[1]) + 1;
          const customName = settings[`ams_name_${amsId}`];
          if (customName) return `${customName} - Slot ${slotNum}`;
          
          if (amsId === "128" || amsId === "255") return `External Spool`;
          
          // Fallback logic
          const amsNum = parseInt(amsId) === 0 ? 1 : Math.floor(parseInt(amsId) / 4) + 1;
          return `AMS ${amsNum} Slot ${slotNum}`;
        }
        return trayId;
      }
    }
    return null;
  };

  // Filtering Logic
  let filteredSpools = spools;
  if (filter === 'Active') filteredSpools = spools.filter(s => !s.archived);
  else if (filter === 'Archived') filteredSpools = spools.filter(s => s.archived);
  else if (filter === 'Used') filteredSpools = spools.filter(s => !s.archived && s.used_weight > 0);
  else if (filter === 'New') filteredSpools = spools.filter(s => !s.archived && s.used_weight === 0);
  else if (filter === 'Low Stock') filteredSpools = activeSpools.filter(s => ((s.total_weight - s.used_weight) / (s.total_weight || 1)) < 0.2);

  // Sorting Logic
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedSpools = [...filteredSpools].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    // Handle derived or null values
    if (sortConfig.key === 'remaining') {
      aVal = a.total_weight - a.used_weight;
      bVal = b.total_weight - b.used_weight;
    } else if (sortConfig.key === 'cost') {
      aVal = a.cost || 0;
      bVal = b.cost || 0;
    } else if (sortConfig.key === 'last_used_at') {
      aVal = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
      bVal = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
    } else if (sortConfig.key === 'created_at') {
      aVal = new Date(a.created_at).getTime();
      bVal = new Date(b.created_at).getTime();
    }
    
    if (aVal === undefined || aVal === null) aVal = '';
    if (bVal === undefined || bVal === null) bVal = '';

    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ label, sortKey }) => (
    <th onClick={() => handleSort(sortKey)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}
        <span style={{ opacity: sortConfig.key === sortKey ? 1 : 0.2, fontSize: '0.8rem' }}>
          {sortConfig.key === sortKey && sortConfig.direction === 'desc' ? '▼' : '▲'}
        </span>
      </div>
    </th>
  );

  return (
    <div className="filament-manager">
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Spool Inventory</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Filament Manager</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Track your spools, costs, and weights.</div>
          </div>
          <div className="fm-actions">
            <button className="btn-secondary" onClick={() => setShowStats(!showStats)} style={{ marginRight: '10px' }}>
              {showStats ? 'Hide Stats ▲' : 'Show Stats ▼'}
            </button>
            <div className="view-toggle">
              <button className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>≣</button>
              <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
            </div>
            <input type="file" accept=".csv" ref={fileInputRef} style={{display: 'none'}} onChange={handleImportCSV} />
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>Import CSV</button>
            <button className="btn-secondary" onClick={handleExportCSV}>Export CSV</button>
            <button className="btn-primary" onClick={() => { setEditingSpool(null); setIsModalOpen(true); }}>+ Add Spool</button>
          </div>
        </div>
      </div>

      <div className={`stats-grid-wrapper ${showStats ? 'open' : ''}`}>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">TOTAL INVENTORY</div>
            <div className="stat-value">{(totalInventoryWeight / 1000).toFixed(1)}kg</div>
            <div className="stat-subtitle">{activeSpools.length} spools</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">TOTAL CONSUMED</div>
            <div className="stat-value">{(totalConsumedWeight / 1000).toFixed(1)}kg</div>
            <div className="stat-subtitle">Since tracking started</div>
          </div>
          <div className="stat-card" style={{ flex: 2 }}>
            <div className="stat-title">BY MATERIAL</div>
            <div className="stat-materials">
              {Object.entries(materialStats).map(([mat, data]) => (
                <span key={mat} className="material-badge" style={{borderColor: data.color}}>
                  <span style={{color: data.color, fontWeight: 'bold'}}>{mat}</span> {(data.weight/1000).toFixed(1)}kg
                </span>
              ))}
            </div>
          </div>
          <div className="stat-card" style={{ borderRight: '3px solid #ff9800' }}>
            <div className="stat-title" style={{color: '#ff9800'}}>LOW STOCK</div>
            <div className="stat-value" style={{color: '#ff9800'}}>{lowStockCount}</div>
            <div className="stat-subtitle">&lt; 20% remaining</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {['Active', 'Archived', 'All', 'Used', 'New', 'Low Stock'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {viewMode === 'table' ? (
        <div className="table-container">
          <table className="fm-table">
            <thead>
              <tr>
                <SortHeader label="ID" sortKey="id" />
                <SortHeader label="ADDED" sortKey="created_at" />
                <SortHeader label="LAST USED" sortKey="last_used_at" />
                <SortHeader label="COLOR" sortKey="color" />
                <SortHeader label="MATERIAL" sortKey="material_name" />
                <SortHeader label="SUBTYPE" sortKey="subtype" />
                <SortHeader label="BRAND" sortKey="brand_name" />
                <th>LOCATION</th>
                <SortHeader label="NET" sortKey="total_weight" />
                <SortHeader label="COST" sortKey="cost" />
                <SortHeader label="REMAINING" sortKey="remaining" />
                <th style={{textAlign: 'right'}}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sortedSpools.map(spool => {
                const remaining = spool.total_weight - spool.used_weight;
                const remainingPct = Math.max(0, Math.min(100, (remaining / spool.total_weight) * 100));
                let pbColor = '#4caf50';
                if (remainingPct < 20) pbColor = '#f44336';
                else if (remainingPct < 40) pbColor = '#ff9800';

                return (
                  <tr key={spool.id} className={spool.archived ? 'archived-row' : ''}>
                    <td>{spool.id}</td>
                    <td>{new Date(spool.created_at).toLocaleDateString()}</td>
                    <td title={spool.last_print_name || ''}>
                      {spool.last_used_at ? new Date(spool.last_used_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td><div className="color-dot" style={{backgroundColor: spool.color}}></div></td>
                    <td>{spool.material_name}</td>
                    <td>{spool.subtype || 'Basic'}</td>
                    <td>{spool.brand_name}</td>
                    <td style={{color: '#b388ff'}}>{getAmsLocation(spool.id) || spool.location || '-'}</td>
                    <td>{spool.total_weight}g</td>
                    <td>£{spool.cost?.toFixed(2) || '0.00'}</td>
                    <td style={{width: '150px'}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', minWidth: '40px' }}>{remaining.toFixed(0)}g</span>
                        <div className="progress-bar-container" style={{ flex: 1 }}>
                          <div className="progress-bar" style={{width: `${remainingPct}%`, backgroundColor: pbColor}}></div>
                        </div>
                      </div>
                    </td>
                    <td style={{textAlign: 'right'}}>
                      <div className="row-actions">
                        <button onClick={() => { setEditingSpool(spool); setIsModalOpen(true); }} title="Edit">✎</button>
                        <button onClick={() => handleArchiveToggle(spool)} title={spool.archived ? "Unarchive" : "Archive"}>
                          {spool.archived ? '📦↑' : '📦↓'}
                        </button>
                        <button onClick={() => handleDeleteSpool(spool.id)} className="danger" title="Delete">🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedSpools.length === 0 && (
                <tr><td colSpan="12" style={{textAlign: 'center', padding: '20px', color: '#888'}}>No spools found for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="spool-grid">
          {sortedSpools.map(spool => {
            const remaining = spool.total_weight - spool.used_weight;
            const remainingPct = Math.max(0, Math.min(100, (remaining / spool.total_weight) * 100));
            let pbColor = '#4caf50';
            if (remainingPct < 20) pbColor = '#f44336';
            else if (remainingPct < 40) pbColor = '#ff9800';
            
            return (
              <div key={spool.id} className={`spool-card ${spool.archived ? 'archived-card' : ''}`}>
                <div className="spool-card-graphic" style={{ backgroundColor: spool.color }}>
                  <div className="spool-card-hole"></div>
                </div>
                
                <div className="spool-card-content">
                  <div className="spool-card-header">
                    <div className="spool-title">{spool.brand_name} {spool.material_name}</div>
                    <div className="spool-subtitle">{spool.subtype || 'Basic'} • {spool.color_name || 'Unknown Color'}</div>
                  </div>
                  
                  <div className="spool-card-stats">
                    <div className="stat">
                      <span className="label">Remaining</span>
                      <span className="value">{remaining.toFixed(0)}g</span>
                    </div>
                    <div className="stat">
                      <span className="label">Location</span>
                      <span className="value" style={{color: '#b388ff'}}>{getAmsLocation(spool.id) || spool.location || '-'}</span>
                    </div>
                  </div>

                  <div className="spool-card-progress">
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{width: `${remainingPct}%`, backgroundColor: pbColor}}></div>
                    </div>
                  </div>
                </div>

                <div className="spool-card-actions">
                  <button onClick={() => { setEditingSpool(spool); setIsModalOpen(true); }} title="Edit">✎ Edit</button>
                  <button onClick={() => handleArchiveToggle(spool)} title={spool.archived ? "Unarchive" : "Archive"}>
                    {spool.archived ? '📦 Restore' : '📦 Archive'}
                  </button>
                </div>
              </div>
            );
          })}
          {sortedSpools.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#888', backgroundColor: 'var(--card-bg)', borderRadius: '12px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px', opacity: 0.5 }}>🧵</div>
              <div style={{ fontSize: '1.2rem' }}>No spools found for this filter.</div>
            </div>
          )}
        </div>
      )}

      <SpoolModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        editingSpool={editingSpool} 
        brands={brands} 
        materials={materials} 
        onSave={fetchData} 
      />
    </div>
  );
}

export default FilamentManager;
