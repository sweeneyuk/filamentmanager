import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAlert } from '../contexts/AlertContext';

function SpoolModal({ isOpen, onClose, editingSpool, brands, materials, onSave }) {
  const { showAlert, showPrompt } = useAlert();
  const [newSpool, setNewSpool] = useState({
    brand_id: '',
    material_id: '',
    subtype: '',
    location: '',
    color: '#ffffff',
    cost: '',
    total_weight: 1000,
    empty_weight: '',
    used_weight: 0
  });

  useEffect(() => {
    if (editingSpool) {
      setNewSpool({
        brand_id: editingSpool.brand_id || '',
        material_id: editingSpool.material_id || '',
        subtype: editingSpool.subtype || '',
        location: editingSpool.location || '',
        color: editingSpool.color || '#ffffff',
        cost: editingSpool.cost || '',
        total_weight: editingSpool.total_weight || 1000,
        empty_weight: editingSpool.empty_weight || 250,
        used_weight: editingSpool.used_weight || 0
      });
    } else {
      setNewSpool({ 
        brand_id: brands[0]?.id || '', 
        material_id: materials[0]?.id || '', 
        subtype: '',
        location: '',
        color: '#ffffff', 
        cost: '', 
        total_weight: 1000, 
        empty_weight: brands[0]?.default_empty_weight || 250, 
        used_weight: 0 
      });
    }
  }, [editingSpool, brands, materials, isOpen]);

  const handleBrandChange = (e) => {
    const brandId = e.target.value;
    const brand = brands.find(b => b.id.toString() === brandId);
    setNewSpool({
      ...newSpool,
      brand_id: brandId,
      empty_weight: brand ? brand.default_empty_weight : 250
    });
  };

  const handleAddBrand = () => {
    showPrompt('Add Brand', 'Enter the name of the new Brand:', '', (name) => {
      if (!name) return;
      showPrompt('Brand Weight', 'Enter the default empty spool weight in grams (e.g. 200):', '250', async (weight) => {
        try {
          const res = await axios.post('/api/brands', { name, default_empty_weight: parseFloat(weight) || 250 });
          onSave(); // Refetch lists in parent
          setNewSpool(prev => ({ ...prev, brand_id: res.data.id, empty_weight: res.data.default_empty_weight }));
        } catch (e) {
          showAlert('Error', 'Failed to add brand', true);
        }
      });
    });
  };

  const handleAddMaterial = () => {
    showPrompt('Add Material', 'Enter the name of the new Material (e.g. PLA+):', '', async (name) => {
      if (!name) return;
      try {
        const res = await axios.post('/api/materials', { name });
        onSave(); // Refetch lists in parent
        setNewSpool(prev => ({ ...prev, material_id: res.data.id }));
      } catch (e) {
        showAlert('Error', 'Failed to add material', true);
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSpool) {
        await axios.put(`/api/spools/${editingSpool.id}`, newSpool);
      } else {
        await axios.post('/api/spools', newSpool);
      }
      onSave();
      onClose();
    } catch (err) {
      showAlert('Error', 'Failed to save spool', true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{editingSpool ? 'Edit Spool' : 'Add New Spool'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Brand
                <span style={{ cursor: 'pointer', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold' }} onClick={handleAddBrand}>+ Add New</span>
              </label>
              <select value={newSpool.brand_id} onChange={handleBrandChange} required>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Material
                <span style={{ cursor: 'pointer', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold' }} onClick={handleAddMaterial}>+ Add New</span>
              </label>
              <select value={newSpool.material_id} onChange={(e) => setNewSpool({...newSpool, material_id: e.target.value})} required>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Subtype (Optional)</label>
              <input type="text" placeholder="e.g. Matte, Basic" value={newSpool.subtype} onChange={(e) => setNewSpool({...newSpool, subtype: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Location (Optional)</label>
              <input type="text" placeholder="e.g. Shelf A, AMS 1" value={newSpool.location} onChange={(e) => setNewSpool({...newSpool, location: e.target.value})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 0.3 }}>
              <label>Color</label>
              <input type="color" value={newSpool.color} onChange={(e) => setNewSpool({...newSpool, color: e.target.value})} style={{padding: '0', height: '35px', width: '100%'}} />
            </div>
            <div className="form-group" style={{ flex: 0.7 }}>
              <label>Color Name</label>
              <input type="text" placeholder="e.g. Fire Engine Red" value={newSpool.color_name || ''} onChange={(e) => setNewSpool({...newSpool, color_name: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Cost ($/£)</label>
              <input type="number" step="0.01" value={newSpool.cost} onChange={(e) => setNewSpool({...newSpool, cost: e.target.value})} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Label Weight (g)</label>
              <input type="number" value={newSpool.total_weight} onChange={(e) => setNewSpool({...newSpool, total_weight: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Empty Weight (g)</label>
              <input type="number" value={newSpool.empty_weight} onChange={(e) => setNewSpool({...newSpool, empty_weight: e.target.value})} required />
            </div>
          </div>
          
          {editingSpool && (
            <div className="form-group">
              <label>Used Weight (g)</label>
              <input type="number" step="0.1" value={newSpool.used_weight} onChange={(e) => setNewSpool({...newSpool, used_weight: e.target.value})} required />
            </div>
          )}

          <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ backgroundColor: '#444' }}>Cancel</button>
            <button type="submit" style={{ backgroundColor: 'var(--primary-color)' }}>{editingSpool ? 'Save Changes' : 'Add Spool'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SpoolModal;
