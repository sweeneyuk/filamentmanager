import { useState } from 'react';
import axios from 'axios';
import { Search } from 'lucide-react';
import PageHeader from '../../ui/shell/PageHeader';
import Field from '../../ui/Field';
import EmptyState from '../../ui/EmptyState';
import Skeleton from '../../ui/Skeleton';
import LoadError from '../../ui/LoadError';
import useResource from '../../hooks/useResource';
import useSettings from '../../hooks/useSettings';
import { useAlert } from '../../contexts/AlertContext';
import JobCard from './JobCard';
import JobDialog from './JobDialog';
import { STATUSES } from './statuses';
import './jobs.css';

export default function Jobs() {
  const { showAlert, showConfirm } = useAlert();
  const { money } = useSettings();
  const { data, status, reload, setData } = useResource(async () => (await axios.get('/api/jobs')).data || []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [editing, setEditing] = useState(null);
  const jobs = data || [];

  const term = search.toLowerCase();
  const shown = jobs.filter((j) => ((j.project_name || '').toLowerCase().includes(term) || (j.customer_name || '').toLowerCase().includes(term))
    && (filter === 'All' || j.status === filter));

  const save = async (job, form) => {
    try {
      await axios.put(`/api/jobs/${job.id}`, form);
      setData((list = []) => list.map((j) => (j.id === job.id ? { ...j, ...form, updated_at: new Date().toISOString() } : j)));
      setEditing(null);
      showAlert('Success', 'Job updated');
    } catch {
      showAlert('Error', 'Failed to update job', true);
    }
  };

  const remove = (job) => {
    showConfirm('Delete job', 'Are you sure you want to delete this job record?', async () => {
      try {
        await axios.delete(`/api/jobs/${job.id}`);
        setData((list = []) => list.filter((j) => j.id !== job.id));
        showAlert('Success', 'Job deleted');
      } catch {
        showAlert('Error', 'Failed to delete job', true);
      }
    }, true);
  };

  return (
    <>
      <PageHeader title="Jobs and quotes" />
      {status === 'loading' && <Skeleton height={180} count={2} />}
      {status === 'error' && <LoadError message="Could not load jobs." onRetry={reload} />}
      {status === 'ready' && jobs.length === 0 && <EmptyState title="No saved quotes yet. Save one from the Calculator." />}
      {status === 'ready' && jobs.length > 0 && (
        <>
          <div className="jo-filters">
            <div className="jo-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                className="ui-input"
                aria-label="Search projects or customers"
                placeholder="Search projects or customers"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Field label="Status" className="jo-status">
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="All">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          {shown.length === 0 && <EmptyState title="No jobs found." />}
          <div className="jo-grid">
            {shown.map((job) => <JobCard key={job.id} job={job} money={money} onEdit={setEditing} onDelete={remove} />)}
          </div>
        </>
      )}
      <JobDialog job={editing} onClose={() => setEditing(null)} onSave={save} />
    </>
  );
}
