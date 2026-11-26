import { useEffect, useState } from 'react';
import Dialog from '../../ui/Dialog';
import Field from '../../ui/Field';
import Button from '../../ui/Button';

const BLANK = { name: '', ip: '', serial: '', access_code: '' };

export default function PrinterDialog({ open, printer, onClose, onSave }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(printer);
  useEffect(() => {
    if (open) setForm(printer ? { name: printer.name, ip: printer.ip, serial: printer.serial, access_code: '' } : BLANK);
  }, [open, printer]);
  const bind = (name) => ({ name, value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };
  return (
    <Dialog
      open={open}
      title={editing ? 'Edit printer' : 'Add printer'}
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="se-printer" busy={saving}>{editing ? 'Update printer' : 'Add printer'}</Button>
        </>
      )}
    >
      <form id="se-printer" className="se-form" onSubmit={submit}>
        <Field label="Printer name"><input type="text" placeholder="e.g. X1C left" required {...bind('name')} /></Field>
        <Field label="IP address"><input type="text" inputMode="decimal" placeholder="192.168.1.100" required {...bind('ip')} /></Field>
        <Field label="Serial number"><input type="text" required {...bind('serial')} /></Field>
        <Field label="Access code" hint={editing ? 'Leave blank to keep it unchanged.' : undefined}>
          <input type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : 'Required'} required={!editing} {...bind('access_code')} />
        </Field>
      </form>
    </Dialog>
  );
}
