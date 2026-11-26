import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Dialog from '../../ui/Dialog';
import SpoolPicker from '../../ui/SpoolPicker';
import FilamentDot from '../../ui/FilamentDot';
import { colorName } from '../../lib/colors.js';

export default function SpoolAssign({ weights, selected, spools, threshold, money, onChange }) {
  const [slot, setSlot] = useState(null);
  return (
    <>
      <ul className="ca-slots">
        {weights.map((w, i) => {
          const spool = spools.find((s) => String(s.id) === String(selected[i])) || null;
          return (
            <li key={i}>
              <span className="ca-slot__label">Slot {i + 1}</span>
              <span className="ca-slot__weight"><FilamentDot color={w.hex} />{(w.weight || 0).toFixed(1)} g</span>
              <button type="button" className="ca-slot__pick" aria-label={`Choose spool for slot ${i + 1}`} onClick={() => setSlot(i)}>
                {spool ? (
                  <>
                    <FilamentDot color={spool.color} />
                    <span>{spool.brand_name} {spool.material_name} {colorName(spool)}</span>
                    <span className="ui-muted">{money(spool.cost || 0)}</span>
                  </>
                ) : <span className="ui-muted">Choose spool</span>}
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <Dialog open={slot !== null} title={slot !== null ? `Spool for slot ${slot + 1}` : ''} onClose={() => setSlot(null)}>
        {slot !== null && (
          <SpoolPicker
            spools={spools}
            value={selected[slot] || null}
            threshold={threshold}
            allowNone
            detail={(s) => money(s.cost || 0)}
            label={`Spool for slot ${slot + 1}`}
            onSelect={(s) => { onChange(slot, s ? s.id : ''); setSlot(null); }}
          />
        )}
      </Dialog>
    </>
  );
}
