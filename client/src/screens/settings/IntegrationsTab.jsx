import axios from 'axios';
import { PlugZap } from 'lucide-react';
import Field from '../../ui/Field';
import Button from '../../ui/Button';
import { useAlert } from '../../contexts/AlertContext';
import { currencySymbol } from '../../lib/format.js';

export default function IntegrationsTab({ settings, onChange }) {
  const { showAlert } = useAlert();
  const v = (name) => settings[name] || '';
  const manual = settings.energy_rate_source === 'manual';
  const test = async () => {
    try {
      const res = await axios.post('/api/test/ha', settings);
      showAlert('Connection Test Successful', res.data.message);
    } catch (err) {
      showAlert('Connection Test Failed', err.response?.data?.message || err.message, true);
    }
  };
  return (
    <>
      <div className="se-section">
        <h2>Home Assistant energy tracking</h2>
        <p className="ui-muted">Optional: link to Home Assistant to pull actual energy use and work out exact print costs.</p>
        <div className="se-grid">
          <Field label="Home Assistant URL"><input type="text" name="ha_url" value={v('ha_url')} onChange={onChange} placeholder="http://homeassistant.local:8123" /></Field>
          <Field label="Long-lived access token"><input type="password" name="ha_token" value={v('ha_token')} onChange={onChange} autoComplete="off" /></Field>
          <Field label="Printer energy entity ID (kWh or W)"><input type="text" name="ha_printer_energy_entity" value={v('ha_printer_energy_entity')} onChange={onChange} placeholder="sensor.printer_energy" /></Field>
        </div>
        <fieldset className="se-radios">
          <legend>Electricity rate source</legend>
          <label><input type="radio" name="energy_rate_source" value="ha" checked={!manual} onChange={onChange} /> Home Assistant entity</label>
          <label><input type="radio" name="energy_rate_source" value="manual" checked={manual} onChange={onChange} /> Manual entry</label>
        </fieldset>
        <div className="se-grid">
          {!manual ? (
            <Field label="Electricity rate entity ID"><input type="text" name="ha_rate_entity" value={v('ha_rate_entity')} onChange={onChange} placeholder="sensor.electricity_price" /></Field>
          ) : (
            <Field label={`Manual electricity rate (${currencySymbol(settings.currency)}/kWh)`}>
              <input type="number" step="0.01" name="manual_energy_rate" value={v('manual_energy_rate')} onChange={onChange} placeholder="e.g. 0.25" />
            </Field>
          )}
        </div>
        <div><Button variant="outline" icon={PlugZap} onClick={test}>Test Home Assistant connection</Button></div>
      </div>
      <div className="se-section">
        <h2>Gemini AI</h2>
        <p className="ui-muted">Smart print failure analysis. The server sends the final print photo to Gemini to judge whether the print succeeded.</p>
        <div className="se-grid">
          <Field label="Gemini API key" hint={<>Get a free key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">Google AI Studio</a>.</>}>
            <input type="password" name="gemini_api_key" value={v('gemini_api_key')} onChange={onChange} placeholder="AIzaSy…" autoComplete="off" />
          </Field>
        </div>
      </div>
    </>
  );
}
