import { Check } from 'lucide-react';
import FilamentRing from './FilamentRing';
import { colorName } from '../lib/colors.js';
import { remainingGrams, remainingFraction, stockState } from '../lib/spools.js';
import './SpoolPicker.css';

const spoolTitle = (s) => [s.brand_name, s.material_name, s.subtype && s.subtype.toLowerCase() !== 'basic' ? s.subtype : null]
  .filter(Boolean).join(' ');

export default function SpoolPicker({ spools, value, threshold = 200, allowNone = false, detail, onSelect, label = 'Spools' }) {
  return (
    <ul className="ui-picker" aria-label={label}>
      {allowNone && (
        <li>
          <button type="button" className="ui-picker__row" aria-pressed={value == null} onClick={() => onSelect(null)}>
            <span className="ui-picker__none" aria-hidden="true" />
            <span className="ui-picker__main"><span className="ui-picker__name">None</span></span>
            {value == null && <Check size={18} aria-hidden="true" />}
          </button>
        </li>
      )}
      {spools.map((s) => {
        const grams = Math.round(remainingGrams(s));
        const stock = stockState(s, threshold);
        const selected = value != null && String(value) === String(s.id);
        return (
          <li key={s.id}>
            <button type="button" className="ui-picker__row" aria-pressed={selected} onClick={() => onSelect(s)}>
              <FilamentRing color={s.color} fraction={remainingFraction(s)} size={36} hole={0.55} />
              <span className="ui-picker__main">
                <span className="ui-picker__name">{spoolTitle(s) || `Spool ${s.id}`}</span>
                <span className="ui-picker__meta">
                  {colorName(s)}, {grams} g left
                  {stock !== 'ok' && <span className={`ui-picker__stock is-${stock}`}>{stock === 'out' ? 'Ran out' : 'Low stock'}</span>}
                </span>
              </span>
              {detail && <span className="ui-picker__detail">{detail(s)}</span>}
              {selected && <Check size={18} aria-hidden="true" />}
              <span className="ui-visually-hidden">Spool {s.id}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
