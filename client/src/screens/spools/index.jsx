import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, FileUp, FileDown, LayoutGrid, List, Plus, ArrowDownUp } from 'lucide-react';
import PageHeader from '../../ui/shell/PageHeader';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import Tabs from '../../ui/Tabs';
import EmptyState from '../../ui/EmptyState';
import Skeleton from '../../ui/Skeleton';
import LoadError from '../../ui/LoadError';
import SpoolForm from './SpoolForm';
import useMediaQuery, { PHONE } from '../../hooks/useMediaQuery';
import { formatMoney } from '../../lib/format.js';
import { filterSpools, sortSpools, loadSortConfig, loadViewMode, lowStockThreshold } from '../../lib/spools.js';
import useSpoolData from './useSpoolData';
import useSpoolActions from './useSpoolActions';
import { spoolView } from './view';
import StatsStrip from './StatsStrip';
import BulkBar from './BulkBar';
import SpoolTable from './SpoolTable';
import SpoolCards from './SpoolCards';
import SpoolGrid from './SpoolGrid';
import './spools.css';

const FILTERS = [
  { id: 'Active', label: 'Active' },
  { id: 'Archived', label: 'Archived' },
  { id: 'All', label: 'All' },
  { id: 'Used', label: 'Used' },
  { id: 'New', label: 'New' },
  { id: 'Low Stock', label: 'Low stock' },
];

const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
};

export default function Spools() {
  const { data, status, reload } = useSpoolData();
  const isPhone = useMediaQuery(PHONE);
  const [filter, setFilter] = useState('Active');
  const [viewMode, setViewMode] = useState(() => loadViewMode(store.get('fm_view_mode')));
  const [sort, setSort] = useState(() => loadSortConfig(store.get('fm_sort_config')));
  const [showStats, setShowStats] = useState(false);
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState({ open: false, spool: null });
  const fileRef = useRef(null);

  useEffect(() => { store.set('fm_view_mode', viewMode); }, [viewMode]);
  useEffect(() => { store.set('fm_sort_config', JSON.stringify(sort)); }, [sort]);

  const spools = useMemo(() => data?.spools || [], [data]);
  const settings = useMemo(() => data?.settings || {}, [data]);
  const threshold = lowStockThreshold(settings);

  // Drop selections for spools that no longer exist.
  useEffect(() => {
    setSelected((ids) => ids.filter((id) => spools.some((s) => s.id === id)));
  }, [spools]);

  const clearSelection = useCallback((ids) => {
    setSelected((cur) => (ids ? cur.filter((id) => !ids.includes(id)) : []));
  }, []);
  const actions = useSpoolActions({ spools, settings, reload, clearSelection });
  const money = useCallback((v) => formatMoney(v, settings.currency), [settings.currency]);

  const views = useMemo(() => {
    const ctx = { threshold, settings, assignments: data?.assignments, printers: data?.printers };
    return sortSpools(filterSpools(spools, filter, threshold), sort).map((s) => spoolView(s, ctx));
  }, [spools, filter, threshold, sort, settings, data]);

  const onSort = (key) => setSort((cur) => ({ key, direction: cur.key === key && cur.direction === 'asc' ? 'desc' : 'asc' }));
  const onToggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const onToggleAll = (checked) => setSelected(checked ? views.map((v) => v.id) : []);
  const onEdit = (spool) => setModal({ open: true, spool });

  const common = { views, selected, onToggle, actions, onEdit };

  return (
    <>
      <PageHeader
        title="Spools"
        actions={(
          <>
            <div className="sp-switch" role="group" aria-label="View">
              <Button variant="ghost" icon={List} label="Table view" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')} />
              <Button variant="ghost" icon={LayoutGrid} label="Grid view" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} />
            </div>
            <Menu
              label="Import and export"
              icon={ArrowDownUp}
              items={[
                { id: 'import', label: 'Import CSV', icon: FileUp, onSelect: () => fileRef.current?.click() },
                { id: 'export', label: 'Export CSV', icon: FileDown, onSelect: actions.exportCsv },
              ]}
            />
            <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, spool: null })}>Add spool</Button>
          </>
        )}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        hidden
        onChange={(e) => { actions.importCsv(e.target.files[0]); e.target.value = ''; }}
      />

      {status === 'loading' && <Skeleton height={64} count={5} />}
      {status === 'error' && <LoadError message="Could not load spools." onRetry={reload} />}
      {status === 'ready' && (
        <>
          <div className="sp-toolbar">
            <Tabs label="Filter spools" items={FILTERS} value={filter} onChange={setFilter} idPrefix="sp-filter" panelId="sp-list" />
            <Button
              variant="ghost"
              icon={showStats ? ChevronUp : ChevronDown}
              aria-expanded={showStats}
              onClick={() => setShowStats((s) => !s)}
            >
              {showStats ? 'Hide stats' : 'Show stats'}
            </Button>
          </div>
          {showStats && <StatsStrip spools={spools} totalConsumed={data.totalConsumed} threshold={threshold} />}
          <BulkBar count={selected.length} onAction={(a) => actions.bulk(a, selected)} onClear={() => setSelected([])} />
          <div id="sp-list" role="tabpanel" aria-label="Spools" className="sp-list">
            {views.length === 0 && <EmptyState title="No spools found for this filter." />}
            {views.length > 0 && viewMode === 'grid' && <SpoolGrid {...common} />}
            {views.length > 0 && viewMode === 'table' && isPhone && (
              <SpoolCards {...common} sort={sort} onSortChange={setSort} onToggleAll={onToggleAll} />
            )}
            {views.length > 0 && viewMode === 'table' && !isPhone && (
              <SpoolTable {...common} sort={sort} onSort={onSort} onToggleAll={onToggleAll} money={money} />
            )}
          </div>
        </>
      )}

      <SpoolForm
        open={modal.open}
        spool={modal.spool}
        brands={data?.brands || []}
        materials={data?.materials || []}
        knowledge={data?.knowledge || []}
        currency={settings.currency}
        onClose={() => setModal({ open: false, spool: null })}
        onSaved={reload}
      />
    </>
  );
}
