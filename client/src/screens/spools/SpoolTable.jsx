import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import FilamentDot from '../../ui/FilamentDot';
import ProgressBar from '../../ui/ProgressBar';
import SpoolActions from './SpoolActions';
import { COLUMNS, barTone } from './view';

function SortHeader({ col, sort, onSort }) {
  if (col.sortable === false) return <th scope="col">{col.label}</th>;
  const active = sort.key === col.key;
  const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th scope="col" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`sp-sort ${active ? 'is-active' : ''}`} onClick={() => onSort(col.key)}>
        {col.label}
        <Icon size={14} aria-hidden="true" />
      </button>
    </th>
  );
}

export default function SpoolTable({ views, sort, onSort, selected, onToggle, onToggleAll, actions, onEdit, money }) {
  const allSelected = views.length > 0 && views.every((v) => selected.includes(v.id));
  return (
    <div className="sp-table-wrap">
      <table className="sp-table">
        <thead>
          <tr>
            <th scope="col" className="sp-check">
              <label className="sp-checkbox">
                <input type="checkbox" aria-label="Select all spools" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} />
              </label>
            </th>
            {COLUMNS.map((c) => <SortHeader key={c.key} col={c} sort={sort} onSort={onSort} />)}
            <th scope="col" className="sp-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => (
            <tr key={v.id} className={`${v.archived ? 'is-archived' : ''} ${selected.includes(v.id) ? 'is-selected' : ''}`}>
              <td className="sp-check">
                <label className="sp-checkbox">
                  <input type="checkbox" aria-label={`Select spool ${v.id}`} checked={selected.includes(v.id)} onChange={() => onToggle(v.id)} />
                </label>
              </td>
              <td>{v.id}</td>
              <td>{v.added}</td>
              <td title={v.spool.last_print_name || undefined}>{v.lastUsed}</td>
              <td><span className="sp-colour"><FilamentDot color={v.spool.color} />{v.colour}</span></td>
              <td>{v.spool.material_name}</td>
              <td>{v.subtype}</td>
              <td>{v.spool.brand_name}</td>
              <td className="sp-location">{v.location || '–'}</td>
              <td>{Number(v.spool.total_weight) || 0} g</td>
              <td>{money(v.spool.cost)}</td>
              <td>
                <div className="sp-remaining">
                  <span className={`sp-grams is-${v.stock}`}>{v.stock === 'out' ? 'Ran out' : `${v.grams} g`}</span>
                  <ProgressBar fraction={v.fraction} tone={barTone(v.stock)} label={`${Math.round(v.fraction * 100)}% left`} />
                </div>
              </td>
              <td className="sp-right"><SpoolActions view={v} actions={actions} onEdit={onEdit} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
