import { useState, useEffect } from 'react';
import axios from 'axios';

function Settings() {
  const [settings, setSettings] = useState({
    bambu_ip: '',
    bambu_serial: '',
    bambu_access_code: '',
    ha_url: '',
    ha_token: '',
    ha_energy_entity: '',
    ha_rate_entity: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get('/api/settings').then(res => {
      setSettings(prev => ({ ...prev, ...res.data }));
      setLoading(false);
    }).catch(console.error);
  }, []);

  const testConnection = async (type) => {
    try {
      const res = await axios.get(`/api/test/${type}`);
      alert(res.data.message);
    } catch (err) {
      alert(`Connection failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/settings', settings);
      alert('Settings saved successfully!');
    } catch (err) {
      alert('Failed to save settings');
    }
    setSaving(false);
  };

  const handleUploadBambuddy = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('dbFile', file);
    
    try {
      setLoading(true);
      const res = await axios.post('/api/import/bambuddy', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(res.data.message);
    } catch (err) {
      alert(`Import failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2 style={{marginTop: 0}}>Settings</h2>
      
      <form onSubmit={handleSave}>
        <div className="card">
          <h2>Bambu Lab X2D Printer (LAN Mode)</h2>
          <div className="form-group">
            <label>Printer IP Address</label>
            <input type="text" name="bambu_ip" value={settings.bambu_ip || ''} onChange={handleChange} placeholder="e.g. 192.168.1.100" />
          </div>
          <div className="form-group">
            <label>Printer Serial Number</label>
            <input type="text" name="bambu_serial" value={settings.bambu_serial || ''} onChange={handleChange} placeholder="e.g. 00M..." />
          </div>
          <div className="form-group">
            <label>LAN Access Code</label>
            <input type="password" name="bambu_access_code" value={settings.bambu_access_code || ''} onChange={handleChange} />
          </div>
          <button type="button" onClick={() => testConnection('mqtt')} style={{ backgroundColor: '#2b2b2b', marginTop: '10px' }}>
            Test Bambu Connection
          </button>
        </div>

        <div className="card">
          <h2>Home Assistant Integration</h2>
          <div className="form-group">
            <label>Home Assistant URL</label>
            <input type="text" name="ha_url" value={settings.ha_url || ''} onChange={handleChange} placeholder="http://homeassistant.local:8123" />
          </div>
          <div className="form-group">
            <label>Long-Lived Access Token</label>
            <input type="password" name="ha_token" value={settings.ha_token || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Printer Energy Entity ID (kWh or W)</label>
            <input type="text" name="ha_energy_entity" value={settings.ha_energy_entity || ''} onChange={handleChange} placeholder="sensor.printer_energy" />
          </div>
          <div className="form-group">
            <label>Electricity Rate Entity ID</label>
            <input type="text" name="ha_rate_entity" value={settings.ha_rate_entity || ''} onChange={handleChange} placeholder="sensor.electricity_price" />
          </div>
          <button type="button" onClick={() => testConnection('ha')} style={{ backgroundColor: '#2b2b2b', marginTop: '10px' }}>
            Test HA Connection
          </button>
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2>Import from Bambuddy</h2>
        <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '15px' }}>
          Upload your <code>bambuddy.db</code> SQLite file to automatically import your Brands, Materials, and Spools.
        </p>
        <input 
          type="file" 
          accept=".db,.sqlite" 
          onChange={handleUploadBambuddy} 
          style={{ padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px', width: '100%' }}
        />
      </div>
    </div>
  );
}

export default Settings;
