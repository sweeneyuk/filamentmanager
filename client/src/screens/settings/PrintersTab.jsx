import { useState } from 'react';
import axios from 'axios';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';
import LoadError from '../../ui/LoadError';
import Skeleton from '../../ui/Skeleton';
import useResource from '../../hooks/useResource';
import { useAlert } from '../../contexts/AlertContext';
import PrinterDialog from './PrinterDialog';

export default function PrintersTab() {
  const { showAlert, showConfirm } = useAlert();
  const { data, status, reload } = useResource(async () => (await axios.get('/api/printers')).data?.printers || []);
  const [dialog, setDialog] = useState({ open: false, printer: null });
  const printers = data || [];

  const save = async (form) => {
    try {
      if (dialog.printer) {
        await axios.put(`/api/printers/${dialog.printer.id}`, form);
        showAlert('Success', 'Printer updated successfully!');
      } else {
        await axios.post('/api/printers', form);
        showAlert('Success', 'Printer added successfully!');
      }
      setDialog({ open: false, printer: null });
      reload();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || err.message, true);
    }
  };

  const remove = (p) => {
    showConfirm('Delete printer', 'Are you sure you want to delete this printer? This will disconnect it immediately. Archives will remain.', async () => {
      try {
        await axios.delete(`/api/printers/${p.id}`);
        showAlert('Success', 'Printer deleted');
        reload();
      } catch {
        showAlert('Error', 'Failed to delete printer', true);
      }
    }, true);
  };

  return (
    <div className="se-section">
      <div className="se-section__head">
        <div>
          <h2>Printers</h2>
          <p className="ui-muted">Manage your connected Bambu Lab printers.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setDialog({ open: true, printer: null })}>Add printer</Button>
      </div>
      {status === 'loading' && <Skeleton height={64} count={2} />}
      {status === 'error' && <LoadError message="Could not load printers." onRetry={reload} />}
      {status === 'ready' && printers.length === 0 && <EmptyState title="No printers yet. Add your first printer." />}
      {status === 'ready' && printers.length > 0 && (
        <ul className="se-printers">
          {printers.map((p) => (
            <li key={p.id}>
              <div className="se-printers__text">
                <strong>{p.name}</strong>
                <span className="ui-muted">{p.ip}, serial {p.serial}</span>
              </div>
              <Button variant="ghost" icon={Pencil} label={`Edit ${p.name}`} onClick={() => setDialog({ open: true, printer: p })} />
              <Button variant="ghost" icon={Trash2} label={`Delete ${p.name}`} onClick={() => remove(p)} />
            </li>
          ))}
        </ul>
      )}
      <PrinterDialog open={dialog.open} printer={dialog.printer} onClose={() => setDialog({ open: false, printer: null })} onSave={save} />
    </div>
  );
}
