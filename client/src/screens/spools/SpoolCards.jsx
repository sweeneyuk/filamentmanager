import { ArrowDown, ArrowUp } from 'lucide-react';
import Button from '../../ui/Button';
import SpoolCard from './SpoolCard';
import { COLUMNS } from './view';

/** Phone version of the table view: a list of cards with a sort selector. */
export default function SpoolCards({ views, sort, onSortChange, selected, onToggle, onToggleAll, actions, onEdit }) {
  const allSelected = views.length > 0 && views.every((v) => selected.includes(v.id));
  return (
    <div className="sp-cards">
      <div className="sp-sortbar">
        <label className="sp-checkbox sp-checkbox--text">
          <input type="checkbox" aria-label="Select all spools" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} />
          <span aria-hidden="true">All</span>
        </label>
        <label className="sp-sortbar__label" htmlFor="sp-sort-by">Sort by</label>
        <select id="sp-sort-by" className="ui-input" value={sort.key} onChange={(e) => onSortChange({ key: e.target.value, direction: sort.direction })}>
          {COLUMNS.filter((c) => c.sortable !== false).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <Button
          variant="outline"
          icon={sort.direction === 'asc' ? ArrowUp : ArrowDown}
          label={sort.direction === 'asc' ? 'Sorted ascending, switch to descending' : 'Sorted descending, switch to ascending'}
          onClick={() => onSortChange({ key: sort.key, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
        />
      </div>
      {views.map((v) => (
        <SpoolCard key={v.id} view={v} selected={selected.includes(v.id)} onToggle={onToggle} actions={actions} onEdit={onEdit} />
      ))}
    </div>
  );
}
