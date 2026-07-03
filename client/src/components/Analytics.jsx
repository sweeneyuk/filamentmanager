import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

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

  // Process data for charts
  const materialDataMap = {};
  const costDataMap = {}; // Group by month
  
  data.forEach(print => {
    // Material Pie Chart
    if (print.material) {
      if (!materialDataMap[print.material]) {
        materialDataMap[print.material] = { name: print.material, value: 0, color: print.color || '#8884d8' };
      }
      materialDataMap[print.material].value += (print.filament_used_g || 0);
    }

    // Cost Line Chart (Group by YYYY-MM)
    const date = new Date(print.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!costDataMap[monthKey]) {
      costDataMap[monthKey] = { name: monthKey, energy: 0, filament: 0, total: 0 };
    }
    costDataMap[monthKey].energy += (print.energy_cost || 0);
    costDataMap[monthKey].filament += (print.filament_cost || 0);
    costDataMap[monthKey].total += (print.total_cost || 0);
  });

  const materialData = Object.values(materialDataMap).sort((a, b) => b.value - a.value);
  const costData = Object.values(costDataMap).sort((a, b) => a.name.localeCompare(b.name));

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '20px' }}>
        
        <div className="card">
          <h3>Filament Consumption by Material (g)</h3>
          <div style={{ width: '100%', height: 300 }}>
            {materialData.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={materialData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
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
          <h3>Printing Costs over Time (£)</h3>
          <div style={{ width: '100%', height: 300 }}>
            {costData.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={costData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                    formatter={(value) => `£${value.toFixed(2)}`} 
                  />
                  <Legend />
                  <Bar dataKey="filament" stackId="a" name="Filament Cost" fill="var(--primary-color)" />
                  <Bar dataKey="energy" stackId="a" name="Energy Cost" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ color: '#888', textAlign: 'center', marginTop: '100px' }}>No cost data available</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Analytics;
