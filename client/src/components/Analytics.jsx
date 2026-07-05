import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  // Calculate totals and process data for charts
  let totalCost = 0;
  let totalEnergy = 0;
  let totalFilamentCost = 0;
  let totalWeightG = 0;
  
  const materialDataMap = {};
  const aiSuccessMap = {
    SUCCESS: { name: 'Success', value: 0, color: '#4ade80' },
    FAILURE: { name: 'Failed', value: 0, color: '#f87171' }
  };
  const aiFailureTypeMap = {};
  
  const failureColors = {
    SPAGHETTI: '#f87171',
    STRINGING: '#fbbf24',
    WARPED: '#f97316',
    LAYER_SHIFT: '#a78bfa',
    UNKNOWN_FAILURE: '#9ca3af'
  };

  const spoolFailureMap = {};
  const spoolSuccessMap = {};
  
  data.forEach(print => {
    totalCost += (print.total_cost || 0);
    totalEnergy += (print.energy_cost || 0);
    totalFilamentCost += (print.filament_cost || 0);
    totalWeightG += (print.filament_used_g || 0);

    // Material Pie Chart
    if (print.material) {
      if (!materialDataMap[print.material]) {
        materialDataMap[print.material] = { name: print.material, value: 0, color: print.color || '#8884d8' };
      }
      materialDataMap[print.material].value += (print.filament_used_g || 0);
    }

    // AI Analysis Data
    if (print.ai_analysis) {
      try {
        const ai = typeof print.ai_analysis === 'string' ? JSON.parse(print.ai_analysis) : print.ai_analysis;
        if (ai && ai.status) {
          const spoolKey = print.brand && print.material ? `${print.brand} ${print.material} ${print.color || ''}`.trim() : null;
          
          if (ai.status === 'SUCCESS') {
            aiSuccessMap.SUCCESS.value += 1;
            if (spoolKey) {
              if (!spoolSuccessMap[spoolKey]) spoolSuccessMap[spoolKey] = 0;
              spoolSuccessMap[spoolKey] += 1;
            }
          } else {
            aiSuccessMap.FAILURE.value += 1;
            
            // Record specific failure type
            if (!aiFailureTypeMap[ai.status]) {
              aiFailureTypeMap[ai.status] = { name: ai.status.replace('_', ' '), value: 0, color: failureColors[ai.status] || '#9ca3af' };
            }
            aiFailureTypeMap[ai.status].value += 1;

            // Record spool-specific failure
            if (spoolKey) {
              if (!spoolFailureMap[spoolKey]) spoolFailureMap[spoolKey] = 0;
              spoolFailureMap[spoolKey] += 1;
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse AI analysis data', e);
      }
    }
  });

  const totalWeightKg = (totalWeightG / 1000).toFixed(2);
  const totalPrints = data.length;
  const materialData = Object.values(materialDataMap).sort((a, b) => b.value - a.value);
  const aiSuccessData = Object.values(aiSuccessMap).filter(d => d.value > 0);
  const aiFailureTypeData = Object.values(aiFailureTypeMap).sort((a, b) => b.value - a.value);
  
  // Calculate failure rates for spools with at least 1 failure
  const problematicSpools = Object.entries(spoolFailureMap).map(([name, fails]) => {
    const successes = spoolSuccessMap[name] || 0;
    const total = successes + fails;
    const rate = Math.round((fails / total) * 100);
    return { name, fails, total, rate };
  }).sort((a, b) => b.rate - a.rate).slice(0, 5);

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
          
          <div className="card">
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Filament Consumption (g)</h3>
            <div style={{ width: '100%', height: 350 }}>
              {materialData.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={materialData}
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {materialData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toFixed(1)}g`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ color: '#888', textAlign: 'center', marginTop: '100px' }}>No print data available</div>}
            </div>
          </div>

          <div className="card">
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>AI Print Success Rate</h3>
            <div style={{ width: '100%', height: 350 }}>
              {aiSuccessData.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={aiSuccessData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="name"
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {aiSuccessData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ color: '#888', textAlign: 'center', marginTop: '100px' }}>No AI analysis data available</div>}
            </div>
          </div>

          <div className="card">
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>AI Failure Breakdown</h3>
            <div style={{ width: '100%', height: 350 }}>
              {aiFailureTypeData.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={aiFailureTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      dataKey="value"
                      nameKey="name"
                      label={({name, value}) => `${name} (${value})`}
                    >
                      {aiFailureTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ color: '#888', textAlign: 'center', marginTop: '100px' }}>No failures recorded! 🎉</div>}
            </div>
          </div>

        </div>

        {/* AI Insights Section */}
        {problematicSpools.length > 0 && (
          <div className="card" style={{ marginTop: '20px', borderLeft: '4px solid #f87171' }}>
            <h3 style={{ color: '#f87171', margin: '0 0 15px 0' }}>⚠️ AI Filament Insights</h3>
            <div style={{ fontSize: '0.9rem', color: '#ccc' }}>
              The AI has detected that the following filament combinations have high failure rates on your machine:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginTop: '15px' }}>
              {problematicSpools.map(spool => (
                <div key={spool.name} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{spool.name}</div>
                  <div style={{ color: '#f87171', fontSize: '1.2rem', fontWeight: 'bold' }}>{spool.rate}% Failure Rate</div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>{spool.fails} failures out of {spool.total} prints</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Analytics;
