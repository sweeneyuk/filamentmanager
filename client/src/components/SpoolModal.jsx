import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAlert } from '../contexts/AlertContext';
import { Lightbulb, Sparkles } from 'lucide-react';

function SpoolModal({ isOpen, onClose, editingSpool, brands, materials, brandKnowledge, onSave }) {
  const { showAlert, showPrompt } = useAlert();
  const [newSpool, setNewSpool] = useState({
    brand_id: '',
    material_id: '',
    subtype: '',
    location: '',
    color: '#ffffff',
    color_name: '',
    cost: '',
    total_weight: 1000,
    empty_weight: '',
    used_weight: 0,
    shopify_variant_id: ''
  });
  const [isDetecting, setIsDetecting] = useState(false);
  const [activeKnowledge, setActiveKnowledge] = useState(null);

  // Helper to lookup knowledge by brand name
  const lookupKnowledge = (brandName) => {
    if (!brandName || !brandKnowledge) return null;
    const lower = brandName.toLowerCase().trim();
    return brandKnowledge.find(b => 
      b.brand.toLowerCase() === lower || 
      b.brand.toLowerCase().includes(lower) || 
      lower.includes(b.brand.toLowerCase())
    ) || null;
  };

  useEffect(() => {
    let currentKnowledge = null;
    let initialSpoolState = {
      subtype: '',
      location: '',
      color: '#ffffff',
      color_name: '',
      cost: '',
      total_weight: 1000,
      empty_weight: 250,
      used_weight: 0,
      shopify_variant_id: ''
    };

    if (editingSpool) {
      initialSpoolState = {
        brand_id: editingSpool.brand_id || '',
        material_id: editingSpool.material_id || '',
        ...initialSpoolState,
        ...editingSpool
      };
      const brand = brands.find(b => b.id.toString() === editingSpool.brand_id?.toString());
      if (brand) currentKnowledge = lookupKnowledge(brand.name);
    } else {
      const brand = brands[0];
      if (brand) currentKnowledge = lookupKnowledge(brand.name);
      initialSpoolState = {
        brand_id: brand?.id || '', 
        material_id: materials[0]?.id || '',
        ...initialSpoolState,
        empty_weight: currentKnowledge ? currentKnowledge.weight : (brand?.default_empty_weight || 250)
      };
    }
    
    setNewSpool(initialSpoolState);
    setActiveKnowledge(currentKnowledge);
  }, [editingSpool, brands, materials, brandKnowledge, isOpen]);

  const handleBrandChange = (e) => {
    const brandId = e.target.value;
    const brand = brands.find(b => b.id.toString() === brandId);
    let newWeight = 250;
    let knowledge = null;

    if (brand) {
      knowledge = lookupKnowledge(brand.name);
      newWeight = knowledge ? knowledge.weight : brand.default_empty_weight;
    }
    
    setActiveKnowledge(knowledge);
    setNewSpool({
      ...newSpool,
      brand_id: brandId,
      empty_weight: newWeight
    });
  };

  const handleAddBrand = () => {
    showPrompt('Add Brand', 'Enter the name of the new Brand:', '', (name) => {
      if (!name) return;
      
      const knowledge = lookupKnowledge(name);
      const suggestedWeight = knowledge ? knowledge.weight.toString() : '250';
      const promptText = knowledge 
        ? `Knowledge Base matched '${knowledge.brand}'!\nEnter default empty weight in grams:` 
        : 'Enter the default empty spool weight in grams (e.g. 200):';

      showPrompt('Brand Weight', promptText, suggestedWeight, async (weight) => {
        try {
          const res = await axios.post('/api/brands', { name, default_empty_weight: parseFloat(weight) || 250 });
          onSave(); // Refetch lists in parent
          // The parent refetch is async, so we'll let the re-render handle selecting the new brand or we can manually set it
          setNewSpool(prev => ({ ...prev, brand_id: res.data.id, empty_weight: res.data.default_empty_weight }));
          setActiveKnowledge(lookupKnowledge(name));
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

  const handleAutoDetect = async () => {
    if (!newSpool.color_name) {
      showAlert('Missing Info', 'Please enter a Color Name first.', true);
      return;
    }
    
    const material = materials.find(m => m.id.toString() === newSpool.material_id?.toString())?.name;
    if (!material) {
      showAlert('Missing Info', 'Please select a Material first.', true);
      return;
    }

    setIsDetecting(true);
    try {
      const res = await axios.post('/api/gemini/resolve-variant', {
        materialName: material,
        subtype: newSpool.subtype,
        colorName: newSpool.color_name
      });
      if (res.data.variantId) {
        setNewSpool(prev => ({ ...prev, shopify_variant_id: res.data.variantId }));
      }
    } catch (e) {
      showAlert('Auto-Detect Failed', e.response?.data?.error || 'Failed to detect variant ID.', true);
    } finally {
      setIsDetecting(false);
    }
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
      <div className="modal" style={{ maxWidth: '600px' }}>
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
              <input type="text" placeholder="e.g. Matte, Basic" value={newSpool.subtype || ''} onChange={(e) => setNewSpool({...newSpool, subtype: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Location (Optional)</label>
              <input type="text" placeholder="e.g. Shelf A, AMS 1" value={newSpool.location || ''} onChange={(e) => setNewSpool({...newSpool, location: e.target.value})} />
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

          <div className="form-row" style={{ alignItems: 'flex-start' }}>
            <div className="form-group">
              <label>Label Weight (g)</label>
              <input type="number" value={newSpool.total_weight} onChange={(e) => setNewSpool({...newSpool, total_weight: e.target.value})} required />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Empty Weight (g)
                {activeKnowledge && <span style={{ fontSize: '0.75rem', background: 'var(--primary-color)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>AI Match</span>}
              </label>
              <input type="number" value={newSpool.empty_weight} onChange={(e) => setNewSpool({...newSpool, empty_weight: e.target.value})} required />
              
              {activeKnowledge && (
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-color)', opacity: 0.8, backgroundColor: 'var(--bg-color)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                  <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><Lightbulb size={14} color="var(--primary-color)" /> <strong>{activeKnowledge.brand}:</strong> {activeKnowledge.note}</div>
                  {activeKnowledge.variants && activeKnowledge.variants.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {activeKnowledge.variants.map((v, i) => (
                        <button 
                          key={i} 
                          type="button" 
                          onClick={() => setNewSpool({...newSpool, empty_weight: v.weight})}
                          style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', cursor: 'pointer', borderRadius: '4px' }}
                        >
                          {v.label} ({v.weight}g)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {editingSpool && (
            <div className="form-group">
              <label>Used Weight (g)</label>
              <input type="number" step="0.1" value={newSpool.used_weight} onChange={(e) => setNewSpool({...newSpool, used_weight: e.target.value})} required />
            </div>
          )}

          <div className="form-group" style={{ marginTop: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Variant ID or URL
                <span style={{ fontSize: '0.75rem', color: '#ff9800', border: '1px solid #ff9800', padding: '2px 4px', borderRadius: '4px' }}>Auto-Restock</span>
              </div>
              <button 
                type="button" 
                onClick={handleAutoDetect} 
                disabled={isDetecting}
                style={{ 
                  background: 'none', 
                  border: '1px solid var(--primary-color)', 
                  color: 'var(--primary-color)', 
                  padding: '2px 8px', 
                  fontSize: '0.8rem', 
                  borderRadius: '4px',
                  cursor: isDetecting ? 'not-allowed' : 'pointer',
                  opacity: isDetecting ? 0.5 : 1
                }}>
                {isDetecting ? 'Detecting...' : <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Sparkles size={14} /> Auto-Detect</div>}
              </button>
            </label>
            <input type="text" value={newSpool.shopify_variant_id || ''} onChange={(e) => setNewSpool({...newSpool, shopify_variant_id: e.target.value})} placeholder="e.g. 43105581957262 or https://amazon..." />
          </div>

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
