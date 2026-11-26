import { useCallback, useState } from 'react';
import axios from 'axios';
import useResource from '../../hooks/useResource';
import { useAlert } from '../../contexts/AlertContext';

const DEFAULTS = {
  ha_url: '', ha_token: '', ha_energy_entity: '', ha_rate_entity: '', energy_rate_source: 'ha', manual_energy_rate: '',
  oidc_issuer: '', oidc_client_id: '', oidc_client_secret: '',
  calc_labor_rate: '', calc_wear_rate: '', calc_markup: '', calc_avg_wattage: '', calc_energy_rate: '',
};

async function load() {
  const [settings, backups] = await Promise.all([
    axios.get('/api/settings'),
    axios.get('/api/backups').catch(() => ({ data: [] })),
  ]);
  return { settings: { ...DEFAULTS, ...(settings.data || {}) }, backups: backups.data || [] };
}

/** Settings form state. Saving posts the whole object, masked values included, as before. */
export default function useSettingsForm() {
  const { showAlert } = useAlert();
  const { data, status, reload, setData } = useResource(load);
  const [saving, setSaving] = useState(false);
  const settings = data?.settings || DEFAULTS;

  const set = useCallback((name, value) => setData((d) => ({ ...d, settings: { ...d.settings, [name]: value } })), [setData]);
  const onChange = useCallback((e) => set(e.target.name, e.target.value), [set]);

  const save = useCallback(async (e) => {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await axios.post('/api/settings', settings);
      showAlert('Success', 'Settings saved successfully!');
    } catch {
      showAlert('Error', 'Failed to save settings', true);
    }
    setSaving(false);
  }, [saving, settings, showAlert]);

  const refreshBackups = useCallback(async () => {
    const res = await axios.get('/api/backups');
    setData((d) => ({ ...d, backups: res.data || [] }));
  }, [setData]);

  return { settings, backups: data?.backups || [], status, reload, set, onChange, save, saving, refreshBackups };
}
