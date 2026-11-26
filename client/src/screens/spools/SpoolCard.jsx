import FilamentRing from '../../ui/FilamentRing';
import SpoolActions from './SpoolActions';

export default function SpoolCard({ view: v, large = false, selected, onToggle, actions, onEdit }) {
  return (
    <article className={`sp-card ${large ? 'sp-card--grid' : ''} ${v.archived ? 'is-archived' : ''} ${selected ? 'is-selected' : ''}`}>
      <label className="sp-checkbox sp-card__check">
        <input type="checkbox" aria-label={`Select spool ${v.id}`} checked={selected} onChange={() => onToggle(v.id)} />
      </label>
      <FilamentRing color={v.spool.color} fraction={v.fraction} size={large ? 112 : 56} hole={large ? 0.62 : 0.6}>
        {large && <span className="sp-card__ring-grams">{v.stock === 'out' ? '0 g' : `${v.grams} g`}</span>}
      </FilamentRing>
      <div className="sp-card__body">
        <div className="sp-card__title">
          <span>{v.title}</span>
          {v.stock === 'low' && <span className="sp-flag is-low">Low stock</span>}
          {v.stock === 'out' && <span className="sp-flag is-out">Ran out</span>}
        </div>
        <div className="sp-card__meta">{v.subtype}, {v.colour}</div>
        <div className="sp-card__meta">
          {!large && <span className="sp-card__grams">{v.stock === 'out' ? 'Ran out' : `${v.grams} g left`}</span>}
          <span className="sp-location">{v.location || 'No location'}</span>
          <span>#{v.id}</span>
        </div>
      </div>
      <SpoolActions view={v} actions={actions} onEdit={onEdit} />
    </article>
  );
}
