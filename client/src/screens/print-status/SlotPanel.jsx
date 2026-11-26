import SidePanel from '../../ui/SidePanel';
import SpoolPicker from '../../ui/SpoolPicker';
import FilamentRing from '../../ui/FilamentRing';
import FilamentDot from '../../ui/FilamentDot';
import Button from '../../ui/Button';
import { colorName } from '../../lib/colors.js';

export default function SlotPanel({ open, title, view, spools, threshold, onAssign, onClose }) {
  const spool = view?.spool;
  return (
    <SidePanel
      open={open}
      title={title}
      onClose={onClose}
      footer={view?.hasAssignment && (
        <Button variant="danger" onClick={() => onAssign('')}>Clear slot</Button>
      )}
    >
      {view && (
        <div className="ps-panel">
          {spool ? (
            <div className="ps-panel__spool">
              <FilamentRing color={spool.color} fraction={view.fraction} size={64} hole={0.6} />
              <div>
                <div className="ps-panel__name">{[spool.brand_name, spool.material_name, spool.subtype].filter(Boolean).join(' ')}</div>
                <div className="ui-muted">{colorName(spool)}, {Math.round(view.grams)} g of {Math.round(Number(spool.total_weight) || 0)} g left</div>
                {view.stock === 'low' && <div className="ps-panel__flag is-low">Low stock</div>}
                {view.stock === 'out' && <div className="ps-panel__flag is-out">Ran out</div>}
              </div>
            </div>
          ) : (
            <div className="ps-panel__spool">
              <div>
                <div className="ps-panel__name">Not assigned</div>
                {view.kind === 'unassigned' && (
                  <div className="ui-muted ps-panel__reported">
                    <FilamentDot color={view.hex} size={12} /> Printer reports {view.material || 'filament'} in this slot
                  </div>
                )}
                {view.kind === 'empty' && <div className="ui-muted">The printer reports this slot as empty.</div>}
              </div>
            </div>
          )}
          <h3 className="ps-panel__heading">Change spool</h3>
          {spools.length ? (
            <SpoolPicker
              spools={spools}
              value={spool?.id ?? null}
              threshold={threshold}
              label="Change spool"
              onSelect={(s) => onAssign(s.id)}
            />
          ) : <p className="ui-muted">No active spools. Add one on the Spools page.</p>}
        </div>
      )}
    </SidePanel>
  );
}
