import { useState } from 'react';
import Dialog from '../../ui/Dialog';
import Field from '../../ui/Field';
import Button from '../../ui/Button';

const BLANK = { project_name: '', customer_name: '', notes: '' };

export default function SaveQuoteDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const bind = (name) => ({ name, value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.project_name || saving) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) setForm(BLANK);
  };
  return (
    <Dialog
      open={open}
      title="Save quote"
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="ca-save" busy={saving} disabled={!form.project_name.trim()}>Save quote</Button>
        </>
      )}
    >
      <form id="ca-save" className="ca-save" onSubmit={submit}>
        <Field label="Project name"><input type="text" required placeholder="e.g. Articulated dragon" {...bind('project_name')} /></Field>
        <Field label="Customer name (optional)"><input type="text" placeholder="e.g. John Doe" {...bind('customer_name')} /></Field>
        <Field label="Notes (optional)"><textarea rows={3} placeholder="Any additional details…" {...bind('notes')} /></Field>
      </form>
    </Dialog>
  );
}
