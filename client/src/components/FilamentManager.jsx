import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SpoolModal from './SpoolModal';

function FilamentManager() {
  const [spools, setSpools] = useState([]);
  const [brands, setBrands] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [amsData, setAmsData] = useState(null);
  const [amsAssignments, setAmsAssignments] = useState({});
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpool, setEditingSpool] = useState(null);
  const [filter, setFilter] = useState('Active'); // Active, Archived, All, Used, New, Low Stock
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchAms, 5000);
    return () => clearInterval(interval);
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
      const [amsRes, assignRes] = await Promise.all([
        axios.get('/api/ams'),
        axios.get('/api/ams/assignments')
      ]);
      setAmsData(amsRes.data);
      setAmsAssignments(assignRes.data);
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

  // Filtering Logic
  let filteredSpools = spools;
  if (filter === 'Active') filteredSpools = spools.filter(s => !s.archived);
  else if (filter === 'Archived') filteredSpools = spools.filter(s => s.archived);
  else if (filter === 'Used') filteredSpools = spools.filter(s => !s.archived && s.used_weight > 0);
  else if (filter === 'New') filteredSpools = spools.filter(s => !s.archived && s.used_weight === 0);
  else if (filter === 'Low Stock') filteredSpools = activeSpools.filter(s => ((s.total_weight - s.used_weight) / (s.total_weight || 1)) < 0.2);

  return (
    <div className="filament-manager">
      <div className="fm-header">
        <div>
          <h1 style={{margin: '0 0 5px 0', fontSize: '1.5rem'}}>Spool Inventory</h1>
          <p style={{margin: 0, color: '#888', fontSize: '0.9rem'}}>Manage your spools</p>
        </div>
        <div className="fm-actions">
          <input type="file" accept=".csv" ref={fileInputRef} style={{display: 'none'}} onChange={handleImportCSV} />
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>Import CSV</button>
          <button className="btn-secondary" onClick={handleExportCSV}>Export CSV</button>
          <button className="btn-primary" onClick={() => { setEditingSpool(null); setIsModalOpen(true); }}>+ Add Spool</button>
        </div>
      </div>

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

      <div className="tabs">
        {['Active', 'Archived', 'All', 'Used', 'New', 'Low Stock'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="fm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>ADDED</th>
              <th>LAST USED</th>
              <th>COLOR</th>
              <th>MATERIAL</th>
              <th>SUBTYPE</th>
              <th>BRAND</th>
              <th>LOCATION</th>
              <th>LABEL WEIGHT</th>
              <th>NET</th>
              <th>COST PER KG</th>
              <th>REMAINING</th>
              <th style={{textAlign: 'right'}}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredSpools.map(spool => {
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
                  <td style={{color: '#b388ff'}}>{spool.location || '-'}</td>
                  <td>{spool.total_weight}g</td>
                  <td>{remaining.toFixed(0)}g</td>
                  <td>£{spool.cost?.toFixed(2) || '0.00'}</td>
                  <td style={{width: '150px'}}>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{width: `${remainingPct}%`, backgroundColor: pbColor}}></div>
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
            {filteredSpools.length === 0 && (
              <tr><td colSpan="13" style={{textAlign: 'center', padding: '20px', color: '#888'}}>No spools found for this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
