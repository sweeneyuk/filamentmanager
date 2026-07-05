import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Plus, ExternalLink, RefreshCw } from 'lucide-react';

function ScrapSaver() {
  const [spools, setSpools] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedSpool, setSelectedSpool] = useState(null);
  
  const [newModel, setNewModel] = useState({ name: '', weight_g: '', url: '', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [spoolsRes, modelsRes] = await Promise.all([
        axios.get('/api/spools'),
        axios.get('/api/scrapsaver/models')
      ]);
      
      // Filter spools to only show scrap (e.g., < 100g remaining)
      const scrapSpools = spoolsRes.data.filter(s => (s.total_weight - s.used_weight) < 100 && (s.total_weight - s.used_weight) > 0);
      setSpools(scrapSpools);
      setModels(modelsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const handleAddModel = async (e) => {
    e.preventDefault();
    if (!newModel.name || !newModel.weight_g) return;
    
    try {
      await axios.post('/api/scrapsaver/models', newModel);
      setNewModel({ name: '', weight_g: '', url: '', description: '' });
      fetchData();
    } catch (err) {
      console.error('Error adding model:', err);
    }
  };

  const handleDeleteModel = async (id) => {
    try {
      await axios.delete(`/api/scrapsaver/models/${id}`);
      fetchData();
    } catch (err) {
      console.error('Error deleting model:', err);
    }
  };

  const getRemainingWeight = (s) => (s.total_weight - s.used_weight).toFixed(1);

  return (
    <div style={{ paddingBottom: '20px' }}>
      
      {/* Title Card */}
      <div className="card title-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Scrap Saver</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Dashboard</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Find tiny prints to use up your near-empty spools.</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap' }}>
        {/* Left: Scrap Spools */}
        <div style={{ flex: '1 1 300px', backgroundColor: 'var(--card-bg)', borderRadius: '12px', padding: '20px', overflowY: 'auto' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-color)' }}>
          <RefreshCw /> Scrap Dashboard
        </h2>
        <p style={{ color: '#888', marginBottom: '20px' }}>Spools with less than 100g remaining.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {spools.map(spool => {
            const remaining = getRemainingWeight(spool);
            const isSelected = selectedSpool?.id === spool.id;
            return (
              <div 
                key={spool.id}
                className="scrap-spool-card"
                onClick={() => setSelectedSpool(isSelected ? null : spool)}
                style={{
                  padding: '15px', borderRadius: '8px', cursor: 'pointer',
                  border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  display: 'flex', justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{spool.brand_name} {spool.material_name}</div>
                  <div style={{ fontSize: '0.9em', color: '#888' }}>{spool.color_name}</div>
                </div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  {remaining}g
                </div>
              </div>
            );
          })}
          {spools.length === 0 && <p>No scrap spools found! Great job managing your filament.</p>}
        </div>
      </div>

      {/* Right: Personal Scrap Book */}
      <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Scrap Book List */}
        <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', borderRadius: '12px', padding: '20px', overflowY: 'auto' }}>
          <h2>My Scrap Book</h2>
          <p style={{ color: '#888', marginBottom: '20px' }}>Models you've saved to print with scrap filament.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {models.map(model => {
              const canPrint = selectedSpool ? (parseFloat(getRemainingWeight(selectedSpool)) >= model.weight_g) : true;
              return (
                <div key={model.id} style={{
                  padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--secondary-bg)',
                  opacity: canPrint ? 1 : 0.4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {model.name}
                      {model.url && (
                        <a href={model.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                    {model.description && <div style={{ fontSize: '0.9em', color: '#888' }}>{model.description}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{model.weight_g}g</div>
                    <button onClick={() => handleDeleteModel(model.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
            {models.length === 0 && <p>Your Scrap Book is empty! Save some small models here.</p>}
          </div>
        </div>

        {/* Add Model Form */}
        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '12px', padding: '20px' }}>
          <h3>Add to Scrap Book</h3>
          <form onSubmit={handleAddModel} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Model Name" value={newModel.name} onChange={e => setNewModel({...newModel, name: e.target.value})} required style={{ flex: '1 1 200px', padding: '10px', borderRadius: '4px', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }} />
              <input type="number" step="0.1" placeholder="Weight (g)" value={newModel.weight_g} onChange={e => setNewModel({...newModel, weight_g: e.target.value})} required style={{ flex: '1 1 100px', padding: '10px', borderRadius: '4px', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }} />
            </div>
            <input type="url" placeholder="URL (optional)" value={newModel.url} onChange={e => setNewModel({...newModel, url: e.target.value})} style={{ padding: '10px', borderRadius: '4px', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }} />
            <input type="text" placeholder="Description (optional)" value={newModel.description} onChange={e => setNewModel({...newModel, description: e.target.value})} style={{ padding: '10px', borderRadius: '4px', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }} />
            <button type="submit" style={{ padding: '10px', borderRadius: '4px', backgroundColor: 'var(--primary-color)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Plus size={18} /> Add Model
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default ScrapSaver;
