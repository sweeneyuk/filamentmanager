import { useState } from 'react';
import { Save } from 'lucide-react';
import PageHeader from '../../ui/shell/PageHeader';
import Tabs from '../../ui/Tabs';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Skeleton from '../../ui/Skeleton';
import LoadError from '../../ui/LoadError';
import useSettingsForm from './useSettingsForm';
import PrintersTab from './PrintersTab';
import IntegrationsTab from './IntegrationsTab';
import StockTab from './StockTab';
import SecurityTab from './SecurityTab';
import BackupsTab from './BackupsTab';
import './settings.css';

const TABS = [
  { id: 'printers', label: 'Printers' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'stock', label: 'Stock and preferences' },
  { id: 'security', label: 'Security and sign-in' },
  { id: 'backups', label: 'Backups' },
];

export default function Settings() {
  const form = useSettingsForm();
  const [active, setActive] = useState('printers');
  const [restoring, setRestoring] = useState(false);
  const props = { settings: form.settings, onChange: form.onChange, set: form.set };

  if (restoring) {
    return (
      <>
        <PageHeader title="Settings" />
        <Card className="se-restoring" role="status">
          <span className="se-spinner" aria-hidden="true" />
          <h2>Restoring backup…</h2>
          <p className="ui-muted">Uploading the file and overwriting the database. Please wait.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Settings" />
      <Tabs label="Settings sections" items={TABS} value={active} onChange={setActive} idPrefix="se-tab" />
      <div id={`se-tab-${active}-panel`} role="tabpanel" aria-labelledby={`se-tab-${active}`} className="se-panel">
        {active === 'printers' && <Card><PrintersTab /></Card>}
        {active !== 'printers' && form.status === 'loading' && <Skeleton height={240} />}
        {active !== 'printers' && form.status === 'error' && <LoadError message="Could not load settings." onRetry={form.reload} />}
        {active !== 'printers' && form.status === 'ready' && (
          <Card as="form" className="se-form-card" onSubmit={form.save}>
            {active === 'integrations' && <IntegrationsTab {...props} />}
            {active === 'stock' && <StockTab {...props} />}
            {active === 'security' && <SecurityTab {...props} />}
            {active === 'backups' && (
              <BackupsTab {...props} backups={form.backups} refreshBackups={form.refreshBackups} onRestoring={setRestoring} />
            )}
            <div className="se-save">
              <Button variant="primary" type="submit" icon={Save} busy={form.saving}>{form.saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
