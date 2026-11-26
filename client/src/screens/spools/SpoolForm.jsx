import { useState } from 'react';
import axios from 'axios';
import { Plus, Sparkles } from 'lucide-react';
import Dialog from '../../ui/Dialog';
import Field from '../../ui/Field';
import Button from '../../ui/Button';
import { useAlert } from '../../contexts/AlertContext';
import { currencySymbol } from '../../lib/format.js';
import useSpoolForm, { lookupKnowledge } from './useSpoolForm';
import WeightHints from './WeightHints';

export default function SpoolForm({ open, spool, brands, materials, knowledge, currency, onClose, onSaved }) {
  const { showAlert, showPrompt } = useAlert();
  const form = useSpoolForm({ open, spool, brands, materials, knowledge });
  const { values, setField, setValues, setBrand, activeKnowledge, setActiveKnowledge } = form;
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const editing = Boolean(spool);
  const bind = (name) => ({ name, value: values[name] ?? '', onChange: (e) => setField(name, e.target.value) });

  const addBrand = () => {
    showPrompt('Add Brand', 'Enter the name of the new Brand:', '', (name) => {
      if (!name) return;
      const k = lookupKnowledge(knowledge, name);
      const suggested = k ? k.weight.toString() : '250';
      const text = k
        ? `Knowledge Base matched '${k.brand}'!\nEnter default empty weight in grams:`
        : 'Enter the default empty spool weight in grams (e.g. 200):';
      showPrompt('Brand Weight', text, suggested, async (weight) => {
        try {
          const res = await axios.post('/api/brands', { name, default_empty_weight: parseFloat(weight) || 250 });
          onSaved();
          setValues((v) => ({ ...v, brand_id: res.data.id, empty_weight: res.data.default_empty_weight }));
          setActiveKnowledge(lookupKnowledge(knowledge, name));
        } catch {
          showAlert('Error', 'Failed to add brand', true);
        }
      });
    });
  };

  const addMaterial = () => {
    showPrompt('Add Material', 'Enter the name of the new Material (e.g. PLA+):', '', async (name) => {
      if (!name) return;
      try {
        const res = await axios.post('/api/materials', { name });
        onSaved();
        setField('material_id', res.data.id);
      } catch {
        showAlert('Error', 'Failed to add material', true);
      }
    });
  };

  const autoDetect = async () => {
    if (!values.color_name) {
      showAlert('Missing Info', 'Please enter a Color Name first.', true);
      return;
    }
    const material = materials.find((m) => String(m.id) === String(values.material_id))?.name;
    if (!material) {
      showAlert('Missing Info', 'Please select a Material first.', true);
      return;
    }
    setDetecting(true);
    try {
      const res = await axios.post('/api/gemini/resolve-variant', { materialName: material, subtype: values.subtype, colorName: values.color_name });
      if (res.data.variantId) setField('shopify_variant_id', res.data.variantId);
    } catch (e) {
      showAlert('Auto-Detect Failed', e.response?.data?.error || 'Failed to detect variant ID.', true);
    } finally {
      setDetecting(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (editing) await axios.put(`/api/spools/${spool.id}`, values);
      else await axios.post('/api/spools', values);
      onSaved();
      onClose();
    } catch {
      showAlert('Error', 'Failed to save spool', true);
    } finally {
      setSaving(false);
    }
  };

  const linked = values.rfid_aliases
    ? Array.from(new Set([values.rfid, ...String(values.rfid_aliases).split(',').map((s) => s.trim())].filter(Boolean))).join(', ')
    : null;

  return (
    <Dialog
      open={open}
      title={editing ? 'Edit spool' : 'Add spool'}
      onClose={onClose}
      size="lg"
      fullScreenOnPhone
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="sp-form" busy={saving}>{editing ? 'Save changes' : 'Add spool'}</Button>
        </>
      )}
    >
      <form id="sp-form" className="sp-form" onSubmit={submit}>
        <fieldset>
          <legend>Filament</legend>
          <div className="sp-form__grid">
            <Field label="Brand" action={<Button variant="ghost" icon={Plus} className="sp-form__add" onClick={addBrand}>Add brand</Button>}>
              <select name="brand_id" value={values.brand_id} onChange={(e) => setBrand(e.target.value)} required>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Material" action={<Button variant="ghost" icon={Plus} className="sp-form__add" onClick={addMaterial}>Add material</Button>}>
              <select {...bind('material_id')} required>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Subtype (optional)"><input type="text" placeholder="e.g. Matte, Basic" {...bind('subtype')} /></Field>
            <Field label="Location (optional)"><input type="text" placeholder="e.g. Shelf A" {...bind('location')} /></Field>
            <Field label="Colour"><input type="color" {...bind('color')} /></Field>
            <Field label="Colour name"><input type="text" placeholder="e.g. Fire engine red" {...bind('color_name')} /></Field>
          </div>
        </fieldset>

        <fieldset>
          <legend>Weight and cost</legend>
          <div className="sp-form__grid">
            <Field label={`Cost (${currencySymbol(currency)})`}><input type="number" step="0.01" inputMode="decimal" {...bind('cost')} required /></Field>
            <Field label="Label weight (g)"><input type="number" inputMode="numeric" {...bind('total_weight')} required /></Field>
            <Field label="Empty weight (g)">
              <input type="number" inputMode="numeric" {...bind('empty_weight')} required />
            </Field>
            {editing && (
              <Field label="Used weight (g)"><input type="number" step="0.1" inputMode="decimal" {...bind('used_weight')} required /></Field>
            )}
          </div>
          <WeightHints knowledge={activeKnowledge} onPick={(w) => setField('empty_weight', w)} />
        </fieldset>

        <fieldset>
          <legend>Restock and tags</legend>
          <Field
            label="Variant ID or URL"
            hint="Used for the restock link"
            action={<Button variant="ghost" icon={Sparkles} className="sp-form__add" busy={detecting} onClick={autoDetect}>{detecting ? 'Detecting…' : 'Auto-detect'}</Button>}
          >
            <input type="text" placeholder="e.g. 43105581957262 or a shop URL" {...bind('shopify_variant_id')} />
          </Field>
          {editing && (
            <Field label="RFID tag UIDs" hint={linked ? `Linked tags: ${linked}` : undefined}>
              <input type="text" placeholder="e.g. 69F549FC00000100" {...bind('rfid')} />
            </Field>
          )}
        </fieldset>
      </form>
    </Dialog>
  );
}
