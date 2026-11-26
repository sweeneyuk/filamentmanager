import Field from '../../ui/Field';
import { currencySymbol } from '../../lib/format.js';

export default function StockTab({ settings, onChange }) {
  const v = (name) => settings[name] || '';
  const sym = currencySymbol(settings.currency);
  const num = (name, label, step, placeholder) => (
    <Field label={label}><input type="number" step={step} name={name} value={v(name)} onChange={onChange} placeholder={placeholder} /></Field>
  );
  return (
    <>
      <div className="se-section">
        <h2>Stock rules</h2>
        <p className="ui-muted">The low stock threshold and store links.</p>
        <div className="se-grid">
          <Field label="Low stock threshold (g)" hint="Spools with less than this left are marked low stock.">
            <input type="number" name="low_stock_threshold" value={v('low_stock_threshold')} onChange={onChange} placeholder="200" />
          </Field>
          <Field label="Bambu store base URL" hint="Leave blank for https://uk.store.bambulab.com">
            <input type="text" name="bambu_store_region" value={v('bambu_store_region')} onChange={onChange} placeholder="https://uk.store.bambulab.com" />
          </Field>
        </div>
      </div>
      <div className="se-section">
        <h2>Print costing calculator</h2>
        <p className="ui-muted">Default rates used for print quotes.</p>
        <div className="se-grid">
          {num('calc_wear_rate', `Machine wear rate (${sym}/hour)`, '0.1', 'e.g. 0.50')}
          {num('calc_energy_rate', `Electricity rate (${sym}/kWh)`, '0.01', 'e.g. 0.25')}
          {num('calc_labor_rate', `Labour rate (${sym}/hour)`, '0.01', 'e.g. 15.00')}
          {num('calc_markup', 'Default markup (%)', '1', 'e.g. 50')}
          {num('calc_avg_wattage', 'Average printer power (W)', '1', 'e.g. 150')}
        </div>
      </div>
    </>
  );
}
