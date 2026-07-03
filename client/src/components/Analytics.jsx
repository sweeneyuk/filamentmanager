import { useState, useEffect } from 'react';
import axios from 'axios';

function Analytics() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/analytics').then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading) return <div>Loading Analytics...</div>;

  // Calculate totals
  let totalCost = 0;
  let totalEnergy = 0;
  let totalFilamentCost = 0;
  let totalWeightG = 0;
  
  data.forEach(print => {
    totalCost += (print.total_cost || 0);
    totalEnergy += (print.energy_cost || 0);
    totalFilamentCost += (print.filament_cost || 0);
    totalWeightG += (print.filament_used_g || 0);
  });

  const totalWeightKg = (totalWeightG / 1000).toFixed(2);
  const totalPrints = data.length;

  return (
    <div>
      <div className="card title-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Analytics & Insights</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Dashboard</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Visualize your filament consumption and printing costs.</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        
        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '10px' }}>TOTAL PRINTS</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{totalPrints}</div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '10px' }}>FILAMENT USED</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>{totalWeightKg} <span style={{ fontSize: '1rem' }}>kg</span></div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '10px' }}>TOTAL COST</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>£{totalCost.toFixed(2)}</div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '10px' }}>Filament: £{totalFilamentCost.toFixed(2)}</div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '10px' }}>ENERGY COST</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f59e0b' }}>£{totalEnergy.toFixed(2)}</div>
        </div>

      </div>
    </div>
  );
}

export default Analytics;
