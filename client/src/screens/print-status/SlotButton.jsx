import FilamentRing from '../../ui/FilamentRing';
import FilamentDot from '../../ui/FilamentDot';
import { slotLabel } from './text';

export default function SlotButton({ view, onOpen }) {
  const classes = ['ps-slot', `is-${view.kind}`, view.feeding ? 'is-feeding' : view.inUse ? 'is-in-use' : ''].join(' ');
  return (
    <button type="button" className={classes} aria-label={slotLabel(view)} onClick={onOpen}>
      <FilamentRing color={view.kind === 'assigned' ? view.hex : null} fraction={view.fraction} size={68} hole={0.65}>
        <span className="ps-slot__num">{view.number}</span>
      </FilamentRing>
      {view.kind === 'assigned' && (
        <>
          <span className="ps-slot__grams">{Math.round(view.grams)} g</span>
          <span className="ps-slot__mat">{view.material || 'Unknown'}</span>
          {view.stock === 'low' && <span className="ps-slot__flag is-low">Low stock</span>}
          {view.stock === 'out' && <span className="ps-slot__flag is-out">Ran out</span>}
        </>
      )}
      {view.kind === 'unassigned' && (
        <>
          <span className="ps-slot__grams ps-slot__reported">
            {view.hex && <FilamentDot color={view.hex} size={12} />}
            {view.material || 'Filament'}
          </span>
          <span className="ps-slot__mat">Not assigned</span>
        </>
      )}
      {view.kind === 'empty' && <span className="ps-slot__mat">Empty</span>}
    </button>
  );
}
