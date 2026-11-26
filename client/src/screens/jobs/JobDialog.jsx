import { useEffect, useState } from 'react';
import Dialog from '../../ui/Dialog';
import Field from '../../ui/Field';
import Button from '../../ui/Button';
import { STATUSES } from './statuses';

export default function JobDialog({ job, onClose, onSave }) {
  const [form, setForm] = useState({ project_name: '', customer_name: '', notes: '', status: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (job) setForm({ project_name: job.project_name, customer_name: job.customer_name || '', notes: job.notes || '', status: job.status });
  }, [job]);
  const bind = (name) => ({ name, value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    await onSave(job, form);
    setSaving(false);
  };
  return (
    <Dialog
      open={Boolean(job)}
      title="Edit job"
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="jo-edit" busy={saving}>Save</Button>
        </>
      )}
    >
      <form id="jo-edit" className="jo-form" onSubmit={submit}>
        <Field label="Project name"><input type="text" required {...bind('project_name')} /></Field>
        <Field label="Customer name (optional)"><input type="text" {...bind('customer_name')} /></Field>
        <Field label="Status">
          <select {...bind('status')}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </Field>
        <Field label="Notes"><textarea rows={3} {...bind('notes')} /></Field>
      </form>
    </Dialog>
  );
}
