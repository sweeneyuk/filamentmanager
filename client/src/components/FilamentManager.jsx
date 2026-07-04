import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SpoolModal from './SpoolModal';
import { io } from 'socket.io-client';
import { useAlert } from '../contexts/AlertContext';

function FilamentManager() {
  const { showAlert, showConfirm } = useAlert();
  const [selectedSpoolIds, setSelectedSpoolIds] = useState([]);
  const [spools, setSpools] = useState([]);
  const [brands, setBrands] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [totalConsumedWeight, setTotalConsumedWeight] = useState(0);
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
      const [spoolsRes, brandsRes, materialsRes, analyticsRes] = await Promise.all([
        axios.get('/api/spools'),
        axios.get('/api/brands'),
        axios.get('/api/materials'),
        axios.get('/api/analytics')
      ]);
      setSpools(spoolsRes.data);
      setBrands(brandsRes.data);
      setMaterials(materialsRes.data);
      
      const totalWeightG = analyticsRes.data.reduce((acc, print) => acc + (print.filament_used_g || 0), 0);
      setTotalConsumedWeight(totalWeightG);
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
      showAlert('Error', 'Failed to assign spool to AMS', true);
    }
  };

  const handleDeleteSpool = (id) => {
    showConfirm('Delete Spool', 'Are you sure you want to delete this spool? This cannot be undone.', async () => {
      try {
        await axios.delete(`/api/spools/${id}`);
        setSelectedSpoolIds(prev => prev.filter(sId => sId !== id));
        fetchData();
      } catch (err) {
        showAlert('Error', 'Failed to delete spool', true);
      }
    }, true);
  };

  const handleArchiveToggle = async (spool) => {
    try {
      await axios.put(`/api/spools/${spool.id}/archive`, { archived: !spool.archived });
      fetchData();
    } catch (err) {
      showAlert('Error', 'Failed to update archive status', true);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedSpoolIds.length === 0) return;
    
    if (action === 'delete') {
      showConfirm('Delete Selected', `Are you sure you want to delete ${selectedSpoolIds.length} spools? This cannot be undone.`, async () => {
        try {
          await Promise.all(selectedSpoolIds.map(id => axios.delete(`/api/spools/${id}`)));
          setSelectedSpoolIds([]);
          fetchData();
          showAlert('Success', 'Selected spools deleted successfully.');
        } catch (err) {
          showAlert('Error', 'Failed to delete some spools.', true);
        }
      }, true);
    } else if (action === 'archive' || action === 'unarchive') {
      const archived = action === 'archive';
      try {
        await Promise.all(selectedSpoolIds.map(id => axios.put(`/api/spools/${id}/archive`, { archived })));
        setSelectedSpoolIds([]);
        fetchData();
      } catch (err) {
        showAlert('Error', `Failed to ${action} spools.`, true);
      }
    } else if (action === 'location') {
      const newLoc = window.prompt("Enter new location for selected spools (e.g. Shelf B):");
      if (newLoc === null) return; // cancelled
      try {
        await Promise.all(selectedSpoolIds.map(async id => {
          const spool = spools.find(s => s.id === id);
          if (spool) {
            await axios.put(`/api/spools/${id}`, { ...spool, location: newLoc });
          }
        }));
        setSelectedSpoolIds([]);
        fetchData();
      } catch (err) {
        showAlert('Error', 'Failed to update locations.', true);
      }
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
      showAlert('Success', 'CSV imported successfully!');
      fetchData();
    } catch (err) {
      showAlert('Error', 'Failed to import CSV: ' + (err.response?.data?.error || err.message), true);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Stats Calculations
  const activeSpools = spools.filter(s => !s.archived);
  const totalInventoryWeight = activeSpools.reduce((acc, s) => acc + (s.total_weight - s.used_weight), 0);
  const lowStockThreshold = settings.low_stock_threshold ? parseInt(settings.low_stock_threshold) : 200;
  const isLowStock = (s) => (s.total_weight - s.used_weight) < lowStockThreshold;
  const lowStockCount = activeSpools.filter(isLowStock).length;
  const restockSpools = activeSpools.filter(s => isLowStock(s) && s.shopify_variant_id);
  
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
  else if (filter === 'Low Stock') filteredSpools = activeSpools.filter(isLowStock);

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

  const getBambuProductUrl = (spool) => {
    if (!spool.shopify_variant_id) return null;
    if (spool.shopify_variant_id.startsWith('http')) {
      return spool.shopify_variant_id;
    }
    const baseUrl = settings.bambu_store_region || 'https://uk.store.bambulab.com';
    const mat = (spool.material_name || '').toLowerCase();
    const sub = (spool.subtype || 'basic').toLowerCase();
    let slug = `${mat}-${sub}`;
    if (slug === 'pla-basic') slug = 'pla-basic-filament';
    return `${baseUrl}/products/${slug}?variant=${spool.shopify_variant_id}`;
  };

  return (
    <div className="filament-manager">
      <div className="card title-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
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

      {selectedSpoolIds.length > 0 && (
        <div className="card bulk-actions-bar">
          <div>
            <strong style={{ color: 'var(--primary-color)' }}>{selectedSpoolIds.length} spools selected</strong>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={() => handleBulkAction('location')}>Set Location</button>
            <button className="btn-secondary" onClick={() => handleBulkAction('archive')}>Archive</button>
            <button className="btn-secondary" onClick={() => handleBulkAction('unarchive')}>Unarchive</button>
            <button className="btn-secondary" style={{ color: '#f87171', borderColor: '#f87171' }} onClick={() => handleBulkAction('delete')}>Delete</button>
            <button className="btn-secondary" onClick={() => setSelectedSpoolIds([])}>Clear</button>
          </div>
        </div>
      )}

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
            <div className="stat-subtitle">&lt; {lowStockThreshold}g remaining</div>
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
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={sortedSpools.length > 0 && selectedSpoolIds.length === sortedSpools.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSpoolIds(sortedSpools.map(s => s.id));
                      } else {
                        setSelectedSpoolIds([]);
                      }
                    }}
                  />
                </th>
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
                  <tr key={spool.id} className={spool.archived ? 'archived-row' : ''} style={selectedSpoolIds.includes(spool.id) ? { backgroundColor: 'rgba(76, 175, 80, 0.1)' } : {}}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedSpoolIds.includes(spool.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSpoolIds(prev => [...prev, spool.id]);
                          else setSelectedSpoolIds(prev => prev.filter(id => id !== spool.id));
                        }}
                      />
                    </td>
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
                        {spool.shopify_variant_id && isLowStock && (
                          <button style={{ color: '#ff9800', borderColor: '#ff9800' }} onClick={() => window.open(getBambuProductUrl(spool), '_blank')} title="Restock Spool">🛒</button>
                        )}
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
            
            const isLowStock = remainingPct < 15 || remaining < 50;
            
            return (
              <div key={spool.id} className={`spool-card ${spool.archived ? 'archived-card' : ''}`} style={selectedSpoolIds.includes(spool.id) ? { border: '2px solid var(--primary-color)' } : isLowStock ? { border: '1px solid #f44336' } : {}}>
                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                  <input 
                    type="checkbox" 
                    checked={selectedSpoolIds.includes(spool.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedSpoolIds(prev => [...prev, spool.id]);
                      else setSelectedSpoolIds(prev => prev.filter(id => id !== spool.id));
                    }}
                    style={{ transform: 'scale(1.2)' }}
                  />
                </div>
                <div className="spool-card-graphic" style={{ backgroundColor: spool.color }}>
                  <div className="spool-card-hole"></div>
                </div>
                
                <div className="spool-card-content">
                  <div className="spool-card-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="spool-title">{spool.brand_name} {spool.material_name}</div>
                      {isLowStock && <span style={{ backgroundColor: 'rgba(244,67,54,0.2)', color: '#f87171', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(244,67,54,0.4)', fontWeight: 'bold' }}>Low Stock</span>}
                    </div>
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
                  {spool.shopify_variant_id && isLowStock && (
                    <button style={{color: '#ff9800', borderColor: '#ff9800'}} onClick={() => window.open(getBambuProductUrl(spool), '_blank')} title="Restock Spool">🛒 Restock</button>
                  )}
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
