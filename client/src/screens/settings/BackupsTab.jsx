import { useRef } from 'react';
import axios from 'axios';
import { Download, DatabaseBackup, Upload } from 'lucide-react';
import Button from '../../ui/Button';
import Field, { Switch } from '../../ui/Field';
import { useAlert } from '../../contexts/AlertContext';

export default function BackupsTab({ settings, onChange, set, backups, refreshBackups, onRestoring }) {
  const { showAlert } = useAlert();
  const fileRef = useRef(null);
  const enabled = settings.auto_backup_enabled === 'true';

  const manual = async () => {
    try {
      const res = await axios.post('/api/backups/manual');
      showAlert('Success', `Backup created: ${res.data.filename}`);
      await refreshBackups();
    } catch {
      showAlert('Error', 'Failed to create manual backup', true);
    }
  };

  const restore = async (file) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      showAlert('Error', 'Only .zip backup files are supported', true);
      return;
    }
    onRestoring(true);
    const formData = new FormData();
    formData.append('backup', file);
    try {
      await axios.post('/api/backups/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showAlert('Restore Complete', 'The database has been restored successfully. The server is restarting. This page will automatically refresh in 5 seconds...', false, { dialog: true });
      setTimeout(() => window.location.reload(), 5000);
    } catch (err) {
      onRestoring(false);
      showAlert('Error', `Failed to restore backup: ${err.response?.data?.error || err.message}`, true);
    }
  };

  const download = async (filename) => {
    try {
      const response = await axios.get(`/api/backups/download/${filename}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      showAlert('Error', `Failed to download backup: ${err.response?.statusText || err.message}`, true);
    }
  };

  return (
    <>
      <div className="se-section">
        <h2>Auto backups</h2>
        <p className="ui-muted">Automatic periodic backups of the Filament Manager database.</p>
        <Switch
          name="auto_backup_enabled"
          label="Enable auto backups"
          checked={enabled}
          onChange={(checked) => set('auto_backup_enabled', checked ? 'true' : 'false')}
        />
        {enabled && (
          <div className="se-grid">
            <Field label="Backup interval">
              <select name="auto_backup_interval_days" value={settings.auto_backup_interval_days || '1'} onChange={onChange}>
                <option value="1">Daily</option>
                <option value="7">Weekly</option>
                <option value="30">Monthly</option>
              </select>
            </Field>
            <Field label="Number of backups to keep">
              <input type="number" name="auto_backup_retention" min="1" max="100" value={settings.auto_backup_retention || '5'} onChange={onChange} />
            </Field>
          </div>
        )}
      </div>
      <div className="se-section">
        <h2>Manual backup</h2>
        <p className="ui-muted">Create a backup right now.</p>
        <div><Button variant="outline" icon={DatabaseBackup} onClick={manual}>Create manual backup</Button></div>
      </div>
      <div className="se-section se-danger">
        <h2>Restore backup</h2>
        <p>Upload a .zip backup file to restore the database. <strong>This completely overwrites your current data and restarts the server.</strong></p>
        <input ref={fileRef} type="file" accept=".zip" hidden onChange={(e) => restore(e.target.files[0])} />
        <div><Button variant="danger" icon={Upload} onClick={() => fileRef.current?.click()}>Upload and restore backup</Button></div>
      </div>
      {backups.length > 0 && (
        <div className="se-section">
          <h2>Available backups</h2>
          <ul className="se-backups">
            {backups.map((b) => (
              <li key={b.name}>
                <div className="se-backups__text">
                  <strong>{b.name}</strong>
                  <span className="ui-muted">{new Date(b.time).toLocaleString('en-GB')}, {(b.size / 1024).toFixed(1)} KB</span>
                </div>
                <Button variant="ghost" icon={Download} label={`Download ${b.name}`} onClick={() => download(b.name)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
