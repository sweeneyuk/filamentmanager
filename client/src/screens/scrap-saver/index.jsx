import { useState } from 'react';
import axios from 'axios';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../ui/shell/PageHeader';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Dialog from '../../ui/Dialog';
import Field from '../../ui/Field';
import EmptyState from '../../ui/EmptyState';
import Skeleton from '../../ui/Skeleton';
import LoadError from '../../ui/LoadError';
import FilamentRing from '../../ui/FilamentRing';
import useResource from '../../hooks/useResource';
import { useAlert } from '../../contexts/AlertContext';
import { colorName } from '../../lib/colors.js';
import { remainingGrams, remainingFraction, scrapSpools } from '../../lib/spools.js';
import './scrap.css';

const BLANK = { name: '', weight_g: '', url: '', description: '' };

async function load() {
  const [spools, models] = await Promise.all([axios.get('/api/spools'), axios.get('/api/scrapsaver/models')]);
  return { spools: scrapSpools(spools.data || []), models: models.data || [] };
}

export default function ScrapSaver() {
  const { showAlert, showConfirm } = useAlert();
  const { data, status, reload } = useResource(load);
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const spools = data?.spools || [];
  const models = data?.models || [];
  const selected = spools.find((s) => s.id === selectedId) || null;
  const left = selected ? remainingGrams(selected) : null;

  const addModel = async (e) => {
    e.preventDefault();
    if (!draft.name || !draft.weight_g || saving) return;
    setSaving(true);
    try {
      await axios.post('/api/scrapsaver/models', draft);
      setDraft(BLANK);
      setAdding(false);
      reload();
    } catch {
      showAlert('Error', 'Failed to add model', true);
    } finally {
      setSaving(false);
    }
  };

  const deleteModel = (m) => {
    showConfirm('Delete model', `Remove ${m.name} from your scrap book?`, async () => {
      try {
        await axios.delete(`/api/scrapsaver/models/${m.id}`);
        reload();
      } catch {
        showAlert('Error', 'Failed to delete model', true);
      }
    }, true);
  };

  const bind = (name) => ({ name, value: draft[name], onChange: (e) => setDraft((d) => ({ ...d, [name]: e.target.value })) });

  return (
    <>
      <PageHeader title="Scrap saver" actions={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add model</Button>} />
      {status === 'loading' && <Skeleton height={200} count={2} />}
      {status === 'error' && <LoadError message="Could not load the scrap saver." onRetry={reload} />}
      {status === 'ready' && (
        <div className="ss-columns">
          <Card className="ss-col" aria-label="Near-empty spools">
            <h2>Near-empty spools</h2>
            <p className="ui-muted">Spools with less than 100 g left. Pick one to see which models fit.</p>
            {spools.length === 0 && <EmptyState title="No spools under 100 g right now." />}
            <ul className="ss-spools">
              {spools.map((s) => {
                const pressed = s.id === selectedId;
                return (
                  <li key={s.id}>
                    <button type="button" className="ss-spool" aria-pressed={pressed} onClick={() => setSelectedId(pressed ? null : s.id)}>
                      <FilamentRing color={s.color} fraction={remainingFraction(s)} size={44} hole={0.6} />
                      <span className="ss-spool__text">
                        <span className="ss-spool__name">{[s.brand_name, s.material_name].filter(Boolean).join(' ')}</span>
                        <span className="ui-muted">{colorName(s)}</span>
                      </span>
                      <span className="ss-spool__grams">{remainingGrams(s).toFixed(1)} g</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="ss-col" aria-label="Scrap book">
            <h2>Scrap book</h2>
            <p className="ui-muted">{selected ? `Showing what fits in ${left.toFixed(1)} g.` : 'Small models to use up leftover filament.'}</p>
            {models.length === 0 && <EmptyState title="Your scrap book is empty. Add a small model to get started." />}
            <ul className="ss-models">
              {models.map((m) => {
                const fits = selected ? left >= m.weight_g : true;
                return (
                  <li key={m.id} className="ss-model" data-fits={String(fits)}>
                    <div className="ss-model__text">
                      <h3>{m.name}</h3>
                      <span className="ss-model__weight">{m.weight_g} g</span>
                      {!fits && <span className="ss-model__warn">Not enough filament</span>}
                      {m.description && <p className="ui-muted">{m.description}</p>}
                    </div>
                    <div className="ss-model__actions">
                      {m.url && <Button variant="ghost" icon={ExternalLink} label={`Open ${m.name}`} href={m.url} target="_blank" rel="noreferrer" />}
                      <Button variant="ghost" icon={Trash2} label={`Delete ${m.name}`} onClick={() => deleteModel(m)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      <Dialog
        open={adding}
        title="Add model"
        onClose={() => setAdding(false)}
        footer={(
          <>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="ss-add" busy={saving}>Add model</Button>
          </>
        )}
      >
        <form id="ss-add" className="ss-form" onSubmit={addModel}>
          <Field label="Name"><input type="text" required {...bind('name')} /></Field>
          <Field label="Weight (g)"><input type="number" step="0.1" inputMode="decimal" required {...bind('weight_g')} /></Field>
          <Field label="URL (optional)"><input type="url" {...bind('url')} /></Field>
          <Field label="Description (optional)"><input type="text" {...bind('description')} /></Field>
        </form>
      </Dialog>
    </>
  );
}
