import { useState, useEffect } from 'react';
import axios from 'axios';

function FilamentManager() {
  const [spools, setSpools] = useState([]);
  const [brands, setBrands] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [amsData, setAmsData] = useState(null);
  
  const [newSpool, setNewSpool] = useState({
    brand_id: '',
    material_id: '',
    color: '#ffffff',
    cost: '',
    total_weight: 1000,
    empty_weight: ''
  });

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
      
      if (brandsRes.data.length > 0) setNewSpool(prev => ({...prev, brand_id: brandsRes.data[0].id, empty_weight: brandsRes.data[0].default_empty_weight}));
      if (materialsRes.data.length > 0) setNewSpool(prev => ({...prev, material_id: materialsRes.data[0].id}));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAms = async () => {
    try {
      const res = await axios.get('/api/ams');
      setAmsData(res.data);
    } catch (err) {}
  };

  const handleBrandChange = (e) => {
    const brandId = e.target.value;
    const brand = brands.find(b => b.id.toString() === brandId);
    setNewSpool({
      ...newSpool,
      brand_id: brandId,
      empty_weight: brand ? brand.default_empty_weight : ''
    });
  };

  const handleAddSpool = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/spools', newSpool);
      fetchData();
      alert('Spool added!');
    } catch (err) {
      alert('Failed to add spool');
    }
  };

  return (
    <div>
      <h2 style={{marginTop: 0}}>Filament Manager</h2>
      
      {amsData && Object.keys(amsData).length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>AMS Status</h2>
            <button onClick={fetchAms} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Refresh AMS</button>
          </div>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
            {Array.isArray(amsData) ? amsData.map((amsUnit, index) => (
              <div key={index} style={{ border: '1px solid #444', borderRadius: '8px', padding: '10px', minWidth: '250px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>AMS {amsUnit.id || index + 1}</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {amsUnit.tray && amsUnit.tray.map((tray, tIndex) => {
                    const hasFilament = tray.tray_type && tray.tray_type !== '';
                    const hexColor = tray.tray_color ? `#${tray.tray_color.substring(0, 6)}` : '#333';
                    return (
                      <div key={tIndex} style={{ 
                        flex: 1, 
                        textAlign: 'center',
                        backgroundColor: hasFilament ? 'rgba(255,255,255,0.05)' : 'transparent',
                        padding: '10px 5px',
                        borderRadius: '4px',
                        border: hasFilament ? `1px solid ${hexColor}` : '1px dashed #555'
                      }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%', 
                          backgroundColor: hasFilament ? hexColor : '#222',
                          margin: '0 auto 8px auto'
                        }}></div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {hasFilament ? tray.tray_type : 'Empty'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}>
                          Slot {tIndex + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )) : (
              <pre style={{fontSize: '12px', color: '#888'}}>Waiting for detailed AMS payload...</pre>
            )}
          </div>
        </div>
      )}

      <div className="grid">
        <div className="card">
          <h2>Add New Spool</h2>
          <form onSubmit={handleAddSpool}>
            <div className="form-group">
              <label>Brand</label>
              <select name="brand_id" value={newSpool.brand_id} onChange={handleBrandChange} required>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label>Material</label>
              <select name="material_id" value={newSpool.material_id} onChange={(e) => setNewSpool({...newSpool, material_id: e.target.value})} required>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Color</label>
                <input type="color" value={newSpool.color} onChange={(e) => setNewSpool({...newSpool, color: e.target.value})} style={{padding: '0', height: '35px'}} />
              </div>
              <div className="form-group">
                <label>Cost ($/£)</label>
                <input type="number" step="0.01" value={newSpool.cost} onChange={(e) => setNewSpool({...newSpool, cost: e.target.value})} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Weight (g)</label>
                <input type="number" value={newSpool.total_weight} onChange={(e) => setNewSpool({...newSpool, total_weight: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Empty Spool Weight (g)</label>
                <input type="number" value={newSpool.empty_weight} onChange={(e) => setNewSpool({...newSpool, empty_weight: e.target.value})} required />
              </div>
            </div>

            <button type="submit">Add Spool</button>
          </form>
        </div>

        <div className="card" style={{gridColumn: '1 / -1'}}>
          <h2>My Spools</h2>
          <table>
            <thead>
              <tr>
                <th>Color</th>
                <th>Brand</th>
                <th>Material</th>
                <th>Remaining</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {spools.map(spool => {
                const remaining = spool.total_weight - spool.used_weight;
                return (
                  <tr key={spool.id}>
                    <td>
                      <span className="color-dot" style={{backgroundColor: spool.color}}></span>
                    </td>
                    <td>{spool.brand_name}</td>
                    <td>{spool.material_name}</td>
                    <td>{remaining.toFixed(1)}g</td>
                    <td>{spool.cost}</td>
                  </tr>
                );
              })}
              {spools.length === 0 && <tr><td colSpan="5" style={{textAlign: 'center', color: '#888'}}>No spools added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FilamentManager;
