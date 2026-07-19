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
    oidc_client_secret: '',
    calc_labor_rate: '',
    calc_wear_rate: '',
    calc_markup: '',
    calc_avg_wattage: '',
    calc_energy_rate: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backups, setBackups] = useState([]);
  const fileInputRef = React.useRef(null);
  const { logout } = useAuth();
  const { showAlert } = useAlert();

  useEffect(() => {
    Promise.all([
      axios.get('/api/settings'),
      axios.get('/api/backups').catch(() => ({ data: [] }))
    ]).then(([settingsRes, backupsRes]) => {
      setSettings(prev => ({ ...prev, ...settingsRes.data }));
      setBackups(backupsRes.data || []);
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

  const handleManualBackup = async () => {
    try {
      const res = await axios.post('/api/backups/manual');
      showAlert('Success', `Backup created: ${res.data.filename}`);
      const backupsRes = await axios.get('/api/backups');
      setBackups(backupsRes.data || []);
    } catch (err) {
      showAlert('Error', 'Failed to create manual backup', true);
    }
  };

  const handleRestoreBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.zip')) {
      showAlert('Error', 'Only .zip backup files are supported', true);
      return;
    }

    setRestoring(true);
    const formData = new FormData();
    formData.append('backup', file);

    try {
      await axios.post('/api/backups/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // The server will restart. Show a persistent alert and reload after a delay.
      showAlert('Restore Complete', 'The database has been restored successfully. The server is restarting. This page will automatically refresh in 5 seconds...');
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (err) {
      setRestoring(false);
      showAlert('Error', 'Failed to restore backup: ' + (err.response?.data?.error || err.message), true);
    }
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadBackup = async (filename) => {
    try {
      const response = await axios.get(`/api/backups/download/${filename}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      showAlert('Error', 'Failed to download backup: ' + (err.response?.statusText || err.message), true);
    }
  };

  const [activeTab, setActiveTab] = useState('printers');

  if (loading) return <div>Loading...</div>;

  if (restoring) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <h2 style={{ color: 'var(--primary-color)' }}>Restoring Backup...</h2>
        <p>Uploading the file and overwriting the database. Please wait...</p>
        <div className="spinner" style={{ marginTop: '20px', width: '40px', height: '40px', border: '4px solid var(--border-color)', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

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
          <button 
            className={`btn-secondary`} 
            style={{ fontWeight: activeTab === 'backups' ? 'bold' : 'normal', backgroundColor: activeTab === 'backups' ? 'var(--hover-bg)' : 'transparent', border: activeTab === 'backups' ? '1px solid var(--primary-color)' : '1px solid transparent' }} 
            onClick={() => setActiveTab('backups')}
          >
            Backups
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
                <>
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
                
                <div className="settings-section">
                  <h3>Print Costing Calculator</h3>
                  <p className="settings-desc">Global default rates used to generate print quotes.</p>
                  <div className="form-group">
                    <label>Machine Wear Rate (£/hour)</label>
                    <input type="number" step="0.1" name="calc_wear_rate" value={settings.calc_wear_rate || ''} onChange={handleChange} placeholder="e.g. 0.50" />
                  </div>
                  <div className="form-group">
                    <label>Electricity Rate (£/kWh)</label>
                    <input type="number" step="0.01" name="calc_energy_rate" value={settings.calc_energy_rate || ''} onChange={handleChange} placeholder="e.g. 0.25" />
                  </div>
                  <div className="form-group">
                    <label>Labor Rate (£/hour)</label>
                    <input type="number" step="0.01" name="calc_labor_rate" value={settings.calc_labor_rate || ''} onChange={handleChange} placeholder="e.g. 15.00" />
                  </div>
                  <div className="form-group">
                    <label>Default Markup (%)</label>
                    <input type="number" step="1" name="calc_markup" value={settings.calc_markup || ''} onChange={handleChange} placeholder="e.g. 50" />
                  </div>
                  <div className="form-group">
                    <label>Average Printer Power (Watts)</label>
                    <input type="number" step="1" name="calc_avg_wattage" value={settings.calc_avg_wattage || ''} onChange={handleChange} placeholder="e.g. 150" />
                  </div>
                </div>
                </>
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

              {activeTab === 'backups' && (
                <>
                <div className="settings-section">
                  <h2>Auto Backups</h2>
                  <p className="settings-desc">Configure automated periodic backups of the Filament Manager database.</p>
                  
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" name="auto_backup_enabled" checked={settings.auto_backup_enabled === 'true'} onChange={(e) => setSettings({ ...settings, auto_backup_enabled: e.target.checked ? 'true' : 'false' })} />
                      Enable Auto Backups
                    </label>
                  </div>
                  
                  {settings.auto_backup_enabled === 'true' && (
                    <>
                      <div className="form-group" style={{ marginTop: '15px' }}>
                        <label>Backup Interval (Days)</label>
                        <select name="auto_backup_interval_days" value={settings.auto_backup_interval_days || '1'} onChange={handleChange}>
                          <option value="1">Daily</option>
                          <option value="7">Weekly</option>
                          <option value="30">Monthly</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginTop: '15px' }}>
                        <label>Number of Backups to Retain</label>
                        <input type="number" name="auto_backup_retention" value={settings.auto_backup_retention || '5'} onChange={handleChange} min="1" max="100" />
                      </div>
                    </>
                  )}
                </div>

                <div className="settings-section" style={{ marginTop: '30px' }}>
                  <h2>Manual Backup</h2>
                  <p className="settings-desc">Generate and download a backup right now.</p>
                  <button type="button" className="btn-primary" onClick={handleManualBackup}>
                    Create & Download Manual Backup
                  </button>
                </div>

                <div className="settings-section" style={{ marginTop: '30px' }}>
                  <h2>Restore Backup</h2>
                  <p className="settings-desc">Upload a `.zip` backup file to restore the database. <strong>Warning:</strong> This will completely overwrite your current data and restart the server!</p>
                  <input 
                    type="file" 
                    accept=".zip" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleRestoreBackup} 
                  />
                  <button type="button" className="btn-danger" style={{ backgroundColor: '#aa3333' }} onClick={() => fileInputRef.current.click()}>
                    Upload & Restore Backup
                  </button>
                </div>

                {backups.length > 0 && (
                  <div className="settings-section" style={{ marginTop: '30px' }}>
                    <h2>Available Backups</h2>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {backups.map(b => (
                        <li key={b.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                          <div>
                            <strong>{b.name}</strong>
                            <div style={{ fontSize: '0.8rem', color: '#888' }}>
                              {new Date(b.time).toLocaleString()} • {(b.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <button type="button" className="btn-secondary" onClick={() => handleDownloadBackup(b.name)}>
                            Download
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                </>
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
