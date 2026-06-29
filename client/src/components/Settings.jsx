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
    ha_rate_entity: '',
    oidc_issuer: '',
    oidc_client_id: '',
    oidc_client_secret: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { logout } = useAuth();

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

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Settings</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Configuration</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Connect your Bambu printer and Home Assistant.</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="card">
        <div className="settings-section">
          <h3>Bambu Lab MQTT Integration</h3>
          <p className="settings-desc">Enter your printer's local IP and Access Code. You can find these in the Network tab on your printer's screen.</p>
          <div className="form-group">
            <label>Printer IP Address</label>
            <input type="text" name="bambu_ip" value={settings.bambu_ip || ''} onChange={handleChange} placeholder="192.168.1.100" />
          </div>
          <div className="form-group">
            <label>Printer Serial Number</label>
            <input type="text" name="bambu_serial" value={settings.bambu_serial || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Access Code</label>
            <input type="password" name="bambu_access_code" value={settings.bambu_access_code || ''} onChange={handleChange} />
          </div>
          <button type="button" onClick={() => testConnection('bambu')} style={{ backgroundColor: '#2b2b2b', marginTop: '10px' }}>
            Test Bambu Connection
          </button>
        </div>

        <div className="settings-section">
          <h3>Home Assistant Energy Tracking</h3>
          <p className="settings-desc">Optional: Link to Home Assistant to pull actual energy usage and calculate exact print costs.</p>
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

        <div className="settings-section">
          <h2>Authentication & Security</h2>
          <p className="settings-desc">Optional: Configure an OpenID Connect (OIDC) provider like Authentik for SSO.</p>
          <div className="form-group">
            <label>OIDC Issuer URL</label>
            <input type="text" name="oidc_issuer" value={settings.oidc_issuer || ''} onChange={handleChange} placeholder="https://authentik.domain.com/application/o/filamentmanager/" />
          </div>
          <div className="form-group">
            <label>OIDC Client ID</label>
            <input type="text" name="oidc_client_id" value={settings.oidc_client_id || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>OIDC Client Secret</label>
            <input type="password" name="oidc_client_secret" value={settings.oidc_client_secret || ''} onChange={handleChange} />
          </div>
          <button type="button" onClick={logout} style={{ backgroundColor: '#aa3333', marginTop: '10px' }}>
            Logout
          </button>
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

export default Settings;
