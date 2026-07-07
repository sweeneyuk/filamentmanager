import { useState, useEffect } from 'react';
import axios from 'axios';
import { Briefcase, Search, Trash2, Edit2, CheckCircle, Clock, XCircle, Printer } from 'lucide-react';
import { useAlert } from '../contexts/AlertContext';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
};

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  
  const [editingJob, setEditingJob] = useState(null);
  const [editForm, setEditForm] = useState({ project_name: '', customer_name: '', notes: '', status: '' });
  
  const { showAlert } = useAlert();

  const fetchJobs = async () => {
    try {
      const res = await axios.get('/api/jobs');
      setJobs(res.data);
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to fetch jobs', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this job record?')) return;
    try {
      await axios.delete(`/api/jobs/${id}`);
      setJobs(jobs.filter(j => j.id !== id));
      showAlert('Success', 'Job deleted');
    } catch (err) {
      showAlert('Error', 'Failed to delete job', true);
    }
  };

  const handleEditClick = (job) => {
    setEditingJob(job.id);
    setEditForm({
      project_name: job.project_name,
      customer_name: job.customer_name || '',
      notes: job.notes || '',
      status: job.status
    });
  };

  const handleSaveEdit = async (id) => {
    try {
      await axios.put(`/api/jobs/${id}`, editForm);
      setJobs(jobs.map(j => j.id === id ? { ...j, ...editForm, updated_at: new Date().toISOString() } : j));
      setEditingJob(null);
      showAlert('Success', 'Job updated');
    } catch (err) {
      showAlert('Error', 'Failed to update job', true);
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Quote': return <Clock size={16} color="#eab308" />;
      case 'Accepted': return <CheckCircle size={16} color="#3b82f6" />;
      case 'Printing': return <Printer size={16} color="#a855f7" />;
      case 'Completed': return <CheckCircle size={16} color="#22c55e" />;
      case 'Cancelled': return <XCircle size={16} color="#ef4444" />;
      default: return <Briefcase size={16} />;
    }
  };

  const filteredJobs = jobs.filter(j => {
    const matchesSearch = (j.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (j.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || j.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div style={{ padding: '20px', color: 'var(--text-color)' }}>Loading Jobs...</div>;

  return (
    <div className="fade-in" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-color)' }}>
            <Briefcase size={28} />
            Jobs & Quotes
          </h1>
          <p style={{ margin: 0, color: '#888' }}>Manage saved quotes and track job progress.</p>
        </div>
      </div>

      <div className="card no-hover" style={{ marginBottom: '20px', padding: '15px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#888' }} />
          <input 
            type="text" 
            placeholder="Search projects or customers..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '35px', paddingRight: '10px', paddingTop: '10px', paddingBottom: '10px' }}
          />
        </div>
        
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '10px' }}>
          <option value="All">All Statuses</option>
          <option value="Quote">Quote</option>
          <option value="Accepted">Accepted</option>
          <option value="Printing">Printing</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {filteredJobs.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#888', backgroundColor: 'var(--card-bg)', borderRadius: '8px' }}>
            No jobs found.
          </div>
        ) : filteredJobs.map(job => (
          <div key={job.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {editingJob === job.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input 
                  type="text" 
                  value={editForm.project_name} 
                  onChange={e => setEditForm({...editForm, project_name: e.target.value})}
                  placeholder="Project Name"
                />
                <input 
                  type="text" 
                  value={editForm.customer_name} 
                  onChange={e => setEditForm({...editForm, customer_name: e.target.value})}
                  placeholder="Customer Name (optional)"
                />
                <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                  <option value="Quote">Quote</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Printing">Printing</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <textarea 
                  value={editForm.notes} 
                  onChange={e => setEditForm({...editForm, notes: e.target.value})}
                  placeholder="Notes..."
                  style={{ minHeight: '60px' }}
                />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setEditingJob(null)}>Cancel</button>
                  <button className="btn-primary" onClick={() => handleSaveEdit(job.id)}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', color: 'var(--text-color)' }}>{job.project_name}</h3>
                    {job.customer_name && <div style={{ color: '#888', fontSize: '0.9rem' }}>{job.customer_name}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                    {getStatusIcon(job.status)}
                    {job.status}
                  </div>
                </div>

                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#aaa' }}>Total Cost:</span>
                    <span>{formatCurrency(job.total_cost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#aaa' }}>Markup ({job.markup_amount > 0 ? '+' : ''}{formatCurrency(job.markup_amount)}):</span>
                    <span>+{formatCurrency(job.markup_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', paddingTop: '8px', borderTop: '1px solid var(--border-color)', color: 'var(--primary-color)' }}>
                    <span>Final Price:</span>
                    <span>{formatCurrency(job.final_price)}</span>
                  </div>
                </div>

                {job.notes && (
                  <div style={{ fontSize: '0.9rem', color: '#ccc', fontStyle: 'italic', backgroundColor: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px' }}>
                    {job.notes}
                  </div>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    {new Date(job.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="icon-btn" onClick={() => handleEditClick(job)} title="Edit Job">
                      <Edit2 size={16} />
                    </button>
                    <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(job.id)} title="Delete Job">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
