import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';

import PrintersManagement from './PrintersManagement';

function Settings() {
  const [settings, setSettings] = useState({
    ha_url: '',
    ha_token: '',
    ha_energy_entity: '',
    ha_rate_entity: '',
    energy_rate_source: 'ha',
    manual_energy_rate: '',
    oidc_issuer: '',
    oidc_client_id: '',
    oidc_client_secret: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { logout } = useAuth();
  const { showAlert } = useAlert();

  useEffect(() => {
    axios.get('/api/settings').then(res => {
      setSettings(prev => ({ ...prev, ...res.data }));
      setLoading(false);
    }).catch(console.error);
  }, []);

  const testConnection = async (type) => {
    try {
      const res = await axios.post(`/api/test/${type}`, settings);
      showAlert('Connection Test Successful', res.data.message);
    } catch (err) {
      showAlert('Connection Test Failed', err.response?.data?.message || err.message, true);
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
      showAlert('Success', 'Settings saved successfully!');
    } catch (err) {
      showAlert('Error', 'Failed to save settings', true);
    }
    setSaving(false);
  };

  const [activeTab, setActiveTab] = useState('printers');

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="card title-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>Settings</h2>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Configuration</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Configure Integrations and App Behavior.</div>
          </div>
        </div>
      </div>

      <div className="settings-layout">
        {/* Sidebar Tabs */}
        <div className="card no-hover settings-tabs">
          <button 
            className={`btn-secondary`} 
            style={{ fontWeight: activeTab === 'printers' ? 'bold' : 'normal', backgroundColor: activeTab === 'printers' ? 'var(--hover-bg)' : 'transparent', border: activeTab === 'printers' ? '1px solid var(--primary-color)' : '1px solid transparent' }} 
            onClick={() => setActiveTab('printers')}
          >
            Printer Fleet
          </button>
          <button 
            className={`btn-secondary`} 
            style={{ fontWeight: activeTab === 'integrations' ? 'bold' : 'normal', backgroundColor: activeTab === 'integrations' ? 'var(--hover-bg)' : 'transparent', border: activeTab === 'integrations' ? '1px solid var(--primary-color)' : '1px solid transparent' }} 
            onClick={() => setActiveTab('integrations')}
          >
            Integrations
          </button>
          <button 
            className={`btn-secondary`} 
            style={{ fontWeight: activeTab === 'stock' ? 'bold' : 'normal', backgroundColor: activeTab === 'stock' ? 'var(--hover-bg)' : 'transparent', border: activeTab === 'stock' ? '1px solid var(--primary-color)' : '1px solid transparent' }} 
            onClick={() => setActiveTab('stock')}
          >
            Stock & Prefs
          </button>
          <button 
            className={`btn-secondary`} 
            style={{ fontWeight: activeTab === 'security' ? 'bold' : 'normal', backgroundColor: activeTab === 'security' ? 'var(--hover-bg)' : 'transparent', border: activeTab === 'security' ? '1px solid var(--primary-color)' : '1px solid transparent' }} 
            onClick={() => setActiveTab('security')}
          >
            Security & SSO
          </button>
        </div>

        {/* Main Content Area */}
        <div className="settings-content">
          {activeTab === 'printers' && (
            <div className="card no-hover">
              <PrintersManagement />
            </div>
          )}

          {activeTab !== 'printers' && (
            <form onSubmit={handleSave} className="card no-hover">
              
              {activeTab === 'integrations' && (
                <>
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
                      <input type="text" name="ha_printer_energy_entity" value={settings.ha_printer_energy_entity || ''} onChange={handleChange} placeholder="sensor.printer_energy" />
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label>Electricity Rate Source</label>
                      <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'normal' }}>
                          <input type="radio" name="energy_rate_source" value="ha" checked={settings.energy_rate_source !== 'manual'} onChange={handleChange} /> 
                          Home Assistant Entity
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'normal' }}>
                          <input type="radio" name="energy_rate_source" value="manual" checked={settings.energy_rate_source === 'manual'} onChange={handleChange} /> 
                          Manual Entry
                        </label>
                      </div>
                    </div>

                    {settings.energy_rate_source !== 'manual' ? (
                      <div className="form-group">
                        <label>Electricity Rate Entity ID</label>
                        <input type="text" name="ha_rate_entity" value={settings.ha_rate_entity || ''} onChange={handleChange} placeholder="sensor.electricity_price" />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>Manual Electricity Rate (£/kWh)</label>
                        <input type="number" step="0.01" name="manual_energy_rate" value={settings.manual_energy_rate || ''} onChange={handleChange} placeholder="e.g. 0.25" />
                      </div>
                    )}
                    <button type="button" onClick={() => testConnection('ha')} style={{ backgroundColor: '#2b2b2b', marginTop: '10px' }}>
                      Test HA Connection
                    </button>
                  </div>

                  <div className="settings-section">
                    <h3>Gemini AI Integration</h3>
                    <p className="settings-desc">Enable smart print failure analysis. The server will send the final print photo to Gemini to determine if the print was successful or failed.</p>
                    <div className="form-group">
                      <label>Gemini API Key</label>
                      <input type="password" name="gemini_api_key" value={settings.gemini_api_key || ''} onChange={handleChange} placeholder="AIzaSy..." />
                      <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                        You can get a free API key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>Google AI Studio</a>.
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'stock' && (
                <div className="settings-section">
                  <h3>Stock Rules</h3>
                  <p className="settings-desc">Configure the low stock threshold and store links.</p>
                  <div className="form-group">
                    <label>Low Stock Threshold (g)</label>
                    <input type="number" name="low_stock_threshold" value={settings.low_stock_threshold || ''} onChange={handleChange} placeholder="200" />
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                      Spools with a remaining weight below this threshold will appear in the Restock Dashboard.
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Bambu Store Base URL</label>
                    <input type="text" name="bambu_store_region" value={settings.bambu_store_region || ''} onChange={handleChange} placeholder="https://uk.store.bambulab.com" />
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                      Leave blank to default to https://uk.store.bambulab.com
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
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
                  <button type="button" onClick={logout} style={{ backgroundColor: '#aa3333', marginTop: '20px' }}>
                    Logout Local Admin
                  </button>
                </div>
              )}

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '12px 24px', fontSize: '1rem', width: '100%' }}>
                  {saving ? 'Saving...' : 'Save Tab Settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
