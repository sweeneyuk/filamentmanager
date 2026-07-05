import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAlert } from '../contexts/AlertContext';

function PrintersManagement() {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const { showAlert } = useAlert();
  
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    serial: '',
    access_code: ''
  });

  const fetchPrinters = async () => {
    try {
      const res = await axios.get('/api/printers');
      setPrinters(res.data.printers);
      setLoading(false);
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to fetch printers', true);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const [isAdding, setIsAdding] = useState(false);

  const handleEdit = (printer) => {
    setEditingId(printer.id);
    setIsAdding(false);
    setFormData({
      name: printer.name,
      ip: printer.ip,
      serial: printer.serial,
      access_code: '' // Don't show password, but leave blank unless they want to update it
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ name: '', ip: '', serial: '', access_code: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/printers/${editingId}`, formData);
        showAlert('Success', 'Printer updated successfully!');
      } else {
        await axios.post('/api/printers', formData);
        showAlert('Success', 'Printer added successfully!');
      }
      handleCancelEdit();
      fetchPrinters();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || err.message, true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this printer? This will disconnect it immediately. Archives will remain.')) return;
    try {
      await axios.delete(`/api/printers/${id}`);
      showAlert('Success', 'Printer deleted');
      fetchPrinters();
    } catch (err) {
      showAlert('Error', 'Failed to delete printer', true);
    }
  };

  if (loading) return <div>Loading printers...</div>;

  return (
    <div className="settings-section" style={{ border: 'none', padding: 0 }}>
      <h3>Printer Fleet</h3>
      <p className="settings-desc">Manage your connected Bambu Lab printers.</p>
      
      {printers.length > 0 && !editingId && !isAdding && (
        <div style={{ marginBottom: '20px', overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', minWidth: '400px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Name</th>
                <th style={{ padding: '8px' }}>IP</th>
                <th style={{ padding: '8px' }}>Serial</th>
                <th style={{ padding: '8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {printers.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '8px' }}>{p.name}</td>
                  <td style={{ padding: '8px' }}>{p.ip}</td>
                  <td style={{ padding: '8px' }}>{p.serial}</td>
                  <td style={{ padding: '8px', display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => handleEdit(p)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Edit</button>
                    <button type="button" onClick={() => handleDelete(p.id)} style={{ padding: '4px 8px', fontSize: '0.8rem', backgroundColor: '#8b0000' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(!editingId && !isAdding) ? (
        <button 
          className="btn-primary" 
          onClick={() => setIsAdding(true)}
          style={{ marginTop: '10px' }}
        >
          + Add New Printer
        </button>
      ) : (
        <form onSubmit={handleSave} style={{ backgroundColor: 'var(--secondary-bg)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '15px' }}>
          <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1rem', color: 'var(--text-color)' }}>{editingId ? 'Edit Printer' : 'Add New Printer'}</h4>
          <div className="form-group">
            <label>Printer Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. X1C - Left" required />
          </div>
          <div className="form-group">
            <label>IP Address</label>
            <input type="text" name="ip" value={formData.ip} onChange={handleInputChange} placeholder="192.168.1.100" required />
          </div>
          <div className="form-group">
            <label>Serial Number</label>
            <input type="text" name="serial" value={formData.serial} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Access Code</label>
            <input type="password" name="access_code" value={formData.access_code} onChange={handleInputChange} placeholder={editingId ? 'Leave blank to keep unchanged' : 'Required'} required={!editingId} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" className="btn-primary">{editingId ? 'Update Printer' : 'Add Printer'}</button>
            <button type="button" onClick={handleCancelEdit} style={{ backgroundColor: 'transparent', border: '1px solid #555' }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default PrintersManagement;
